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

// Define types for log messages displayed in the UI
interface LogEntry {
  message: string;
  type: 'info' | 'success' | 'error' | 'warning' | 'midi' | 'debug';
  timestamp: string;
}

const AudioToMidiClient: React.FC = () => {
  // State for UI and connection status
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [messages, setMessages] = useState<LogEntry[]>([]); // To display logs and MIDI data
  const [error, setError] = useState<string | null>(null);

  // Refs to hold mutable objects that don't trigger re-renders
  // Explicitly type the ref's current value (e.g., WebSocket | null)
  const ws = useRef<WebSocket | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioStream = useRef<MediaStream | null>(null);

  // --- UI Logging Function ---
  const logMessage = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    setMessages((prevMessages) => {
      const newMessages = [...prevMessages, { message, type, timestamp: new Date().toLocaleTimeString() }];
      return newMessages.slice(-50); // Keep only the last 50 messages
    });
  }, []); // No dependencies, so this function is stable

  // --- WebSocket Connection Logic ---
  const connectWebSocket = useCallback(() => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      logMessage('WebSocket is already connected.', 'info');
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws.current = new WebSocket(`${protocol}//${window.location.host}/ws/audio_to_midi`);

    ws.current.onopen = () => {
      setIsConnected(true);
      logMessage('WebSocket Connected!', 'success');
      setError(null);
    };

    ws.current.onmessage = (event: MessageEvent) => {
      try {
        const data: BackendMidiResponse | BackendStatusMessage | BackendError = JSON.parse(event.data);

        if ('midi_data' in data) { // Check if it's a MIDI response
          logMessage(`Received MIDI data: ${JSON.stringify(data.midi_data.slice(0, 5))}...`, 'midi');
          // TODO: Integrate with Magenta.js here
          // Example: YourMagentaPlayer.playMidiEvents(data.midi_data);
        } else if ('status' in data) { // Check if it's a status message
          logMessage(data.message, 'warning');
        } else if ('error' in data) { // Check if it's an error message
          logMessage(`Backend Error: ${data.error}`, 'error');
        } else {
          logMessage(`Received: ${event.data}`, 'info');
        }
      } catch (e: any) { // Use 'any' for caught error if type is uncertain, or narrow it down
        logMessage(`Failed to parse message: ${event.data}. Error: ${e.message}`, 'error');
      }
    };

    ws.current.onclose = (event: CloseEvent) => {
      setIsConnected(false);
      setIsRecording(false); // Stop recording if WS closes
      logMessage(`WebSocket Disconnected: Code ${event.code}, Reason: ${event.reason || 'No reason'}`, 'error');
    };

    ws.current.onerror = (err: Event) => { // Event type for onerror is generic Event
      setError('WebSocket Error. Check console for details.');
      logMessage(`WebSocket Error: ${err.type || 'Unknown error'}`, 'error'); // err.message might not exist on generic Event
      console.error('WebSocket Error:', err);
    };
  }, [logMessage]); // Dependency on logMessage, which is stable due to useCallback

  const stopRecording = useCallback(() => {
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
      setIsRecording(false);
    }
    // Stop all tracks in the media stream to release microphone
    if (audioStream.current) {
      audioStream.current.getTracks().forEach(track => track.stop());
      audioStream.current = null; // Clear the stream reference
    }
  }, []);

  const disconnectWebSocket = useCallback(() => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.close();
      stopRecording(); // Ensure recording stops
    }
  }, [stopRecording]);

  // Effect to manage WebSocket connection lifecycle
  useEffect(() => {
    // Optional: Connect automatically on component mount
    // connectWebSocket();

    // Cleanup function: runs when component unmounts or dependencies change
    return () => {
      if (ws.current) {
        ws.current.close();
      }
      stopRecording(); // Ensure microphone is released
    };
  }, [connectWebSocket, stopRecording]); // Dependencies for cleanup effect

  // --- Microphone and Recording Logic ---
  const startRecording = async () => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      setError('WebSocket is not connected. Please connect first.');
      logMessage('Cannot start recording: WebSocket not connected.', 'error');
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
      logMessage(`Using MIME type for recording: ${mimeType}`, 'info');

      const options: MediaRecorderOptions = { mimeType: mimeType };
      mediaRecorder.current = new MediaRecorder(audioStream.current, options);

      mediaRecorder.current.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0 && ws.current && ws.current.readyState === WebSocket.OPEN) {
          ws.current.send(event.data); // Send audio Blob directly
          logMessage(`Sent audio chunk (${event.data.size} bytes)`, 'debug');
        }
      };

      mediaRecorder.current.onstop = () => {
        logMessage('Recording stopped.', 'info');
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
          ws.current.send("END_OF_AUDIO"); // Custom signal
          logMessage("Sent END_OF_AUDIO signal.", 'debug');
        }
        // Microphone stream is stopped in stopRecording cleanup
      };

      mediaRecorder.current.start(500); // dataavailable event fires every 500ms
      setIsRecording(true);
      logMessage('Recording started...', 'success');
      setError(null);

    } catch (err: any) {
      setError(`Error accessing microphone: ${err.message}`);
      logMessage(`Error accessing microphone: ${err.message}`, 'error');
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
      </div>

      <h2 style={{ color: '#2c3e50', marginBottom: '15px' }}>Messages:</h2>
      <div style={{ border: '1px solid #ddd', padding: '15px', minHeight: '200px', maxHeight: '400px', overflowY: 'auto', backgroundColor: '#e9ecef', borderRadius: '8px', fontSize: '14px', lineHeight: '1.5' }}>
        {messages.map((msg, index) => (
          <p key={index} style={{
            marginBottom: '8px',
            paddingBottom: '8px',
            borderBottom: index < messages.length - 1 ? '1px dashed #ccc' : 'none',
            color: msg.type === 'error' ? '#dc3545' : (msg.type === 'success' ? '#28a745' : (msg.type === 'midi' ? '#007bff' : (msg.type === 'warning' ? '#ffc107' : '#333')))
          }}>
            <span style={{ fontWeight: 'bold', marginRight: '5px' }}>[{msg.timestamp}]</span> {msg.message}
          </p>
        ))}
      </div>
    </div>
  );
};

export default AudioToMidiClient;