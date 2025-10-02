import type { INoteSequence } from "@magenta/music";
import type { Time } from "tone/build/esm/core/type/Units";
import type { ModelKey, ModelConfig } from "./types";
import { Tone, transport } from "./ToneService";

export const CONSTANTS : {
    BASIC_RNN: ModelConfig;
    MELODY_RNN: ModelConfig;
    CHORD_PITCHES_IMPROV_RNN: ModelConfig;
} = {
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

export const KEY_NUMBERS = {
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



export function transposeToValidPitchRange(noteSeq: INoteSequence, selectedModel: ModelKey): INoteSequence {

    const {MIN_PITCH, MAX_PITCH } = CONSTANTS[selectedModel]; 

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
export async function magentaToToneSeq(noteSeq: INoteSequence, interval: number, startBar: number) {
    const notes = {
        notes : [] as number[],
        duration : [] as Time[],
        time : [] as Time[]
    };

    // Testing transport stuff
    console.log('transport bpm: ', transport.bpm.value);
    console.log('2 seconds: ', Tone.Time(2).toNotation());
    console.log('0.5 seconds: ', Tone.Time(0.5).toNotation());

    if (noteSeq.notes && noteSeq.quantizationInfo?.stepsPerQuarter) {
        // Get current position in time
        const position = transport.position; 
        console.log('magentaToToneSeq transport position: ', position);

        // Initialize firstBar to identify where model starts playing
        let firstBar = -1;

        const stepsPerQuarter = noteSeq.quantizationInfo.stepsPerQuarter;
        const secPerQuarter = 1 / (transport.bpm.value / 60);

        console.log('stepsPerQuarter: ', stepsPerQuarter);

        // Adjust startTime to align with current place in jam
        console.log('startBar: ', startBar);
        console.log('time len: ', notes.time.length);
        
        // Convert NoteSequence into object that can be used by ToneJS
        for (const note of noteSeq.notes) {
            if (note.quantizedStartStep != null && note.quantizedEndStep != null && note.pitch!= null ) {
                console.log('processing note: ', note);

                // Apply transposition
                // console.log("before transpose: ", Tone.Frequency(note.pitch, "midi").toNote())
                const pitch = note.pitch + interval;
                // console.log("after transpose: ", Tone.Frequency(pitch, "midi").toNote())

                // computes which beat note starts on 
                // const startBeats = note.quantizedStartStep / stepsPerQuarter;
                const startSec = (note.quantizedStartStep / stepsPerQuarter) * secPerQuarter;
                // console.log('startBeats: ', startBeats);

                // calculates how many quarter notes note lasts
                const durationSec = ((note.quantizedEndStep - note.quantizedStartStep) / stepsPerQuarter) * secPerQuarter; 
                // const durationSec = note.endTime - note.startTime; 
                console.log('durationSec: ', durationSec);
                // console.log('durationBeats: ', durationBeats);

                // Convert beats to bars:beats:sixteenths notation
                // const startTime: Time = Tone.Time(startBeats).toBarsBeatsSixteenths();
                const startTime: Time = Tone.Time(startSec).toBarsBeatsSixteenths();

                // Set first bar if needed
                if (firstBar === -1) {
                    firstBar = parseInt(startTime.split(":")[0]);
                    console.log('first bar: ', firstBar);
                }

                // Adjust time to relative times
                const [bar, quarter, sixteenth] = startTime.split(":");
                const adjustedTime = `${parseInt(bar) - firstBar + startBar}:${quarter}:${sixteenth}`;
                // console.log('adjustedTime: ', adjustedTime);

                // Exit loop if note times go beyond measure 8
                if (parseInt(adjustedTime.split(":")[0]) > 8) {
                    console.log('exiting loop for adding notes')
                    break;
                }
                
                // const durationTime = Tone.Time(durationBeats).toNotation();
                const durationTime = Tone.Time(durationSec).toNotation();

                // Add information for each note to notes object
                notes.notes.push(pitch);  
                notes.duration.push(durationTime);
                notes.time.push(adjustedTime);  

            }
        } 
    } else {
        console.log("magentaToToneSeq error: coundn't convert notes");
    }

    return notes;
}