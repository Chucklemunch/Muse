import React, { useState, useRef, useEffect, useCallback } from 'react';

// Define types for MIDI data structure
interface MidiNoteEvent {
  type: 'note';
  start_time: number;
  end_time: number;
  duration: number;
  pitch: number;
  velocity: number;
}

interface BackendStatusMessage {
  status: string;
  message: string;
}

interface BackendError {
  error: string;
}

interface BackendMidiResponse {
  filename?: string; // For file upload endpoint
  source_file?: string; // For local file endpoint
  midi_data: MidiNoteEvent[];
  status?: string; // 'success', 'no_notes_detected'
}


// IMPORTANT: Adjust this if your FastAPI server is running on a different host or port.
// For local development, it's typically http://localhost:8000
const FASTAPI_BASE_URL = "http://localhost:8000";
// For WebSocket, convert http:// to ws:// or https:// to wss://
const FASTAPI_WS_PROTOCOL = FASTAPI_BASE_URL.startsWith("https://") ? "wss://" : "ws://";
const FASTAPI_WS_HOST = FASTAPI_BASE_URL.replace(/https?:\/\//, ''); // Remove protocol for host part
const FASTAPI_WS_URL = `${FASTAPI_WS_PROTOCOL}${FASTAPI_WS_HOST}/audio_to_midi`;
const FASTAPI_WS_PROCESS_LOCAL_AUDIO = `${FASTAPI_BASE_URL}/process-local-audio`;

const useAudioToMidiClient= () => {
  // State for UI and connection status
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const[isAudioProcessed, setIsAudioProcessed] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Refs to hold mutable objects that don't trigger re-renders
  // Explicitly type the ref's current value (e.g., WebSocket | null)
  const ws = useRef<WebSocket | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioStream = useRef<MediaStream | null>(null);

  // -- Testing Audio Processing Using File Path in Backend --
  const processLocalAudio = useCallback(async () => {
      const result: BackendMidiResponse = await fetch(FASTAPI_WS_PROCESS_LOCAL_AUDIO).then((response) => (response.json()));
      console.log('process local audio response: ', result);
      setIsAudioProcessed(true);
    }
  )

  // --- WebSocket Connection Logic ---
  const connectWebSocket = useCallback(() => {
    // Use the explicitly defined WebSocket URL for FastAPI
    ws.current = new WebSocket(FASTAPI_WS_URL);

    ws.current.onopen = () => {
      setIsConnected(true);
      console.log('WebSocket Connected!', 'success');
      setError(null);
    };

    ws.current.onmessage = (event: MessageEvent) => {
      try {
        const data: BackendMidiResponse | BackendStatusMessage | BackendError = JSON.parse(event.data);

        if ('midi_data' in data) { // Check if it's a MIDI response
          console.log(`Received MIDI data: ${JSON.stringify(data.midi_data.slice(0, 5))}...`, 'midi');
          // TODO: Integrate with Magenta.js here
          // Example: YourMagentaPlayer.playMidiEvents(data.midi_data);
        } else if ('status' in data) { // Check if it's a status message
          console.log(data.message, 'warning');
        } else if ('error' in data) { // Check if it's an error message
          console.log(`Backend Error: ${data.error}`, 'error');
        } else {
          console.log(`Received: ${event.data}`, 'info');
        }
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.log(`Failed to parse message: ${event.data}. Error: ${errorMessage}`, 'error');
        console.error('WebSocket message parsing error:', e);
      }
    };

    ws.current.onclose = (event: CloseEvent) => {
      setIsConnected(false);
      setIsRecording(false); // Stop recording if WS closes
      console.log(`WebSocket Disconnected: Code ${event.code}, Reason: ${event.reason || 'No reason'}`, 'error');
    };

    ws.current.onerror = (err: Event) => {
      setError('WebSocket Error. Check console for details.');
      console.log(`WebSocket Error: ${err.type || 'Unknown error'}`, 'error');
      console.error('WebSocket Error:', err);
    };
  });

  const stopRecording = useCallback(() => {
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
      setIsRecording(false);
    }
    if (audioStream.current) {
      audioStream.current.getTracks().forEach(track => track.stop());
      audioStream.current = null;
    }
  }, []);

  const disconnectWebSocket = useCallback(() => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.close();
      stopRecording();
    }
  }, [stopRecording]);

  useEffect(() => {
    return () => {
      if (ws.current) {
        ws.current.close();
      }
      stopRecording();
    };
  }, [connectWebSocket, stopRecording]);

  // --- Microphone and Recording Logic ---
  const startRecording = async () => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      setError('WebSocket is not connected. Please connect first.');
      console.log('Cannot start recording: WebSocket not connected.', 'error');
      return;
    }

    try {
      audioStream.current = await navigator.mediaDevices.getUserMedia({ audio: true });

      let mimeType = 'audio/webm';
      const preferredMimeTypes = ['audio/webm;codecs=pcm', 'audio/wav'];
      for (const type of preferredMimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          break;
        }
      }
      console.log(`Using MIME type for recording: ${mimeType}`, 'info');

      const options: MediaRecorderOptions = { mimeType: mimeType };
      mediaRecorder.current = new MediaRecorder(audioStream.current, options);

      mediaRecorder.current.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0 && ws.current && ws.current.readyState === WebSocket.OPEN) {
          ws.current.send(event.data);
          console.log(`Sent audio chunk (${event.data.size} bytes)`, 'debug');
        }
      };

      mediaRecorder.current.onstop = () => {
        console.log('Recording stopped.', 'info');
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
          ws.current.send("END_OF_AUDIO");
          console.log("Sent END_OF_AUDIO signal.", 'debug');
        }
      };

      mediaRecorder.current.start(500);
      setIsRecording(true);
      console.log('Recording started...', 'success');
      setError(null);

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Error accessing microphone: ${errorMessage}`);
      console.log(`Error accessing microphone: ${errorMessage}`, 'error');
      console.error('Microphone access error:', err);
    }
  };

  // --- Render UI ---
  return (
    <div style={{ fontFamily: 'Inter, sans-serif', maxWidth: '800px', margin: '20px auto', padding: '20px', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
      <h1 style={{ color: '#2c3e50', textAlign: 'center', marginBottom: '20px' }}>React Audio to MIDI Client</h1>
      <p style={{ textAlign: 'center', marginBottom: '30px', color: '#555' }}>
        Connects to FastAPI WebSocket, streams microphone audio, and displays received MIDI data.
      </p>

      {error && <div style={{ color: '#dc3545', fontWeight: 'bold', textAlign: 'center', marginBottom: '15px' }}>Error: {error}</div>}

      <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '30px' }}>
        <button
          onClick={connectWebSocket}
          disabled={isConnected}
          style={{ backgroundColor: isConnected ? '#cccccc' : '#28a745', color: 'white' }}
        >
          {isConnected ? 'Connected' : 'Connect WebSocket'}
        </button>
        <button
          onClick={disconnectWebSocket}
          disabled={!isConnected}
          style={{ backgroundColor: !isConnected ? '#cccccc' : '#dc3545', color: 'white' }}
        >
          Disconnect WebSocket
        </button>
        <button
          onClick={startRecording}
          disabled={!isConnected || isRecording}
          style={{ backgroundColor: (!isConnected || isRecording) ? '#cccccc' : '#28a745', color: 'white' }}
        >
          {isRecording ? 'Recording...' : 'Start Recording'}
        </button>
        <button
          onClick={stopRecording}
          disabled={!isRecording}
          style={{ backgroundColor: !isRecording ? '#cccccc' : '#dc3545', color: 'white' }}
        >
          Stop Recording
        </button>
        <button
          onClick={processLocalAudio}
          disabled={isAudioProcessed}
          style={{ backgroundColor: isAudioProcessed ? '#cccccc' : '#28a745', color: 'white' }}
        >
          {isAudioProcessed ? 'Local Audio Processed' : 'Process Local Audio'}
        </button>
      </div>
    </div>
  );
};

export default useAudioToMidiClient;