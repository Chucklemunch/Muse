from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
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
LOCAL_TEST_AUDIO_PATH = '/Users/kotula/code/Muse/Note-Detection-Backend/Sound-Samples/1375__sleep__90_bpm_nylon2.wav'

@app.websocket("/audio_to_note_seq")
async def websocket_audio_to_note_seq(websocket: WebSocket):
    """
    WebSocket endpoint for receiving audio streams, processing them with basic-pitch,
    and sending back MIDI data.
    """
    await websocket.accept()
    logger.info("WebSocket connection established.")

    # Buffer to accumulate audio chunks
    # basic-pitch's predict expects a file-like object or path.
    # We'll accumulate bytes and pass them to basic-pitch.
    audio_buffer = io.BytesIO()

    try:
        while True:
            message = await websocket.receive() # Receive any type of message

            if "bytes" in message:
                audio_chunk = message["bytes"]
                audio_buffer.write(audio_chunk)
                logger.debug(f"Received audio chunk: {len(audio_chunk)} bytes. Total buffered: {audio_buffer.tell()} bytes.")

                # --- Real-time Processing Strategy ---
                # For basic-pitch, it's often best to process a segment of audio
                # rather than tiny chunks. You might accumulate for a few seconds
                # or process on a fixed interval.
                # For this example, let's process every time a chunk arrives,
                # but in a real-time scenario, you'd want a more sophisticated
                # buffering and processing logic (e.g., process every 1-2 seconds of audio).

                # Ensure we have enough audio to process (e.g., at least 1 second)
                # This is a simple heuristic; a more robust solution would track audio duration.
                # Assuming 44.1 kHz, 16-bit mono PCM: 44100 * 2 bytes/sample = 88200 bytes/sec
                # If using webm, size will vary. basic-pitch resamples to 22050 Hz internally.
                # Let's process if we have at least 0.5 seconds of audio (approx. 44KB for raw 44.1kHz)
                # Given the frontend sends every 500ms, this is a good trigger.
                
                # IMPORTANT: basic-pitch's predict expects the entire audio content.
                # It does not have a "streaming" API where you feed it chunks incrementally.
                # So, we pass the *entire* accumulated buffer each time.
                # This means it re-processes already processed audio, which is inefficient
                # for long streams but simple for a demo.
                
                # For true efficient real-time, you'd need to:
                # 1. Implement a sliding window buffer.
                # 2. Call basic-pitch on the *newest portion* of the window.
                # 3. Handle overlapping predictions and merge MIDI.
                # This is complex and beyond a simple example.
                # For now, we'll process the full accumulated buffer.

                # Only attempt predict if the model is loaded
                if BP_MODEL:
                    # Move buffer pointer to the beginning to read all content
                    audio_buffer.seek(0)
                    
                    # Read all accumulated bytes for basic-pitch
                    audio_data_for_bp = audio_buffer.read()

                    if len(audio_data_for_bp) > 0:
                        logger.debug(f"Processing {len(audio_data_for_bp)} bytes with basic-pitch...")
                        
                        # Run basic-pitch in a separate thread to avoid blocking the event loop
                        # predict is a synchronous (blocking) function.
                        # asyncio.to_thread() offloads it to a thread pool.
                        try:
                            # basic-pitch returns (model_output, midi_data, note_events)
                            # We are interested in midi_data 
                            _, midi_file, _ = await asyncio.to_thread(
                                predict, audio_data_for_bp, BP_MODEL
                            )
                            
                            # Check if basic-pitch returns something
                            if midi_file is None:
                                logger.warning("midi_to_json received None for midi_file. Returning empty list.")
                                return []
                            
                            # Convert pretty_midi.PrettyMIDI to JSON-serializable format
                            note_seq = midi_to_note_sequence(midi_file)
                            note_seq_json = MessageToJson(note_seq)
                            
                            
                            if note_seq_json: # Only send if there's actual MIDI data
                                await websocket.send_json(note_seq_json)
                                logger.info(f"Sent {len(note_seq_json)} MIDI events to frontend.")
                            else:
                                logger.debug("No MIDI events detected in this segment.")

                        except Exception as e:
                            logger.error(f"Error during basic-pitch inference: {e}", exc_info=True)
                            await websocket.send_json({"error": f"Backend processing error: {e}"})
                else:
                    logger.warning("Basic-Pitch model not loaded, skipping audio processing.")
                    await websocket.send_json({"error": "Basic-Pitch model not loaded on backend."})

            elif "text" in message:
                text_message = message["text"]
                logger.info(f"Received text message: {text_message}")
                if text_message == "END_OF_AUDIO":
                    logger.info("End of audio signal received. Closing buffer.")
                    # Optionally, perform final processing on remaining audio_buffer content
                    # before clearing or closing.
                    audio_buffer.seek(0) # Reset pointer
                    final_audio_data = audio_buffer.read()
                    if final_audio_data and BP_MODEL:
                        logger.info(f"Processing final {len(final_audio_data)} bytes...")
                        _, final_midi_file, _ = await asyncio.to_thread(
                            predict, final_audio_data, BP_MODEL
                        )
                        final_midi_json = midi_to_json(final_midi_file)
                        if final_midi_json:
                            await websocket.send_json(final_midi_json)
                            logger.info(f"Sent final {len(final_midi_json)} MIDI events.")
                    
                    audio_buffer.truncate(0) # Clear the buffer
                    audio_buffer.seek(0) # Reset pointer after clearing
                    # You might choose to break the loop here if it's a one-shot connection per audio file
                    # For continuous jamming, you might keep the connection open.
                    # For this example, we keep it open until client disconnects.

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
    

@app.post("/process-local-audio")
async def process_local_audio(data: BPMInput):
    # Get bpm data from API call
    bpm = data.bpm
    print("Received bpm from client: ", bpm)

    """
    Processes a hardcoded local audio file with basic-pitch and returns MIDI data.
    This is for testing server-side processing without needing a file upload.
    """
    if not BP_MODEL:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Basic-Pitch model is not loaded on the server."
        )

    if not os.path.exists(LOCAL_TEST_AUDIO_PATH):
        logger.error(f"Local test audio file not found at: {LOCAL_TEST_AUDIO_PATH}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Local test audio file not found at '{LOCAL_TEST_AUDIO_PATH}'. Please update LOCAL_TEST_AUDIO_PATH in main.py."
        )

    logger.info(f"Processing local audio file: {LOCAL_TEST_AUDIO_PATH} with basic-pitch...")

    try:
        # Read the local audio file directly
        # basic-pitch's predict can take a file path string
        _, midi_file, _ = await asyncio.to_thread(
            predict, LOCAL_TEST_AUDIO_PATH, BP_MODEL, midi_tempo=bpm # need to get bpm from request body
        )
        
        midi_json = midi_to_json(midi_file)
        logger.info(f"Finished processing local file. Detected {len(midi_json)} MIDI events.")
        logger.warning(midi_json)
        
        return JSONResponse(content={"source_file": LOCAL_TEST_AUDIO_PATH, "midi_data": midi_json})

    except Exception as e:
        logger.error(f"Error processing local audio file '{LOCAL_TEST_AUDIO_PATH}': {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process local audio: {e}"
        )
        return []
    
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
