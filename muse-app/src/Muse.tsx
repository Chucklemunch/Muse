// TOOD Build UI that integrates useAudioToMidiClient and useMagentaIntegration

import React, { useEffect, useMemo, useRef, useState } from 'react';
// import { useMagentaIntegration } from "./useMagentaIntegration";
import { NoteSequence } from '@magenta/music';
import { type ModelKey, type KeySigName } from './types';
// import * as Tone from "tone";
import Magenta from './Magenta';
import ChordProgSelector from './ChordProgSelector';
import TempoControl from './TempoControl';
import KeySigSelector from './KeySigSelector';
import { CONSTANTS } from './utils';
import { useCallback } from 'react';
import { Tone, transport } from './ToneService';
import BeatFlasher from './BeatFlasher';

const Muse: React.FC = () => {

  // Setup Audio
  const sampleRate = 48000; //hz
  const audioContext = new AudioContext({ sampleRate: sampleRate });
  // const audioContext = new AudioContext();
  // const audioChunks = useRef<Float32Array[]>([]); // Accumulates audio before sending to backend
  const audioChunks = useRef<Int16Array[]>([]); // Accumulates audio before sending to backend
  let source: MediaStreamAudioSourceNode;

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
  const countedIn = useRef<boolean>(false);
  const [isJamming, setIsJamming] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const isRecordingRef = useRef(isRecording);
  const currentMeasure = useRef<number>(-1);
  const [currentBeat, setCurrentBeat] = useState<number>(0);

  // Makes sure recording status is updated while jamming callback is running

  useEffect (() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  // More musical logistics
  const [keySig, setKeySig] = useState<KeySigName>("C");
  const [bpm, setBPM] = useState<number>(120); // Default BPM for app
  const [chordProg, setChordProg] = useState<string[]>(["C", "G", "Am", "F"]);
  // const [measures, setMeasures] = useState<number>(4); // Number of measures to trade with AI
  const measures = 4; // Number of measures to trade with AI
  const measuresToRecord = measures // Using last measure to send info to basic-pitch
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

  // const transport = Tone.getTransport();

  // const KEYS: KeySigName[] = [
  //   "C", "Db", "D", "Eb", "E",
  //   "F", "F#", "G", "Ab", "A",
  //   "Bb", "B", "Cm", "C#m", "Dm",
  //   "Ebm", "Em", "Fm", "F#m", "Gm",
  //   "G#m", "Am", "Bbm", "Bm"
  // ];

  // Metronome used throughout entire deployment
  const metronomeRef = useRef<Tone.MembraneSynth | null>(null);
  const metronomeIdRef = useRef<number | null>(null);

  // Setup BPM for metronome whenever it is changed in app
  useEffect(() => {
    // const transport = Tone.getTransport();
    transport.bpm.value = bpm;
  }, [bpm]);

  // Create instrument that plays predicted notes
  const instrument = useMemo(() => {
  //   return new Tone.Sampler({
  //     urls: {
  //         "C4" : "samples/C4.mp3",
  //         "D4" : "samples/D4.mp3",
  //         "E4" : "samples/E4.mp3",
  //     },
  //     release: 1,
  //     // baseUrl : "https://raw.githubusercontent.com/Chucklemunch/Muse/main/muse-app/public/samples/",
  //     volume: 5,
  //     onload: () => {
  //       console.log('sampler loaded');
  //     }
  // }).toDestination();

    return new Tone.Synth({
        volume: 5
    }).toDestination();
  }, []);

  useEffect(() => {
    // Schedule count-in clicks
    if (!countedIn.current) {
      console.log('count in');
      for (let i = 0; i < 4; i++) {
        transport.schedule((time) => {
          setCurrentBeat(i+1);

          if (i === 0) {
            metronomeRef.current?.triggerAttackRelease("C3", "16n", time);
          } else {
            metronomeRef.current?.triggerAttackRelease("C2", "16n", time);
          }
        }, "4n");
      }

      // Resetting transport time after count in
      transport.scheduleOnce(() =>{
        transport.position = "1:0:0";
      }, "2:0:0");
      countedIn.current = true;
    }
  }, [countedIn]);

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
      
    // Metronome scheduling
    metronomeIdRef.current = transport.scheduleRepeat((time) => {
      const position = Tone.Time(transport.position).toBarsBeatsSixteenths(); 
      const quarter = position.split(":")[1]; 
      // console.log('current positions: ', position);
      setCurrentBeat(parseInt(quarter)+1);
      
      if (quarter === "0") {
        metronomeRef.current?.triggerAttackRelease("C3", "16n", time);
      } else {
        metronomeRef.current?.triggerAttackRelease("C2", "16n", time);
      }
    }, "4n");

    // Schedule measure resetting after certain number of measures
    transport.scheduleRepeat(() => { 
      console.log('resetting measures');
      transport.position = "1:0:0";
    }, "9:0:0");

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
  }, [isJamming]);

  const startStopMetronome = () => {
    // Get transport
    if (!metronomePlaying) {
      transport.start("+2");
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
        basicPitchResult.current = JSON.parse(JSON.parse(event.data));
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
  
  // Logic for recording audio and sending to basic-pitch model
  const startJamming = async () => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      console.log('Cannot start recording: WebSocket not connected.', 'error');
      return;
    }

    //--- Trying different way to capture audio using AudioWorklet
    await navigator.mediaDevices.getUserMedia({ audio : true })
      .then((stream) => {
        source = audioContext.createMediaStreamSource(stream)
        const thread = stream.getTracks()[0];
        console.log('settings: ', thread.getSettings());
        console.log('audioContext.sampleRate: ', audioContext.sampleRate);
      });

    await audioContext.audioWorklet.addModule("/public/AudioProcessor.js");
    const audioNode = new AudioWorkletNode(audioContext, 'audio-processor'); // Must register processor first with name 'audio-node'
    
    source.connect(audioNode);


    // AudioProcessor sends Float32Array objects of length 128
    // This represents a single channel of audio data
    audioNode.port.onmessage = (event) => {
      // event.data is a Float32Array of length 128
      const float32Chunk = event.data; 

      // --- CONVERSION STEP yanked from Gemini---
      // Create a new buffer for 16-bit integers
      const int16Chunk = new Int16Array(float32Chunk.length);

      // Convert each float sample to a 16-bit integer sample
      for (let i = 0; i < float32Chunk.length; i++) {
        // Clamp the value between -1 and 1, then scale to the 16-bit range
        const sample = Math.max(-1, Math.min(1, float32Chunk[i]));
        int16Chunk[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      }

      // processing code
      if (int16Chunk && ws.current && ws.current.readyState === WebSocket.OPEN) {
        // Sends audio chunks received during measures [0, measuresToRecord)
        if (currentMeasure.current < measuresToRecord && currentMeasure.current > 0) {
          audioChunks.current.push(int16Chunk);
        }
      }
    }

    // Starts metronome beating
    transport.scheduleRepeat(async () => {
      let isAudioSent = false; // Keeps track of if user audio has been sent to backend

      // Gets current state of transport 
      const position = Tone.Time(transport.position).toBarsBeatsSixteenths(); 

      const bar = position.split(":")[0]; 
      currentMeasure.current = parseInt(bar);

      console.log('current measure: ', currentMeasure.current)
      if (ws.current) {
        // if (currentMeasure.current == 3 && !isAudioSent) {
        if ((currentMeasure.current) % 4 == 0 && !isAudioSent) {
          console.log('sending chunks on measure: ', currentMeasure.current);
          console.log('audioChunks.current len: ', audioChunks.current.length);
          console.log('chunk len: ', audioChunks.current[0]);

          // Compute length of audioChunks
          const audioLen = audioChunks.current.reduce((sum, chunk) => sum + chunk.length, 0);
          console.log('audioLen: ', audioLen);
          
          // Create big buffer
          const mergedAudio = new Int16Array(audioLen);

          console.log('mergedAudio len: ', mergedAudio.length);
          console.log('expected time: ', mergedAudio.length / sampleRate);

          // Copy data into buffer 
          let offset = 0;
          for (const chunk of audioChunks.current) {
            mergedAudio.set(chunk, offset);
            offset += chunk.length;
          }

          console.log('buffer bytes len: ', mergedAudio.byteLength);

          // Sends audio to backend for processing
          ws.current.send(mergedAudio.buffer);
          ws.current.send("END_OF_AUDIO");

          audioChunks.current = []; // reset audioChunks after sent to backend
          console.log("Sent END_OF_AUDIO signal for user.", 'debug');
          isAudioSent = true;
        } 
      }
    }, "1m");
  };


  // --- Render UI ---
  return (
    <div style={{ fontFamily: 'Inter, sans-serif', maxWidth: '800px', margin: 'auto', padding: '20px', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
      <h1 style={{ color: '#2c3e50', textAlign: 'center', marginBottom: '20px' }}>AI Jamming App</h1>
      <p style={{ textAlign: 'center', marginBottom: '30px', color: '#555' }}>
        Transcribe your audio to MIDI, predict continuations with AI, and play the result.
      </p>
      <TempoControl 
        tempo={bpm}
        setTempo={setBPM}
      />
      <BeatFlasher 
        currentBeat={currentBeat}
      />
      <KeySigSelector 
        keySig={keySig}
        setKeySig={setKeySig}
      />
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
          disabled={isJamming || isModelLoading || !isConnected}
          style={{ backgroundColor: (isJamming || !isConnected) ? '#cccccc' : '#28a745', color: 'white' }}
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

      <ChordProgSelector
        chordProg={chordProg}
        setChordProg={setChordProg}
      />

      <Magenta 
        keySig={keySig}
        bpm={bpm}
        chordProg={chordProg}
        instrument={instrument}
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
