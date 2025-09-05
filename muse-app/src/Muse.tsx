// TOOD Build UI that integrates useAudioToMidiClient and useMagentaIntegration

import React, { useEffect, useState } from 'react';
import { useAudioToMidiClient } from "./useAudioToNoteSeqClient";
import { useMagentaIntegration } from "./useMagentaIntegration";
import { NoteSequence } from '@magenta/music';
import { type ModelKey } from './utils';
import * as Tone from "tone";

const Muse: React.FC = () => {

// Model Checkpoints for pre-trained MagentaJS Models
const CHORD_PITCHES_IMPROV_RNN : ModelKey = "CHORD_PITCHES_IMPROV_RNN";
const BASIC_RNN : ModelKey = "BASIC_RNN"; 
const MELODY_RNN : ModelKey = "MELODY_RNN";

const [bpm, setBPM] = useState<number>(120); // Default BPM for app
const [metronomePlaying, setMetronomePlaying] = useState<boolean>(false);

useEffect(() => {
  const transport = Tone.getTransport();
  transport.bpm.value = bpm;

  const metronome = new Tone.MembraneSynth({
    pitchDecay: 0.02,
    octaves: 2,
    envelope: {
      attack: 0.001,
      decay: 0.2,
      sustain: 0
    }
  }).toDestination();

  const id = transport.scheduleRepeat((time) => {
    metronome.triggerAttackRelease("C2", "8n", time);
  }, "4n");

  return () => {
    transport.clear(id);
    metronome.dispose();
  }
});
  

const startStopMetronome = async () => {
  await Tone.start();
  const transport = Tone.getTransport();

  if (!metronomePlaying) {
    transport.start("+0.1");
  } else {
    transport.stop();
  }
}

  // Use the custom hooks
  const {
      isConnected,
      isRecording,
      isAudioProcessed,
      basicPitchResult,
      processLocalAudio,
      connectWebSocket,
      disconnectWebSocket,
      startRecording,
      stopRecording,
  } = useAudioToMidiClient(bpm);

  const basicPitchSeq: NoteSequence = basicPitchResult.current ?? new NoteSequence();
  
  const { 
    isModelLoading, 
    isGeneratingNote,
    selectedModel,
    setSelectedModel,
    predictNotes} = useMagentaIntegration(MELODY_RNN, basicPitchSeq);
    // predictAndPlay,} = useMagentaIntegration(BASIC_RNN_URL, basicPitchSeq);

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
        <button 
          onClick={() => {
             startStopMetronome();
             setMetronomePlaying(!metronomePlaying);
             console.log("metronomePlaying: ", !metronomePlaying);
          }}
          style={{ backgroundColor: metronomePlaying ? '#ad1515ff' : '#28a745', color: 'white' }}
        >
            {metronomePlaying ? "Stop Metronome" : "Start Metronome"}
        </button>
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
          onClick={startRecording}
          disabled={!isConnected || isRecording || isModelLoading}
          style={{ backgroundColor: (!isConnected || isRecording || isModelLoading) ? '#cccccc' : '#28a745', color: 'white' }}
        >
          {isRecording ? 'Recording...' : 'Start Recording'}
        </button>
        <button
          onClick={stopRecording}
          disabled={!isRecording}
          style={{ backgroundColor: !isRecording ? '#cccccc' : '#dc3545', color: 'white' }}
        >
          Stop
        </button>
        <button
          onClick={() => predictNotes(bpm)}
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
