// TOOD Build UI that integrates useAudioToMidiClient and useMagentaIntegration

import React, { useEffect, useRef, useState } from 'react';
// import { useAudioToMidiClient } from "./useAudioToNoteSeqClient";
import { useMagentaIntegration } from "./useMagentaIntegration";
import { MusicRNN, NoteSequence } from '@magenta/music';
import { type ModelKey, type KeySigName } from './types';
import * as Tone from "tone";
import Magenta from './Magenta';
import { CONSTANTS } from './utils';
// import AudioToNoteSeqClient from './AudioToNoteSeqClient';
import { useCallback } from 'react';

const Muse: React.FC = () => {

  // IMPORTANT: Adjust this if your FastAPI server is running on a different host or port.
  // For local development, it's typically http://localhost:8000
  const FASTAPI_BASE_URL = "http://localhost:8000";
  // For WebSocket, convert http:// to ws:// or https:// to wss://
  const FASTAPI_WS_PROTOCOL = FASTAPI_BASE_URL.startsWith("https://") ? "wss://" : "ws://";
  const FASTAPI_WS_HOST = FASTAPI_BASE_URL.replace(/https?:\/\//, ''); // Remove protocol for host part
  const FASTAPI_WS_URL = `${FASTAPI_WS_PROTOCOL}${FASTAPI_WS_HOST}/audio_to_note_seq`;

  // Used to hold results from processed API call to basic-pitch model
  const basicPitchResult = useRef<NoteSequence>(new NoteSequence());

  // Model Checkpoints for pre-trained MagentaJS Models
  const CHORD_PITCHES_IMPROV_RNN : ModelKey = "CHORD_PITCHES_IMPROV_RNN";
  const BASIC_RNN : ModelKey = "BASIC_RNN"; 
  const MELODY_RNN : ModelKey = "MELODY_RNN";

  // Musical logistics setup
  const [isJamming, setIsJamming] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isAudioProcessed, setIsAudioProcessed] = useState<boolean>(false);
  const isRecordingRef = useRef(isRecording);
  const currentMeasure = useRef<number>(-1);


  // Makes sure recording status is updated while jamming callback is running

  useEffect (() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  // More musical logistics
  const [keySig, setKeySig] = useState<KeySigName>("C");
  const [bpm, setBPM] = useState<number>(120); // Default BPM for app
  const [measures, setMeasures] = useState<number>(4); // Number of measures to trade with AI
  const cycleLength = 2 * measures; // Number of measures in person/AI exchange
  const measuresToRecord = measures - 1 // Using last measure to send info to basic-pitch
  const [metronomePlaying, setMetronomePlaying] = useState<boolean>(false);

  // Managing Model State
  const [selectedModel, setSelectedModel] = useState<ModelKey>(BASIC_RNN);
  const [isModelLoading, setIsModelLoading] = useState<boolean>(false);
  const [isGeneratingNotes, setIsGeneratingNotes] = useState<boolean>(false);

  // Websocket Connection State
  const [isConnected, setIsConnected] = useState<boolean>(false);
  // const [captureAudio, setCaptureAudio] = useState<boolean>(false);

  // // Key to number mapping
  // const KEY_NUMBERS = CONSTANTS.KEY_NUMBERS;
  // type KeyName = keyof typeof KEY_NUMBERS;

  const transport = Tone.getTransport();

  const KEYS: KeySigName[] = [
    "C", "Db", "D", "Eb", "E",
    "F", "F#", "G", "Ab", "A",
    "Bb", "B", "Cm", "C#m", "Dm",
    "Ebm", "Em", "Fm", "F#m", "Gm",
    "G#m", "Am", "Bbm", "Bm"
  ];

  // Metronome used throughout entire deployment
  const metronomeRef = useRef<Tone.MembraneSynth | null>(null);
  const metronomeIdRef = useRef<number | null>(null);

  // Initialize recording states
  // let currentMeasure = 0;

  // Setup BPM for metronome whenever it is changed in app
  useEffect(() => {
    // const transport = Tone.getTransport();
    transport.bpm.value = bpm;
  }, [bpm]);

  useEffect(() => {
    // const transport = Tone.getTransport();
    metronomeRef.current = new Tone.MembraneSynth({
      pitchDecay: 0.02,
      octaves: 2,
      envelope: {
        attack: 0.01,
        decay: 0.1,
        sustain: 0
      }
    }).toDestination();
      
    metronomeIdRef.current = transport.scheduleRepeat((time) => {
      metronomeRef.current?.triggerAttackRelease("C2", "16n", time);
    }, "4n");

    // Clean-up to avoid duplicate metronomes
    return () => {
      // Clear metronome id
      if (metronomeIdRef.current !== null) {
        transport.clear(metronomeIdRef.current);
        metronomeIdRef.current = null;
      }
      console.log('disposing of metronome');
      // Get rid of metronome
      metronomeRef.current?.dispose();
    }
  }, [isJamming, transport]);

  const startStopMetronome = () => {
    // Get transport
    if (!metronomePlaying) {
      transport.start("+2.5");
      setMetronomePlaying(true);
    } else {
      transport.stop();
      setMetronomePlaying(false);
    }
  }



  // Refs to hold mutable objects that don't trigger re-renders
  // Explicitly type the ref's current value (e.g., WebSocket | null)
  const ws = useRef<WebSocket | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioStream = useRef<MediaStream | null>(null);
 
  // --- WebSocket Connection Logic ---
  const connectWebSocket = useCallback(() => {
    console.log('connectWebSocket bpm: ', bpm);
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
        setIsGeneratingNotes(true);
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.log(`Failed to parse message: ${event.data}. Error: ${errorMessage}`, 'error');
        console.error('WebSocket message parsing error:', e);
      } 
    };

    ws.current.onclose = (event: CloseEvent) => {
      setIsConnected(false);
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
      setIsRecording(false);
      console.log('stopping recording')
    }
    if (audioStream.current) {
      console.log('stopping audioStream')
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


  // Accumulate all audio chunks before sending across WebSocket
  const audioChunks = useRef<Blob[]>([]);
  
  // Logic for recording audio and sending to basic-pitch model
  const startJamming = async () => {
    const measureDuration = Tone.Time("1m").toMilliseconds();

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

      mediaRecorder.current.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0 && ws.current && ws.current.readyState === WebSocket.OPEN) {
          if (currentMeasure.current <= measuresToRecord && currentMeasure.current >= 0) {
            audioChunks.current.push(event.data);
            console.log(`Added audio chunk (${event.data.size} bytes: measure ${currentMeasure.current})`, 'debug');
          } 
        }
      };

      mediaRecorder.current.onstop = () => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
          ws.current.send("END_OF_AUDIO");
          console.log("Sent END_OF_AUDIO signal.", 'debug');
        }
      };

      // Recording captures one measure at a time
      mediaRecorder.current.start(100);
      setIsRecording(true);
      console.log('Recording started...', 'success');

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.log(`Error accessing microphone: ${errorMessage}`, 'error');
      console.error('Microphone access error:', err);
    }

    // Getting global transport for event scheduling
    const transport = Tone.getTransport();
      


    // Starts metronome beating
    transport.scheduleRepeat((time) => {


      let isAudioSent = false; // Keeps track of if user audio has been sent to backend

      if (currentMeasure.current != -1) {
        // Offset calculation by one measureDuration to account for count in measure
        currentMeasure.current = Math.floor((transport.seconds - (measureDuration/1000)) / (measureDuration/1000)) % cycleLength;

        console.log('time: ', time);
        console.log('transport time: ', transport.seconds);
        console.log('measureDuration: ', measureDuration);
        console.log('current measure: ', currentMeasure.current)
        if (ws.current) {
          if (currentMeasure.current == 3 && !isAudioSent) {

            const finalAudioBlob = new Blob(audioChunks.current, { type: "audio/webm" })
            console.log('Final blob size: ', finalAudioBlob.size);

            // Sends audio to backend for processing
            ws.current.send(finalAudioBlob);
            ws.current.send("END_OF_AUDIO");

            audioChunks.current = []; // reset audioChunks after sent to backend
            console.log("Sent END_OF_AUDIO signal for user.", 'debug');
            isAudioSent = true;
          } else {
            console.log('else')
            isAudioSent = false;
          }
        } 
      } else {
        console.log('counting in');
        console.log('currentMeasure: ', currentMeasure.current);
        currentMeasure.current = -2;
      }
    }, "1m");
  };


  // --- Render UI ---
  return (
    <div style={{ fontFamily: 'Inter, sans-serif', maxWidth: '800px', margin: '20px auto', padding: '20px', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
      <h1 style={{ color: '#2c3e50', textAlign: 'center', marginBottom: '20px' }}>AI Jamming App</h1>
      <p style={{ textAlign: 'center', marginBottom: '30px', color: '#555' }}>
        Transcribe your audio to MIDI, predict continuations with AI, and play the result.
      </p>
      <div>
        <button onClick={() => {
            const newBPM = parseInt(document.getElementById('tempoInput')?.value);
              setBPM(newBPM);
              console.log('tempo updated to : ', newBPM);
        }}>
            Set Tempo
        </button>
        <input
          type="number"
          id="tempoInput"
          defaultValue={bpm}
          min="20"
          max="300"
        />
      </div>
      <div>
        <button onClick={() => {
            const newMeasures = parseInt(document.getElementById('measureInput')?.value);
              setMeasures(newMeasures);
              console.log('measures updated to : ', newMeasures);
          }}>
            Measure to Trade
        </button>
        <input
          type="number"
          id="measureInput"
          defaultValue={measures}
          min="20"
          max="300"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {KEYS.map((keySigBut) => (
          <button
            key={keySigBut}
            style={{ 
              backgroundColor: (keySigBut == keySig) ? '#497ddeff' : '#f6f6f6ff', 
              color: 'black',
              margin: 10
            }}

            onClick={() => {
              setKeySig(keySigBut);
              console.log("key change: ", keySigBut);
            }}
          >
            {keySigBut}
          </button>
      ))}
    </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '30px' }}>
        <button
          onClick={connectWebSocket}
          disabled={isConnected || isModelLoading}
          style={{ backgroundColor: (isConnected || isModelLoading) ? '#cccccc' : '#28a745', color: 'white' }}
        >
          {isModelLoading ? 'Loading AI Model...' : (isConnected ? 'WS Connected' : 'Connect WebSocket')}
        </button>
        <button
          onClick={disconnectWebSocket}
          disabled={!isConnected}
          style={{ backgroundColor: !isConnected ? '#cccccc' : '#dc3545', color: 'white' }}
        >
          Disconnect WS
        </button>
        <button
          onClick={() => 
            selectedModel === BASIC_RNN ? setSelectedModel(MELODY_RNN) 
            : selectedModel === MELODY_RNN ? setSelectedModel(CHORD_PITCHES_IMPROV_RNN) 
            : setSelectedModel(BASIC_RNN)
          }
          disabled={isConnected || isModelLoading}
          style={{ backgroundColor: (isConnected || isModelLoading) ? '#cccccc' : '#28a745', color: 'white' }}
        >
          {
            (selectedModel === BASIC_RNN) ? "BASIC_RNN" : 
            (selectedModel === MELODY_RNN) ? "MELODY_RNN" : 
            (selectedModel === CHORD_PITCHES_IMPROV_RNN) ? "CHORD_PITCHES_IMPROV_RNN" : 
            "NO MODEL SELECTED"
          }
        </button>
        <button
          onClick={async () => {
            await Tone.start();
            // const transport = Tone.getTransport();
            console.log('transport time: ', transport.seconds);
            startJamming();
            setIsJamming(true);
            startStopMetronome();
          }}
          disabled={isJamming || isModelLoading}
          style={{ backgroundColor: (isJamming) ? '#cccccc' : '#28a745', color: 'white' }}
        >
          {isJamming ? 'Jamming...' : 'Start Jamming'}
        </button>
        <button
          onClick={() => {
            stopRecording();
            setIsJamming(false);
            startStopMetronome();
          }}
          disabled={!isJamming}
          style={{ backgroundColor: !isJamming ? '#cccccc' : '#dc3545', color: 'white' }}
        >
          Stop Jam
        </button>
      </div>

      <Magenta 
        keySig={keySig}
        bpm={bpm}
        modelCheckpointURL={CONSTANTS.BASIC_RNN.URL}
        basicPitchSeq={basicPitchResult.current}
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
        isModelLoading={isModelLoading}
        setIsModelLoading={setIsModelLoading}
        isGeneratingNotes={isGeneratingNotes}
        setIsGeneratingNotes={setIsGeneratingNotes}
      />
    </div>
  );
};

export default Muse;
