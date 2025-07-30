import type { INoteSequence } from "@magenta/music";
import type { Time } from "tone/build/esm/core/type/Units";

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

/**
 * Converts magenta model output into array of notes that can be played
 * by a ToneJS instrument
 * 
 * ToneJS plays notes via triggerAttackRelease(notes, duration, time?, velocity?),
 * function must return object with information about note pitch, duration, etc.
 * 
 * @param noteSeq note sequence generated from Magenta model
 * @returns object with notes that can be played by a ToneJS instrument
 */
export function magentaToToneSeq(noteSeq: INoteSequence, bpm: number) {
    const notes = {
        notes : [] as number[],
        duration : [] as number[],
        time : [] as Time []
    };
    if (noteSeq.notes && noteSeq.quantizationInfo?.stepsPerQuarter) {
        const quantizedStepToSeconds = (step: number, stepsPerQuarter: number, bpm: number) => {
            const quartersPerMinute = bpm;
            const secondsPerQuarter = 60 / quartersPerMinute;
            return (step / stepsPerQuarter) * secondsPerQuarter;
        }

        const stepsPerQuarter = noteSeq.quantizationInfo.stepsPerQuarter;
        
        // Convert NoteSequence into object that can be used by ToneJS

        for (const note of noteSeq.notes) {
            if (note.quantizedStartStep != null && note.quantizedEndStep != null && note.pitch!= null ) {
                const pitch = note.pitch;
                const startTime = quantizedStepToSeconds(note.quantizedStartStep, stepsPerQuarter, bpm);
                const endTime = quantizedStepToSeconds(note.quantizedEndStep, stepsPerQuarter, bpm);
                const duration = endTime - startTime;

                // Add information for each note to notes object
                notes.notes.push(pitch);  
                notes.duration.push(duration);
                notes.time.push(startTime);  

            }
        } 
    } else {
        console.log("magentaToToneSeq error: coundn't convert notes");
    }

    return notes;
}