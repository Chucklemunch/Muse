import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NoteSequence } from '@magenta/music';
import { type ModelKey, type KeySigName } from './types';
import Magenta from './Magenta';
import ChordProgSelector from './ChordProgSelector';
import TempoControl from './TempoControl';
import KeySigSelector from './KeySigSelector';
import { CONSTANTS, getChordProgNotes } from './utils';
import { useCallback } from 'react';
import { Tone, transport } from './ToneService';
import BeatFlasher from './BeatFlasher';

const Muse: React.FC = () => {

  // Setup Audio
  const sampleRate = 48000; //hz
  const audioContext = useRef<AudioContext>(new AudioContext({ sampleRate: sampleRate }));
  const audioChunks = useRef<Int16Array[]>([]); // Accumulates audio before sending to backend
  const source = useRef<MediaStreamAudioSourceNode>(null);
  const stream = useRef<MediaStream>(null);
  const audioNode = useRef<AudioWorkletNode>(null);

  // IMPORTANT: Adjust this if your FastAPI server is running on a different host or port.
  // For local development, it's typically http://localhost:8000
  const FASTAPI_BASE_URL = process.env.NODE_ENV === "production" 
		? "https://muse.charliekotula.com/api"
		: "http://localhost:8000";

  // For WebSocket, convert http:// to ws:// or https:// to wss://
  const FASTAPI_WS_PROTOCOL = FASTAPI_BASE_URL.startsWith("https://") ? "wss://" : "ws://";
  const FASTAPI_WS_HOST = FASTAPI_BASE_URL.replace(/https?:\/\//, ''); // Remove protocol for host part
  const FASTAPI_WS_URL = `${FASTAPI_WS_PROTOCOL}${FASTAPI_WS_HOST}/audio_to_note_seq`;

  // Used to hold results from processed API call to basic-pitch model
  const basicPitchResult = useRef<NoteSequence>(new NoteSequence());

  // Model Checkpoints for pre-trained MagentaJS Models
  const CHORD_PITCHES_IMPROV_RNN : ModelKey = "CHORD_PITCHES_IMPROV_RNN"; // Only using this model for now
  // const BASIC_RNN : ModelKey = "BASIC_RNN"; 
  // const MELODY_RNN : ModelKey = "MELODY_RNN";

  // Musical logistics setup
  const [countedIn, setCountedIn] = useState<boolean>(false);
  const [isJamming, setIsJamming] = useState<boolean>(false);
  const currentMeasure = useRef<number>(1);
  const [currentBeat, setCurrentBeat] = useState<number>(0);

  // More musical logistics
  const [keySig, setKeySig] = useState<KeySigName>("C");
  const [bpm, setBPM] = useState<number>(120); // Default BPM for app
  const [chordProg, setChordProg] = useState<string[]>(["I", "V", "vi", "IV"]);
  const [chordNames, setChordNames] = useState<string[]>(["C", "G", "Am", "F"]);
  // const [measures, setMeasures] = useState<number>(4); // Number of measures to trade with AI
  const measures = 4; // Number of measures to trade with AI
  const measuresToRecord = measures // Using last measure to send info to basic-pitch
  const [metronomePlaying, setMetronomePlaying] = useState<boolean>(false);

  // Managing Model State
  const [selectedModel, setSelectedModel] = useState<ModelKey>(CHORD_PITCHES_IMPROV_RNN);
  const [isModelLoading, setIsModelLoading] = useState<boolean>(false);
  const [isGeneratingNotes, setIsGeneratingNotes] = useState<boolean>(false);

  // Websocket Connection State
  const [isConnected, setIsConnected] = useState<boolean>(false);

  // Metronome used throughout entire deployment
  const metronomeRef = useRef<Tone.Synth | null>(null);
  const metronomeIdRef = useRef<number | null>(null);

  // Synth used for backing chords
  const backingTrack = useRef<Tone.PolySynth | null>(null);
  const backingTrackIdRef = useRef<number | null>(null);

  // Setup BPM for metronome whenever it is changed in app
  useEffect(() => {
    transport.bpm.value = bpm;
  }, [bpm]);

  // Create instrument that plays predicted notes
  const instrument = useMemo(() => {
    return new Tone.Synth({
      envelope: {
        attack: 0.05,
        decay: 0.5,
        release: 0.1,
        sustain: 0.2
      },
      volume: -5
    }).toDestination();
  }, []);

  // Setting up backing track chords
  useEffect(() => {
    backingTrack.current = new Tone.PolySynth({
      options : {
        volume : -25,
        envelope : {
          attack : 0.1,
          decay: 0.3,
          sustain: 0.7,
          release : 0.1,
        },
        oscillator : {
          type: "sine4"
        }
      },
    }).toDestination();

    // Get chords to be used for backing track
    const [backingChords, chordNames] = getChordProgNotes(chordProg, keySig);
    setChordNames(chordNames);

    // Schedule chords to play on half notes after count-in has occured
    if (countedIn) {
      transport.scheduleRepeat((time) => {
        // Get current chord based on measure (1 measure per chord)
        const chordIdx = (currentMeasure.current - 1) % 4;
        const currentChord = backingChords[chordIdx];

        // Trigger chord
        backingTrack.current?.triggerAttackRelease(currentChord, "2n", time);
      }, "2n", "1:0:0");
    }

    // Cleanup : cancel all scheduled events related to backing track
    return () => {
      if (backingTrackIdRef.current !== null) {
        transport.clear(backingTrackIdRef.current);
        backingTrackIdRef.current = null;
      }

      // Get rid of backing track
      console.log('disposing of backingTrack');
      backingTrack.current?.dispose();
    }
  }, [isJamming, countedIn, chordProg, keySig]);

  // Setting up metronome
  useEffect(() => {
    // Creating metronome
    metronomeRef.current = new Tone.Synth({
        volume : 0,
    }).toDestination();

    // Setting count-in to true (even though it hasn't technically finished) so chords can be scheduled
    transport.scheduleOnce(() => {
      setCountedIn(true);
    }, "1:2:0");

    // Resetting transport time after countin
    transport.scheduleOnce(() =>{
      transport.position = "1:0:0";
    }, "2:0:0");
      
    // Metronome scheduling for tick and backing chords
    metronomeIdRef.current = transport.scheduleRepeat((time) => {
      const position = Tone.Time(transport.position).toBarsBeatsSixteenths(); 
      const quarter = position.split(":")[1]; 
      setCurrentBeat(parseInt(quarter)+1);
      
      if (quarter === "0") {
        metronomeRef.current?.triggerAttackRelease("C2", "16n", time);
      }else {
        metronomeRef.current?.triggerAttackRelease("C1", "16n", time);
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

      // Get rid of metronome
      console.log('disposing of metronome');
      metronomeRef.current?.dispose();
    }
  }, [isJamming]);

  const startStopMetronome = () => {
    // Get transport
    if (!metronomePlaying) {
      transport.start("+3");
      setMetronomePlaying(true);
    } else {
      transport.stop();
      setMetronomePlaying(false);
    }
  }

  // Refs to hold mutable objects that don't trigger re-renders
  // Explicitly type the ref's current value (e.g., WebSocket | null)
  const ws = useRef<WebSocket | null>(null);
 
  // --- WebSocket Connection Logic ---
  useEffect(() => {
    // Use the explicitly defined WebSocket URL for FastAPI
    ws.current = new WebSocket(`${FASTAPI_WS_URL}?bpm=${bpm}`);

    ws.current.onopen = () => {
      setIsConnected(true);
      console.log('WebSocket Connected!', 'success', `bpm: ${bpm}`);
    };

    ws.current.onmessage = (event: MessageEvent) => {
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

    // Clean up -- Websocket reconnects each time user changes the BPM
    return () => {
      // Disconnects Websocket
      if (ws.current) {
        ws.current.close();
        ws.current = null;
      }

      // Stops recording 
      setIsConnected(false);
      stopRecording();
    };
  }, [FASTAPI_WS_URL, bpm]);

  // Logic for stopping the audio recording
  const stopRecording = useCallback(() => {
    // Suspend audioContext
    audioContext.current.suspend();

    // Stop incoming audio track
    // if (stream.current) {
    //   stream.current.getTracks().forEach((track) => track.stop());
    // }

    // Reset and clear transport (and scheduled notes)
    transport.stop();
    transport.cancel(0);

    // Reset to beat 1
    setCurrentBeat(1);
  }, []);

  // Logic for recording audio and sending to basic-pitch model
  const startJamming = async () => {
    // Count In
    // scheduleCountIn(); 
    // Make sure audioContext is running
    audioContext.current.resume();
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      console.log('Cannot start recording: WebSocket not connected.', 'error');
      return;
    }

    //--- Trying different way to capture audio using AudioWorklet
    stream.current = await navigator.mediaDevices.getUserMedia({ audio : true });
    console.log('stream: ', stream.current);

    // Connect audio
    source.current = audioContext.current.createMediaStreamSource(stream.current);
    const thread = stream.current.getTracks()[0];

    console.log('settings: ', thread.getSettings());
    console.log('audioContext.sampleRate: ', audioContext.current.sampleRate);

    await audioContext.current.audioWorklet.addModule("/AudioProcessor.js");

    audioNode.current = new AudioWorkletNode(audioContext.current, 'audio-processor'); // Must register processor first with name 'audio-node'

    // Connect audio
    source.current.connect(audioNode.current);

    // AudioProcessor sends Float32Array objects of length 128
    // This represents a single channel of audio data
    audioNode.current.port.onmessage = (event) => {
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
          // console.log('pushing audio')
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
        isJamming={isJamming}
      />
      <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '30px' }}>
        {/* <button
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
        </button> */}
        {/* <button
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
        </button> */}
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
            setCountedIn(false);
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
        isJamming={isJamming}
      />

      <Magenta 
        keySig={keySig}
        bpm={bpm}
        chordProg={chordNames}
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
