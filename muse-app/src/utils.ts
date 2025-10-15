import type { INoteSequence } from "@magenta/music";
import type { Time } from "tone/build/esm/core/type/Units";
import type { ModelKey, ModelConfig, KeySigName, ChordType } from "./types";
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

// Denotes the number of semitones away from C
// Numbers used when transposing output from model into desired key
// Model's default output is in C... I think
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
        "Cm" : 0,
        "C#m" : 1,
        "Dm" : 2,
        "Ebm" : 3,
        "Em" : 4,
        "Fm" : 5,
        "F#m" : 6,
        "Gm" : 7,
        "G#m" : 8,
        "Am" : 9,
        "Bbm" : 10,
        "Bm" : 11,
}

export const SEMITONES = {
        "C" : 0,
        "Db" : 1,
        "C#" : 1,
        "D" : 2,
        "Eb" : 3,
        "E" : 4,
        "F" : 5,
        "F#" : 6,
        "G" : 7,
        "G#" : 8,
        "Ab" : 8,
        "A" : 9,
        "Bb" : 10,
        "B" : 11,
}


/**
 * 
 * @param noteSeq Note sequence object created from Basic Pitch's MIDI output
 * @param selectedModel Magenta model that will be used for predicting the next notes
 * @returns note sequence transposed in pitch range that is acceptable by the Magenta models
 */
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
                // console.log('processing note: ', note);

                // Apply transposition
                // console.log("before transpose: ", Tone.Frequency(note.pitch, "midi").toNote())
                const pitch = note.pitch;
                console.log('interval: ', interval);
                // const pitch = note.pitch + interval;
                // console.log("after transpose: ", Tone.Frequency(pitch, "midi").toNote())

                // computes which beat note starts on 
                // const startBeats = note.quantizedStartStep / stepsPerQuarter;
                const startSec = (note.quantizedStartStep / stepsPerQuarter) * secPerQuarter;
                // console.log('startBeats: ', startBeats);

                // calculates how many quarter notes note lasts
                const durationSec = ((note.quantizedEndStep - note.quantizedStartStep) / stepsPerQuarter) * secPerQuarter; 
                // const durationSec = note.endTime - note.startTime; 
                // console.log('durationSec: ', durationSec);
                // console.log('durationBeats: ', durationBeats);

                // Convert beats to bars:beats:sixteenths notation
                // const startTime: Time = Tone.Time(startBeats).toBarsBeatsSixteenths();
                const startTime: Time = Tone.Time(startSec).toBarsBeatsSixteenths();

                // Set first bar if needed
                if (firstBar === -1) {
                    firstBar = parseInt(startTime.split(":")[0]);
                    // console.log('first bar: ', firstBar);
                }

                // Adjust time to relative times
                const [bar, quarter, sixteenth] = startTime.split(":");
                const adjustedTime = `${parseInt(bar) - firstBar + startBar}:${quarter}:${sixteenth}`;
                // console.log('adjustedTime: ', adjustedTime);

                // Exit loop if note times go beyond measure 8
                // if (parseInt(adjustedTime.split(":")[0]) > 8) { If trading 4s
                if (parseInt(adjustedTime.split(":")[0]) > 16) { // If trading 8s
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

// Number of semitones away from Key center that root of chord is
export const CHORD_OFFSETS = {
  "I" : [0, 7, 16], 
  "II" : [2, 9, 18], 
  "III" : [4, 11, 20], 
  "IV" : [-7, 0, 9], 
  "V" : [-5, 2, 11], 
  "bVI" : [-4, 3, 12], 
  "VI" : [-3, 4, 13], 
  "bVII" : [-2, 5, 14],
  "i" : [0, 7, 15], 
  "ii" : [2, 9, 17], 
  "iii" : [4, 11, 19], 
  "iv" : [-7, 0, 8],
  "v" : [-5, 2, 10],
  "vi" : [-3, 4, 12],
  "vii°" : [-1, 5, 14]
}

function getChordNames(chordProg: string[], key: KeySigName): string[] {
    const chordNames = new Array(4).fill(""); // Holds chord names (C, Am, etc.)
    const keyOffset = KEY_NUMBERS[key];
    const c3 = 48; // MIDI note value

    // Gets semitone, then checks maj/min/dim
    for (let i = 0; i < chordProg.length; i++) {
        // Get offset from key center to root of chord in chord progression
        const chordOffset = CHORD_OFFSETS[chordProg[i] as ChordType][0];
        
        // Compute/add semitone to start of chord name
        const rootNote = Tone.Frequency(c3 + keyOffset + chordOffset, "midi").toNote()
        chordNames[i] += rootNote.substring(0, rootNote.length - 1);

        // Determines if chord is major/min/dim
        const lastChar = chordProg[i].charAt(chordProg[i].length - 1);
        if (lastChar.toLowerCase() === "°") {
            chordNames[i] += "dim";
        } else if (lastChar.toLowerCase() === lastChar) {
            chordNames[i] += "m";
        } 
    }
    
    console.log('chordNames: ', chordNames);
    return chordNames;
}

/**
 * 
 * @param chordProg 
 * @returns returns nested array of notes that represent the user's selected chord progression
 */
export function getChordProgNotes(chordProg: string[], key: KeySigName): [string[][], string[]] {
    const c3 = 48; // MIDI note for C3
    // const diminshedChord = [0, 6, 14];
    // const minorChord = [0, 7, 15];
    // const majorChord = [0, 7, 16]

    // Holds arrays of chord tones
    const chords: string[][] = [];

    for (const chord of chordProg) {
        const CHORD = chord as ChordType;
        const chordNotes = [...CHORD_OFFSETS[CHORD]]; // Semitone (MIDI) structure of chord

        const keyOffset = KEY_NUMBERS[key]; // Semitones from C to current key center

        // Check offset chord which Key it's in relative to C
        for (let i = 0; i < chordNotes.length; i++) {
            chordNotes[i] += c3 + keyOffset;
        }

        // Convert midi notes to notes
        const chordLetters = chordNotes.map(midiNote => Tone.Frequency(midiNote, "midi").toNote());

        chords.push(chordLetters);
    }

    const chordNames: string[] = getChordNames(chordProg, key);

    return [chords, chordNames];
}