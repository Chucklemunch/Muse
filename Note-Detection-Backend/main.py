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

# Initialize FastAPI application
app = FastAPI()

origins = [
    "http://localhost:5173", # React server port with Vite
	"http://muse.charliekotula.com" # Where Muse is hosted
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
FRONTEND_BUILD_DIR = "/Users/kotula/code/Muse/muse-app/dist" # Local development
# FRONTEND_BUILD_DIR = "/var/www/Muse/muse-app/dist" # Deployment on server

# Mount the directory containing your static assets.
app.mount("/assets", StaticFiles(directory=FRONTEND_BUILD_DIR + "/assets"), name="assets")

# Audio information
USER_AUDIO_PATH = "user_audio.wav"
SAMPLE_RATE = 48000
SAMPLE_WIDTH = 2 # PCM16: 16 bits / 8 (bits/byte) = 2
CHANNELS = 1

# Load Basic-Pitch Model 
BP_MODEL = None
try:
    BP_MODEL = Model(ICASSP_2022_MODEL_PATH)
except Exception as e:
    print(f"Failed to load Basic-Pitch model: {e}")


# --- Helper function to convert pretty_midi.PrettyMIDI to a JSON-serializable format ---
def midi_to_json(pretty_midi_obj: pretty_midi.PrettyMIDI):
    """
    Converts a pretty_midi.PrettyMIDI object into a JSON-serializable list of note events.
    Each note event includes start_time, end_time, pitch, and velocity.
    Returns an empty list if pretty_midi_obj is None or has no notes.
    """
    if pretty_midi_obj is None:
        print("midi_to_json received None for pretty_midi_obj. Returning empty list.")
        return []
    
    note_seq = midi_to_note_sequence(pretty_midi_obj)
    note_seq_json = MessageToJson(note_seq)

    # return note_seq_json
    return note_seq_json

# Endpoint for processing user audio
@app.websocket("/audio_to_note_seq")
async def websocket_audio_to_note_seq(websocket: WebSocket, bpm: int=Query(120)):
    await websocket.accept()

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
                if text_message == "END_OF_AUDIO":
                    print("text message received: ", text_message)                    
                    
                    # Read all audio from buffer and convert it to MIDI using basic-pitch model
                    audio_buffer.seek(0) # Reset pointer
                    raw_bytes = audio_buffer.getvalue()
                    print('raw bytes len: ', len(raw_bytes))

                    # Must convert audio to file
                    final_audio_data = AudioSegment(
                        data=raw_bytes,
                        frame_rate=SAMPLE_RATE, 
                        channels=CHANNELS, 
                        sample_width=SAMPLE_WIDTH
                    )                    
                    
                    # Saves audio to file that can be sent to basic-pitch model
                    final_audio_data.export(USER_AUDIO_PATH, format="wav")

                    if final_audio_data and BP_MODEL:
                        _, final_midi_data, _ = await asyncio.to_thread(
                            predict, USER_AUDIO_PATH, BP_MODEL, midi_tempo=bpm
                        )
                        final_midi_json = midi_to_json(final_midi_data)
                        if final_midi_json:
                            await websocket.send_json(final_midi_json)
                    
                    audio_buffer.truncate(0) # Clear the buffer
                    audio_buffer.seek(0) # Reset pointer after clearing

            elif message["type"] == "websocket.disconnect":
                break # Exit the loop on disconnect

    except WebSocketDisconnect:
        print("WebSocket disconnected by client.")
    except Exception as e:
        print(f"WebSocket error: {e}")
        # Attempt to send an error message before closing
        try:
            await websocket.send_json({"error": f"Server error: {e}"})
        except RuntimeError:
            print("Could not send error message to disconnected client.")
    finally:
        # Clean up resources if necessary
        audio_buffer.close()
    
# Ensures that if no other API route matches, FastAPI will serve
# your React app's index.html, allowing React Router to handle the path.
@app.get("/{full_path:path}")
async def serve_react_app(full_path: str):
    """
    Serves the React app's index.html for all unmatched paths,
    enabling client-side routing.
    """
    index_html_path = os.path.join(FRONTEND_BUILD_DIR, "index.html")
    if os.path.exists(index_html_path):
        print(f"Serving React app's index.html for path: /{full_path}")
        return FileResponse(index_html_path)
    else:
        print(f"index.html not found at {index_html_path}. Cannot serve React app.")
        raise HTTPException(status_code=404, detail="Frontend not found.")

# Run the FastAPI application
if __name__ == "__main__":
    import uvicorn # Ensure uvicorn is imported here
    print("Attempting to run FastAPI server directly using uvicorn.run()...")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
    print("FastAPI server stopped.")
