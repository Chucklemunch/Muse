import { MusicRNN } from "@magenta/music";
import { useEffect, useRef, useState } from "react";
import type { BasicPitchMidiResponse, MidiNoteEvent } from "./useAudioToMidiClient";
import { NoteSequence } from "@magenta/music";

export interface MagentaMidiResponse {
  filename?: string; // For file upload endpoint
  source_file?: string; // For local file endpoint
  midi_data: MidiNoteEvent[];
  status?: string; // 'success', 'no_notes_detected'
}

export const useMagentaIntegration = (modelCheckpoint: string, basicPitchResult: BasicPitchMidiResponse) => {
    // Model Checkpoints for pre-trained MagentaJS Models
    // const CHORD_PITCHES_IMPROV_RNN = "https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/chord_pitches_improv";
    // const BASIC_RNN = "https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/basic_rnn"; 
     
    const musicModel = useRef<MusicRNN | null>(null);

    // Managing Model State
    const [selectedModel, setSelectedModel] = useState<string>(modelCheckpoint);
    const [isModelLoading, setIsModelLoading] = useState<boolean>(false);
    const [isGeneratingNote, setIsGeneratingNotes] = useState<boolean>(false);

    const midiToNoteSequence = (result: BasicPitchMidiResponse) => {
        // TODO: Convert to tf note sequence
        console.log(result)
        const seq = new NoteSequence();
        return seq;
    };

    // Loads Model When Browser Loads
    useEffect (() => {
        const loadModel = async () => {
            setIsModelLoading(true);
            if (isModelLoading){
                console.log(`model loading`);
            }
            try {
                // Get model
                const rnn = new MusicRNN(selectedModel);
                await rnn.initialize();
                musicModel.current = rnn;
            } catch (e: unknown) {
                const errorMessage = e instanceof Error ? e.message : String(e);
                console.log(`Failed to load Magenta.js model or player: ${errorMessage}`, 'error');
                console.error('Magenta.js load error:', e);
            } finally {
                // Update states
                console.log('Magenta model loaded!')
                setIsModelLoading(false);                
            }
        }

        loadModel();

    }, [selectedModel]);

    // --- Logic for processing and playing next notes
    const predictAndPlay = () => {
        if (musicModel.current != null) {
            const noteSeq: NoteSequence = midiToNoteSequence(basicPitchResult);
            setIsGeneratingNotes(true);
            const magentaResult = musicModel.current.continueSequence(noteSeq, 10);
            return magentaResult;
        } else {
            console.log('error in predictAndPlay');
        }

    }

    return({
        isModelLoading,
        isGeneratingNote,
        setSelectedModel,
        predictAndPlay
    });
}