// TOOD Build UI that integrates useAudioToMidiClient and useMagentaIntegration

import React, { useEffect, useRef, useState } from 'react';
import { useAudioToMidiClient } from "./useAudioToNoteSeqClient";
import { useMagentaIntegration } from "./useMagentaIntegration";
import { NoteSequence } from '@magenta/music';
import { type ModelKey, type KeyName } from './types';
import * as Tone from "tone";

const Muse: React.FC = () => {

// Model Checkpoints for pre-trained MagentaJS Models
const CHORD_PITCHES_IMPROV_RNN : ModelKey = "CHORD_PITCHES_IMPROV_RNN";
const BASIC_RNN : ModelKey = "BASIC_RNN"; 
const MELODY_RNN : ModelKey = "MELODY_RNN";

// Musical logistics setup
const [isJamming, setJamming] = useState<boolean>(false);
const [isRecording, setIsRecording] = useState<boolean>(false);
const isRecordingRef = useRef(isRecording);
// Makes sure recording status is updated while jamming callback is running
useEffect (() => {
  isRecordingRef.current = isRecording;
}, [isRecording]);


const [key, setKey] = useState<KeyName>("C");
const [bpm, setBPM] = useState<number>(120); // Default BPM for app
const [measures, setMeasures] = useState<number>(4); // Number of measures to trade with AI
const [metronomePlaying, setMetronomePlaying] = useState<boolean>(false);

const transport = Tone.getTransport();

const KEYS: KeyName[] = [
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
let currentMeasure = 0;

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

    // Get rid of metronome
    metronomeRef.current?.dispose();
  }
});
  

const startStopMetronome = async () => {
  // Get transport
  // const transport = Tone.getTransport();
  console.log('is metronome playing? :', metronomePlaying);

  if (!metronomePlaying) {
    transport.start("+0.1");
    setMetronomePlaying(true);
  } else {
    transport.stop();
    setMetronomePlaying(false);
  }
}

  // Use the custom hooks
  const {
      isConnected,
      // isRecording,
      isAudioProcessed,
      basicPitchResult,
      processLocalAudio,
      connectWebSocket,
      disconnectWebSocket,
      startRecording,
      stopRecording,
  } = useAudioToMidiClient(bpm);

  // const basicPitchSeq: NoteSequence = basicPitchResult.current ?? new NoteSequence();
  
  // const { 
  //   isModelLoading, 
  //   isGeneratingNote,
  //   selectedModel,
  //   setSelectedModel,
  //   predictNotes} = useMagentaIntegration(MELODY_RNN, basicPitchSeq);

  const startJamming = () => {
    const measureDuration = Tone.Time("1m").toMilliseconds();
    console.log('measureDuration: ', measureDuration);
    
    // Getting global transport for event scheduling
    const transport = Tone.getTransport();
    const cycleLength = 2 * measures; // Number of measures in person/AI exchange
    const measuresToRecord = measures - 1 // Using last measure to send info to basic-pitch
    console.log('cycleLength: ', cycleLength); 
    console.log('measuresToRecord: ', measuresToRecord);

    transport.scheduleRepeat(() => {
      console.log('time: ', transport.seconds);
      currentMeasure = Math.floor(transport.seconds / (measureDuration / 1000)) % cycleLength;
      console.log('current measure: ', currentMeasure)
      console.log('isRecording: ', isRecordingRef.current);

      if ((currentMeasure <= measuresToRecord) && !isRecordingRef.current) {
        startRecording(measureDuration); // measureDuration in milliseconds
        setIsRecording(true);
        
      } else if (
        (currentMeasure > measuresToRecord) && 
        (currentMeasure <= cycleLength / 2) && 
        isRecordingRef.current) {
        console.log('elif 1');
        stopRecording();
        setIsRecording(false);
        console.log('basicPitchResult.current');
        console.log(basicPitchResult.current);
      } else if ((currentMeasure >= cycleLength / 2) && !isRecordingRef.current) {
          console.log('elif 2 ', currentMeasure);
        
      }
    }, "1m");

    transport.start("+0.1");
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
        {KEYS.map((keySig) => (
          <button
            key={keySig}
            style={{ 
              backgroundColor: (key == keySig) ? '#497ddeff' : '#f6f6f6ff', 
              color: 'black',
              margin: 10
            }}

            onClick={() => {
              setKey(keySig);
              console.log("key change: ", keySig);
            }}
          >
            {keySig}
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
            setJamming(true);
            startStopMetronome();
          }}
          disabled={!isConnected || isRecording || isModelLoading}
          style={{ backgroundColor: (!isConnected || isRecording || isModelLoading) ? '#cccccc' : '#28a745', color: 'white' }}
        >
          {isRecording ? 'Jamming...' : 'Start Jamming'}
        </button>
        <button
          onClick={() => {
            stopRecording();
            setJamming(false);
            startStopMetronome();
          }}
          disabled={!isJamming}
          style={{ backgroundColor: !isJamming ? '#cccccc' : '#dc3545', color: 'white' }}
        >
          Stop Jam
        </button>
        <button
          onClick={() => predictNotes(key, bpm)}
          disabled={isGeneratingNote}
          style={{ backgroundColor: isGeneratingNote ? '#cccccc' : '#dc3545', color: 'white' }}
        >
          Predict and Play Notes
        </button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '30px' }}>
        <button
          onClick={processLocalAudio}
          disabled={isAudioProcessed || isModelLoading}
          style={{ backgroundColor: (isModelLoading) ? '#cccccc' : '#6c757d', color: 'white' }}
        >
          {'Process Local File'}
        </button>
      </div>
    </div>
  );
};

export default Muse;
