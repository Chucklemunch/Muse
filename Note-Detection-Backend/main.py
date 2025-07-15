# main.py

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException, status
from fastapi.responses import HTMLResponse, JSONResponse
from basic_pitch.inference import predict, Model
from basic_pitch import ICASSP_2022_MODEL_PATH
import uvicorn
import os
import asyncio
import io
import logging
import numpy as np
import pretty_midi # basic-pitch returns pretty_midi.PrettyMIDI objects, useful for conversion

# Configure logging for better visibility in the console
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Initialize FastAPI application
app = FastAPI()

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

    midi_events = []
    # pretty_midi organizes notes by instrument
    for instrument in pretty_midi_obj.instruments:
        for note in instrument.notes:
            midi_events.append({
                "type": "note", # Or "note_on" and "note_off" if you prefer
                "start_time": float(note.start),
                "end_time": float(note.end),
                "duration": float(note.end - note.start),
                "pitch": int(note.pitch), # MIDI pitch number (0-127)
                "velocity": int(note.velocity) # MIDI velocity (0-127)
            })
    
    # Sort events by start time for chronological playback on frontend
    midi_events.sort(key=lambda x: x['start_time'])

    return midi_events

# --- HTML Content for the Root Endpoint (Frontend for testing) ---
# This serves a simple HTML page that includes JavaScript for WebSocket communication
# and microphone access. In a production environment, this would typically be
# served by a dedicated frontend server or a separate static files configuration.
html_content = """
<!DOCTYPE html>
<html>
    <head>
        <title>FastAPI Audio Stream to MIDI</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { font-family: 'Inter', sans-serif; margin: 20px; background-color: #f0f4f8; color: #333; }
            .container { max-width: 800px; margin: 0 auto; padding: 20px; background-color: #fff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
            h1 { color: #2c3e50; text-align: center; margin-bottom: 20px; }
            p { text-align: center; margin-bottom: 30px; color: #555; }
            .button-group { display: flex; justify-content: center; gap: 15px; margin-bottom: 30px; }
            button {
                padding: 12px 25px;
                font-size: 16px;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.3s ease;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                font-weight: bold;
            }
            button:hover { transform: translateY(-2px); box-shadow: 0 6px 10px rgba(0,0,0,0.15); }
            button:active { transform: translateY(0); box-shadow: 0 2px 4px rgba(0,0,0,0.1); }

            #connectWs, #startRecord { background-color: #28a745; color: white; }
            #connectWs:hover, #startRecord:hover { background-color: #218838; }
            #disconnectWs, #stopRecord { background-color: #dc3545; color: white; }
            #disconnectWs:hover, #stopRecord:hover { background-color: #c82333; }
            button:disabled { background-color: #cccccc; cursor: not-allowed; box-shadow: none; }

            #messages {
                border: 1px solid #ddd;
                padding: 15px;
                min-height: 200px;
                max-height: 400px;
                overflow-y: auto;
                margin-top: 20px;
                background-color: #e9ecef;
                border-radius: 8px;
                font-size: 14px;
                line-height: 1.5;
            }
            .message-entry { margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px dashed #ccc; }
            .message-entry:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
            .midi-event { color: #007bff; font-weight: bold; }
            .error-message { color: #dc3545; font-weight: bold; }
            .info-message { color: #28a745; }
            .debug-message { color: #6c757d; font-style: italic; }

            @media (max-width: 600px) {
                .button-group { flex-direction: column; }
                button { width: 100%; }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>FastAPI Audio to MIDI with WebSockets</h1>
            <p>Stream audio from your microphone to the backend, process with basic-pitch, and receive MIDI data back.</p>

            <div class="button-group">
                <button id="connectWs">Connect WebSocket</button>
                <button id="disconnectWs" disabled>Disconnect WebSocket</button>
                <button id="startRecord" disabled>Start Recording</button>
                <button id="stopRecord" disabled>Stop Recording</button>
            </div>

            <h2>Messages:</h2>
            <div id="messages"></div>
        </div>

        <script>
            let ws;
            let mediaRecorder;
            let audioChunks = [];
            const messagesDiv = document.getElementById('messages');
            const connectWsBtn = document.getElementById('connectWs');
            const disconnectWsBtn = document.getElementById('disconnectWs');
            const startRecordBtn = document.getElementById('startRecord');
            const stopRecordBtn = document.getElementById('stopRecord');

            function logMessage(message, className = '') {
                const p = document.createElement('p');
                p.textContent = message;
                p.className = 'message-entry ' + className;
                messagesDiv.appendChild(p);
                messagesDiv.scrollTop = messagesDiv.scrollHeight;
            }

            connectWsBtn.onclick = () => {
                if (ws && ws.readyState === WebSocket.OPEN) {
                    logMessage('WebSocket already connected.', 'info-message');
                    return;
                }
                // Use wss:// for HTTPS, ws:// for HTTP
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                ws = new WebSocket(`${protocol}//${window.location.host}/ws/audio_to_midi`);

                ws.onopen = (event) => {
                    logMessage('WebSocket connected!', 'info-message');
                    connectWsBtn.disabled = true;
                    disconnectWsBtn.disabled = false;
                    startRecordBtn.disabled = false;
                };

                ws.onmessage = (event) => {
                    try {
                        const midiData = JSON.parse(event.data);
                        logMessage(`Received MIDI: ${JSON.stringify(midiData)}`, 'midi-event');
                        // In a real app, you'd feed this midiData to Magenta.js here
                        // Example: If you have a Magenta.js model loaded:
                        // playMidiDataWithMagenta(midiData);
                    } catch (e) {
                        logMessage(`Error parsing MIDI data: ${e.message}. Raw: ${event.data}`, 'error-message');
                    }
                };

                ws.onclose = (event) => {
                    logMessage(`WebSocket disconnected. Code: ${event.code}, Reason: ${event.reason}`, 'error-message');
                    connectWsBtn.disabled = false;
                    disconnectWsBtn.disabled = true;
                    startRecordBtn.disabled = true;
                    stopRecordBtn.disabled = true;
                };

                ws.onerror = (error) => {
                    logMessage('WebSocket Error: ' + error.message, 'error-message');
                    console.error('WebSocket Error:', error);
                };
            };

            disconnectWsBtn.onclick = () => {
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.close();
                }
            };

            startRecordBtn.onclick = async () => {
                if (!ws || ws.readyState !== WebSocket.OPEN) {
                    logMessage('WebSocket not connected. Please connect first.', 'error-message');
                    return;
                }

                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    
                    // Determine the best MIME type for raw audio if possible
                    let mimeType = 'audio/webm'; // Fallback
                    const preferredMimeTypes = ['audio/webm;codecs=pcm', 'audio/wav'];
                    for (const type of preferredMimeTypes) {
                        if (MediaRecorder.isTypeSupported(type)) {
                            mimeType = type;
                            break;
                        }
                    }
                    logMessage(`Using MIME type for recording: ${mimeType}`, 'debug-message');

                    const options = { mimeType: mimeType, sampleRate: 22050 }; // basic-pitch resamples to 22050 Hz
                    mediaRecorder = new MediaRecorder(stream, options);
                    audioChunks = [];

                    mediaRecorder.ondataavailable = (event) => {
                        if (event.data.size > 0) {
                            audioChunks.push(event.data);
                            if (ws && ws.readyState === WebSocket.OPEN) {
                                // Send each chunk as it's available
                                ws.send(event.data);
                                logMessage(`Sent audio chunk (${event.data.byteLength} bytes)`, 'debug-message');
                            } else {
                                logMessage('WebSocket not open, cannot send audio chunk.', 'error-message');
                            }
                        }
                    };

                    mediaRecorder.onstop = () => {
                        logMessage('Recording stopped.');
                        // Send an "END_OF_AUDIO" signal to the backend to indicate no more audio
                        if (ws && ws.readyState === WebSocket.OPEN) {
                            ws.send("END_OF_AUDIO");
                            logMessage("Sent END_OF_AUDIO signal.", 'debug-message');
                        }
                        // Stop all tracks in the media stream
                        stream.getTracks().forEach(track => track.stop());
                    };

                    // Start recording and send data in 500ms chunks
                    mediaRecorder.start(500); // Sends data every 500ms
                    logMessage('Recording started...', 'info-message');
                    startRecordBtn.disabled = true;
                    stopRecordBtn.disabled = false;

                } catch (err) {
                    logMessage('Error accessing microphone: ' + err.message, 'error-message');
                    console.error('Error accessing microphone:', err);
                }
            };

            stopRecordBtn.onclick = () => {
                if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                    mediaRecorder.stop();
                }
                startRecordBtn.disabled = false;
                stopRecordBtn.disabled = true;
            };
        </script>
    </body>
</html>
"""

# --- FastAPI Endpoints ---

# LOCAL TESTING AUDIO
LOCAL_TEST_AUDIO_PATH = '/Users/kotula/code/Muse/Note-Detection-Backend/Sound-Samples/1375__sleep__90_bpm_nylon2.wav'


@app.get("/", response_class=HTMLResponse)
async def get_root():
    """
    Serves the main HTML page for the application.
    This acts as a simple frontend for testing the WebSocket functionality.
    """
    return html_content

@app.websocket("/ws/audio_to_midi")
async def websocket_audio_to_midi(websocket: WebSocket):
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
                            midi_json = midi_to_json(midi_file)
                            
                            if midi_json: # Only send if there's actual MIDI data
                                await websocket.send_json(midi_json)
                                logger.info(f"Sent {len(midi_json)} MIDI events to frontend.")
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
    
@app.get("/process-local-audio/")
async def process_local_audio():
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
            predict, LOCAL_TEST_AUDIO_PATH, BP_MODEL
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

# --- Run the FastAPI application ---
# This block allows you to run the file directly using `python main.py`
# For production, you would typically use `uvicorn main:app` or a process manager.
if __name__ == "__main__":
    # The `reload=True` flag is for development only. Do not use in production.
    # It watches for code changes and restarts the server.
    # `host="0.0.0.0"` makes the server accessible from outside localhost (e.g., other devices on your network).
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
