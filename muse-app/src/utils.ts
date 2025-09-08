import type { INoteSequence, NoteSequence } from "@magenta/music";
import type { Time } from "tone/build/esm/core/type/Units";
import type { ModelKey } from "./types";
import * as Tone from "tone";

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

    },
    "KEY_NUMBERS" : {
        "C" : 0,
        "Db" : 1,
        "D" : 2,
        "Eb" : 3,
        "E" : 4,
        "F" : 5,
        "F#" : 6,
        "G" : 7,
        "Ab" : 8,
        "A" : 9,
        "Bb" : 10,
        "B" : 11,
        "Cm" : 3,
        "C#m" : 4,
        "Dm" : 5,
        "Ebm" : 6,
        "Em" : 7,
        "Fm" : 8,
        "F#m" : 9,
        "Gm" : 10,
        "G#m" : 11,
        "Am" : 0,
        "Bbm" : 1,
        "Bm" : 2,
        
    }
}



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
 * @param interval the interval by which the notes must be transposed
 * 
 * @returns object with notes that can be played by a ToneJS instrument
 */
export function magentaToToneSeq(noteSeq: INoteSequence, interval: number) {
    const notes = {
        notes : [] as number[],
        duration : [] as Time [],
        time : [] as Time []
    };
    if (noteSeq.notes && noteSeq.quantizationInfo?.stepsPerQuarter) {
        // const quantizedStepToSeconds = (step: number, stepsPerQuarter: number, bpm: number) => {
        //     const quartersPerMinute = bpm;
        //     const secondsPerQuarter = 60 / quartersPerMinute;
        //     return (step / stepsPerQuarter) * secondsPerQuarter;
        // }

        const stepsPerQuarter = noteSeq.quantizationInfo.stepsPerQuarter;
        console.log('stepsPerQuarter: ', stepsPerQuarter);
        
        // Convert NoteSequence into object that can be used by ToneJS
        for (const note of noteSeq.notes) {
            if (note.quantizedStartStep != null && note.quantizedEndStep != null && note.pitch!= null ) {
                // Apply transposition
                console.log("before transpose: ", Tone.Frequency(note.pitch, "midi").toNote())
                const pitch = note.pitch + interval;
                console.log("after transpose: ", Tone.Frequency(pitch, "midi").toNote())

                // computes which beat note starts on 
                const startBeats = note.quantizedStartStep / stepsPerQuarter;
                // calculates how many quarter notes note lasts
                const durationBeats = (note.quantizedEndStep - note.quantizedStartStep) / stepsPerQuarter; 

                // Convert beats to bars:beats:sixteenths notation
                const startTime = Tone.Time(startBeats).toBarsBeatsSixteenths();
                const durationTime = Tone.Time(durationBeats).toNotation();

                // Add information for each note to notes object
                notes.notes.push(pitch);  
                notes.duration.push(durationTime);
                notes.time.push(startTime);  

            }
        } 
    } else {
        console.log("magentaToToneSeq error: coundn't convert notes");
    }

    return notes;
}