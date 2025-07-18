// TOOD Build UI that integrates useAudioToMidiClient and useMagentaIntegration

import React from 'react';
import { useAudioToMidiClient } from "./useAudioToMidiClient";
import { useMagentaIntegration } from "./useMagentaIntegration";
// import { start } from 'tone';

const Muse: React.FC = () => {

// Model Checkpoints for pre-trained MagentaJS Models
const CHORD_PITCHES_IMPROV_RNN = "https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/chord_pitches_improv";
const BASIC_RNN = "https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/basic_rnn"; 

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
  } = useAudioToMidiClient();
    
  const { 
    isModelLoading, 
    isGeneratingNote,
    selectedModel,
    setSelectedModel,
    predictAndPlay,} = useMagentaIntegration(BASIC_RNN, basicPitchResult);

  // --- Render UI ---
  return (
    <div style={{ fontFamily: 'Inter, sans-serif', maxWidth: '800px', margin: '20px auto', padding: '20px', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
      <h1 style={{ color: '#2c3e50', textAlign: 'center', marginBottom: '20px' }}>AI Jamming App</h1>
      <p style={{ textAlign: 'center', marginBottom: '30px', color: '#555' }}>
        Transcribe your audio to MIDI, predict continuations with AI, and play the result.
      </p>
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
          onClick={() => {
            if (selectedModel == BASIC_RNN) {
              setSelectedModel(CHORD_PITCHES_IMPROV_RNN);
            } else {
              setSelectedModel(BASIC_RNN);
            }
          }}
          disabled={isConnected || isModelLoading}
          style={{ backgroundColor: (isConnected || isModelLoading) ? '#cccccc' : '#28a745', color: 'white' }}
        >
          {selectedModel === BASIC_RNN ? "BASIC_RNN " : "CHORD_PITCHES_IMPROV_RNN"}
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
          onClick={predictAndPlay}
          disabled={isGeneratingNote}
          style={{ backgroundColor: !isRecording ? '#cccccc' : '#dc3545', color: 'white' }}
        >
          Predict and Play
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
