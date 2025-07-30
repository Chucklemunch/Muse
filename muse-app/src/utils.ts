import type { INoteSequence } from "@magenta/music";

export const CONSTANTS = {
    "BASIC_RNN" : {
        MIN_PITCH : 48,
        MAX_PITCH : 83,
        URL : "https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/basic_rnn", 
    },
    "MELODY_RNN" : {
        MIN_PITCH : 1,
        MAX_PITCH : 127,
        URL :"https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/melody_rnn"
    },
    "CHORD_PITCHES_IMPROV_RNN" : {
        MIN_PITCH : 48,
        MAX_PITCH : 83,
        URL : "https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/chord_pitches_improv",

    }

}

// Defines valid model keys to be just the keys within the CONSTANTS object
export type ModelKey = keyof typeof CONSTANTS;

export function transposeToValidPitchRange(noteSeq: INoteSequence, selectedModel: ModelKey): INoteSequence {

    const MIN_PITCH = CONSTANTS[selectedModel].MIN_PITCH; 
    const MAX_PITCH = 127;

    if (!noteSeq.notes || noteSeq.notes.length === 0) {
        console.warn('No notes to transpose.');
        return noteSeq;
    }

    const transposedNotes = noteSeq.notes.map(note => {
        let pitch = note.pitch ?? 60; // default to middle C if missing

        while (pitch < MIN_PITCH) pitch += 12;
        while (pitch > MAX_PITCH) pitch -= 12;

        pitch = Math.max(MIN_PITCH, Math.min(MAX_PITCH, pitch));

        return {
            ...note,
            pitch,
        };
    });

    return {
        ...noteSeq,
        notes: transposedNotes,
    };
}

export function quantStepToSec(noteSeq: INoteSequence) {
    // TODO 

    return
}