from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
from basic_pitch.inference import predict, Model
from basic_pitch import ICASSP_2022_MODEL_PATH
from note_seq.midi_io import midi_to_note_sequence
from google.protobuf.json_format import MessageToJson
import uvicorn
import os
import asyncio
import io
import logging
import numpy as np
import pretty_midi # basic-pitch returns pretty_midi.PrettyMIDI objects, useful for conversion
from pydantic import BaseModel
import wave
from pydub import AudioSegment

# Allows for specification of bpm
class BPMInput(BaseModel):
    bpm: int

# Configure logging for better visibility in the console
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Initialize FastAPI application
app = FastAPI()

origins = [
    "http://localhost",
    "http://localhost:5173", # React server port with Vite
    # Add other origins if your frontend is hosted elsewhere (e.g., your domain)
]

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount the directory where your React app's build output is located.
FRONTEND_BUILD_DIR = "/Users/kotula/code/Muse/muse-app/dist"

# Check if the frontend build directory exists
if not os.path.isdir(FRONTEND_BUILD_DIR):
    logger.error(f"Frontend build directory '{FRONTEND_BUILD_DIR}' not found. "
                 "Please build your React app (`npm run build`) and place its output "
                 f"in a folder named '{FRONTEND_BUILD_DIR}' next to main.py.")

# Mount the directory containing your static assets.
# For Vite, this is typically 'dist/assets' if you want to serve them under /static
# OR, if you want to serve them directly from the root of 'dist', you can mount 'dist' itself.
# Let's assume assets are in 'dist/assets' and you want to serve them under '/assets'
# The catch-all route will handle index.html from 'dist'
app.mount("/assets", StaticFiles(directory=FRONTEND_BUILD_DIR + "/assets"), name="assets")
# If your Vite config outputs assets directly to 'dist' without an 'assets' subfolder,
# you might use: app.mount("/static", StaticFiles(directory=FRONTEND_BUILD_DIR), name="static")

# Audio information
USER_AUDIO_PATH = "user_audio.wav"
SAMPLE_RATE = 48000
SAMPLE_WIDTH = 2 # PCM16: 16 bits / 8 (bits/byte) = 2
CHANNELS = 1

# --- Load Basic-Pitch Model ---
# It's crucial to load the model once when the application starts,
# not inside every request/WebSocket message, to avoid performance bottlenecks.
BP_MODEL = None
try:
    logger.info("Attempting to load Basic-Pitch model...")
    BP_MODEL = Model(ICASSP_2022_MODEL_PATH)
    logger.info("Basic-Pitch model loaded successfully.")
except Exception as e:
    logger.error(f"Failed to load Basic-Pitch model: {e}")
    logger.warning("Basic-Pitch functionality will be unavailable due to model loading error.")


# --- Helper function to convert pretty_midi.PrettyMIDI to a JSON-serializable format ---
def midi_to_json(pretty_midi_obj: pretty_midi.PrettyMIDI):
    """
    Converts a pretty_midi.PrettyMIDI object into a JSON-serializable list of note events.
    Each note event includes start_time, end_time, pitch, and velocity.
    Returns an empty list if pretty_midi_obj is None or has no notes.
    """
    if pretty_midi_obj is None:
        logger.warning("midi_to_json received None for pretty_midi_obj. Returning empty list.")
        return []
    
    note_seq = midi_to_note_sequence(pretty_midi_obj)
    note_seq_json = MessageToJson(note_seq)

    # return note_seq_json
    return note_seq_json

# --- FastAPI Endpoints ---

# LOCAL TESTING AUDIO
# LOCAL_TEST_AUDIO_PATH = '/Users/kotula/code/Muse/Note-Detection-Backend/Sound-Samples/1375__sleep__90_bpm_nylon2.wav'
# LOCAL_TEST_AUDIO_PATH = '/Users/kotula/code/Muse/Note-Detection-Backend/Sound-Samples/latin-hip-hop-acoustic-guitar-harmony_110bpm_E_minor.wav'
# LOCAL_TEST_AUDIO_PATH = '/Users/kotula/code/Muse/Note-Detection-Backend/Sound-Samples/guitar-pack-riff.wav'
# LOCAL_TEST_AUDIO_PATH = '/Users/kotula/code/Muse/Note-Detection-Backend/Sound-Samples/piano-chord-melody_126bpm_A_minor.wav'
# LOCAL_TEST_AUDIO_PATH = '/Users/kotula/code/Muse/Note-Detection-Backend/Sound-Samples/rhodes-keys-chord-c-major_C_major.wav'

@app.websocket("/audio_to_note_seq")
async def websocket_audio_to_note_seq(websocket: WebSocket, bpm: int=Query(120)):
    """
    WebSocket endpoint for receiving audio streams, processing them with basic-pitch,
    and sending back MIDI data.
    """
    await websocket.accept()
    logger.info(f"WebSocket connection established. BPM = {bpm}")

    # Buffer for accumulating user audio input
    audio_buffer = io.BytesIO()

    try:
        while True:
            message = await websocket.receive() # Receive any type of message

            # Accumulates audio input
            if "bytes" in message:
                audio_chunk = message["bytes"]
                audio_buffer.write(audio_chunk)
                print(f"Received audio chunk: {len(audio_chunk)} bytes. Total buffered: {audio_buffer.tell()} bytes.")

            # Processes audio once audio recording stops at the end of certain number of measures
            elif "text" in message:
                text_message = message["text"]
                logger.info(f"Received text message: {text_message}")
                if text_message == "END_OF_AUDIO":
                    logger.info("End of audio signal received. Closing buffer.")
                    
                    # Read all audio from buffer and convert it to MIDI using basic-pitch model
                    audio_buffer.seek(0) # Reset pointer

                    # Must convert WEBM audio to PCM
                    final_audio_data = AudioSegment.from_file(
                        audio_buffer, 
                        format='webm', 
                        frame_rate=SAMPLE_RATE, 
                        channels=CHANNELS, 
                        sample_width=2
                    )

                    # Saves audio to file that can be sent to basic-pitch model
                    final_audio_data.export(USER_AUDIO_PATH, format="wav")

                    if final_audio_data and BP_MODEL:
                        logger.info(f"Processing final {len(final_audio_data)} bytes...")
                        _, final_midi_data, _ = await asyncio.to_thread(
                            predict, USER_AUDIO_PATH, BP_MODEL, midi_tempo=bpm
                        )
                        final_midi_json = midi_to_json(final_midi_data)
                        if final_midi_json:
                            await websocket.send_json(final_midi_json)
                            logger.info(f"Sent final {len(final_midi_json)} MIDI events.")
                    
                    audio_buffer.truncate(0) # Clear the buffer
                    audio_buffer.seek(0) # Reset pointer after clearing

            elif message["type"] == "websocket.disconnect":
                logger.info("WebSocket disconnected gracefully.")
                break # Exit the loop on disconnect

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected by client.")
    except Exception as e:
        logger.error(f"WebSocket error: {e}", exc_info=True)
        # Attempt to send an error message before closing
        try:
            await websocket.send_json({"error": f"Server error: {e}"})
        except RuntimeError:
            logger.warning("Could not send error message to disconnected client.")
    finally:
        # Clean up resources if necessary
        audio_buffer.close()
        logger.info("WebSocket connection closed and resources cleaned up.")
    

# @app.post("/process-local-audio")
# async def process_local_audio(data: BPMInput):
#     # Get bpm data from API call
#     bpm = data.bpm
#     print("Received bpm from client: ", bpm)

#     """
#     Processes a hardcoded local audio file with basic-pitch and returns MIDI data.
#     This is for testing server-side processing without needing a file upload.
#     """
#     if not BP_MODEL:
#         raise HTTPException(
#             status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
#             detail="Basic-Pitch model is not loaded on the server."
#         )

#     if not os.path.exists(LOCAL_TEST_AUDIO_PATH):
#         logger.error(f"Local test audio file not found at: {LOCAL_TEST_AUDIO_PATH}")
#         raise HTTPException(
#             status_code=status.HTTP_404_NOT_FOUND,
#             detail=f"Local test audio file not found at '{LOCAL_TEST_AUDIO_PATH}'. Please update LOCAL_TEST_AUDIO_PATH in main.py."
#         )

#     logger.info(f"Processing local audio file: {LOCAL_TEST_AUDIO_PATH} with basic-pitch...")

#     try:
#         print("BPM FOR PROCESSING: ", bpm)
#         # Read the local audio file directly
#         # basic-pitch's predict can take a file path string
#         _, midi_data, _ = await asyncio.to_thread(
#             predict, LOCAL_TEST_AUDIO_PATH, BP_MODEL, midi_tempo=bpm # need to get bpm from request body
#         )
        
#         midi_json = midi_to_json(midi_data)
#         logger.info(f"Finished processing local file. Detected {len(midi_json)} MIDI events.")
#         logger.warning(midi_json)
        
#         return JSONResponse(content={"source_file": LOCAL_TEST_AUDIO_PATH, "midi_data": midi_json})

#     except Exception as e:
#         logger.error(f"Error processing local audio file '{LOCAL_TEST_AUDIO_PATH}': {e}", exc_info=True)
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail=f"Failed to process local audio: {e}"
#         )
#         return []
    
# This must be the LAST route defined in your FastAPI app.
# It ensures that if no other API route matches, FastAPI will serve
# your React app's index.html, allowing React Router to handle the path.
@app.get("/{full_path:path}")
async def serve_react_app(full_path: str):
    """
    Serves the React app's index.html for all unmatched paths,
    enabling client-side routing.
    """
    index_html_path = os.path.join(FRONTEND_BUILD_DIR, "index.html")
    if os.path.exists(index_html_path):
        logger.info(f"Serving React app's index.html for path: /{full_path}")
        return FileResponse(index_html_path)
    else:
        logger.error(f"index.html not found at {index_html_path}. Cannot serve React app.")
        raise HTTPException(status_code=404, detail="Frontend not found.")

# --- Run the FastAPI application ---
# This block ensures Uvicorn runs the FastAPI app when main.py is executed directly.
if __name__ == "__main__":
    import uvicorn # Ensure uvicorn is imported here
    print("Attempting to run FastAPI server directly using uvicorn.run()...") # Added print statement
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
    print("FastAPI server stopped.") # This will only print after server is shut down (e.g., Ctrl+C)
