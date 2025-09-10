import { useState, useRef, useEffect, useCallback } from 'react';
import type { NoteSequence } from '@magenta/music';

// IMPORTANT: Adjust this if your FastAPI server is running on a different host or port.
// For local development, it's typically http://localhost:8000
const FASTAPI_BASE_URL = "http://localhost:8000";
// For WebSocket, convert http:// to ws:// or https:// to wss://
const FASTAPI_WS_PROTOCOL = FASTAPI_BASE_URL.startsWith("https://") ? "wss://" : "ws://";
const FASTAPI_WS_HOST = FASTAPI_BASE_URL.replace(/https?:\/\//, ''); // Remove protocol for host part
const FASTAPI_WS_URL = `${FASTAPI_WS_PROTOCOL}${FASTAPI_WS_HOST}/audio_to_note_seq`;
const FASTAPI_WS_PROCESS_LOCAL_AUDIO = `${FASTAPI_BASE_URL}/process-local-audio`;

export const useAudioToMidiClient =  (bpm: number) => {
  // Defining variable for the NoteSequence that will get passed to the Magenta model
  const basicPitchResult = useRef<NoteSequence>(null);

  // State for UI and connection status
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const[isAudioProcessed, setIsAudioProcessed] = useState<boolean>(false);

  // Refs to hold mutable objects that don't trigger re-renders
  // Explicitly type the ref's current value (e.g., WebSocket | null)
  const ws = useRef<WebSocket | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioStream = useRef<MediaStream | null>(null);

  // -- Testing Audio Processing Using File Path in Backend --
  const processLocalAudio = useCallback(async () => {
      console.log('bpm: ', bpm)
      const basicPitchResultJson = await fetch(FASTAPI_WS_PROCESS_LOCAL_AUDIO, 
        {
          method : "POST",
          headers : {
            "Content-type" : "application/json"
          },
          body : JSON.stringify({ bpm })
        }

      ).then((response) => response.json());
      console.log("basicPitchResultJson: ", basicPitchResultJson)
      basicPitchResult.current = JSON.parse(basicPitchResultJson['midi_data']) as NoteSequence;
      setIsAudioProcessed(true);
    }, [bpm]
  )

  // --- WebSocket Connection Logic ---
  const connectWebSocket = useCallback(() => {
    // Use the explicitly defined WebSocket URL for FastAPI
    ws.current = new WebSocket(`${FASTAPI_WS_URL}?bpm=${bpm}`);

    ws.current.onopen = () => {
      setIsConnected(true);
      console.log('WebSocket Connected!', 'success', `bpm: ${bpm}`);
    };

    ws.current.onmessage = (event: MessageEvent) => {
      console.log('in onmessege');
      try {
        basicPitchResult.current = JSON.parse(event.data);
        console.log('midi json result from basic-pitch')
        console.log(basicPitchResult.current)
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.log(`Failed to parse message: ${event.data}. Error: ${errorMessage}`, 'error');
        console.error('WebSocket message parsing error:', e);
      } 
    };

    ws.current.onclose = (event: CloseEvent) => {
      setIsConnected(false);
      // setIsRecording(false); // Stop recording if WS closes
      console.log(`WebSocket Disconnected: Code ${event.code}, Reason: ${event.reason || 'No reason'}`, 'error');
    };

    ws.current.onerror = (err: Event) => {
      console.log(`WebSocket Error: ${err.type || 'Unknown error'}`, 'error');
      console.error('WebSocket Error:', err);
    };
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
      // setIsRecording(false);
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
  const startRecording = async (measureDuration: number) => {

    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      console.log('Cannot start recording: WebSocket not connected.', 'error');
      return;
    }

    try {
      audioStream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = 'audio/webm;codecs=opus';
      console.log(`Using MIME type for recording: ${mimeType}`, 'info');

      const options: MediaRecorderOptions = { mimeType: mimeType };
      mediaRecorder.current = new MediaRecorder(audioStream.current, options);


      /**
       * The following code determined that the default audio recording
       * settings for my laptop using Chrome were
       * 
       * channelCount = 1
       * sampleRate = 48000 Hz
       */      
      // const audioTrack = audioStream.current.getAudioTracks()[0];
      // const settings = audioTrack.getSettings(); 
      // console.log("Mic track settings:", settings); 

      // Accumulate all audio chunks before sending across WebSocket
      const audioChunks: Blob[] = [];

      mediaRecorder.current.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0 && ws.current && ws.current.readyState === WebSocket.OPEN) {
          audioChunks.push(event.data);
          console.log(`Added audio chunk (${event.data.size} bytes)`, 'debug');
        }
      };

      mediaRecorder.current.onstop = () => {
        console.log('Recording stopped.', 'info');
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
          const finalAudioBlob = new Blob(audioChunks, { type: "audio/webm" })
          console.log('Final blob size: ', finalAudioBlob.size);

          // Sends audio to backend for processing
          ws.current.send(finalAudioBlob);
          ws.current.send("END_OF_AUDIO");
          console.log("Sent END_OF_AUDIO signal.", 'debug');
        }
      };

      // Recording captures one measure at a time
      mediaRecorder.current.start(measureDuration);
      // setIsRecording(true);
      console.log('Recording started...', 'success');

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.log(`Error accessing microphone: ${errorMessage}`, 'error');
      console.error('Microphone access error:', err);
    }
  };

    return {
      isConnected,
      // isRecording,
      isAudioProcessed,
      basicPitchResult,
      processLocalAudio,
      connectWebSocket,
      disconnectWebSocket,
      startRecording,
      stopRecording
  };
};