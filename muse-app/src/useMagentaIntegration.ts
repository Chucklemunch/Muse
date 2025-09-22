import { MusicRNN, NoteSequence, type INoteSequence } from "@magenta/music";
import { CONSTANTS, transposeToValidPitchRange, magentaToToneSeq } from "./utils";
import type { KeySigName } from "./types";
import { quantizeNoteSequence } from "@magenta/music/esm/core/sequences";
import { useEffect, useRef, useState } from "react";
import { getTransport, Sampler } from "tone";
// import * as Tone from "tone";
import type { MagentaProps } from "./Magenta";
import { Tone, transport } from './ToneService';


/*
The magenta model makes predictions based on probabilities.
The number of classes is NUM_SPECIAL_MELODY_EVENTS + midi-note-range
The valid note range depends on the model being used
Class 0 = no event
Class 1 = note-off event
*/
export const useMagentaIntegration = (
    // key: KeyName,
    // bpm: number,
    // modelCheckpointURL: string, 
    // basicPitchSeq: INoteSequence,
    // selectedModel: ModelKey,
    // setSelectedModel: React.Dispatch<React.SetStateAction<ModelKey>>,
    // isModelLoading: boolean,
    // setIsModelLoading: React.Dispatch<React.SetStateAction<boolean>>,
    // isGeneratingNotes: boolean,
    // setIsGeneratingNotes: React.Dispatch<React.SetStateAction<boolean>>
    {
       selectedModel,
       setSelectedModel,
       isModelLoading,
       setIsModelLoading,
       isGeneratingNotes,
       setIsGeneratingNotes
    }: MagentaProps 
) => {
    // // Model Checkpoints for pre-trained MagentaJS Models
    const musicModel = useRef<MusicRNN | null>(null);

    // // Key to number mapping
    const KEY_NUMBERS = CONSTANTS.KEY_NUMBERS;

    // Loads Model When Browser Loads
    useEffect (() => {
        setSelectedModel(selectedModel);
        const modelURL = CONSTANTS[selectedModel].URL

        const loadModel = async () => {
            setIsModelLoading(true);
            if (isModelLoading){
                console.log(`model loading`);
            }
            try {
                // Get model
                const rnn = new MusicRNN(modelURL);
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
            
            // Outputs model config
            await fetch(`${modelURL}/config.json`)
                .then((response) => response.json())
                .then((spec) => {
                    console.log('Fetched config.json for model: ', spec);
            });
        }

        loadModel();
    }, [selectedModel]);

    // Uses ToneJS to play notes returned from Magenta model
    const playNotes = async (notes : INoteSequence, keySig: KeySigName, bpm : number) => {
        // Interval that sequence needs to be transposed
        const interval = KEY_NUMBERS[keySig];

        // Calculate which measure to start part on
        // const position = Tone.getTransport().position as string; // Bars:Beats:Sixteenths
        const position = transport.position as string; // Bars:Beats:Sixteenths
        console.log('transport position (playNotes): ', position);
        console.log('transport (playNotes): ', transport);
        console.log('transport loop (playNotes): ', transport.loop);
        

        const currentBar = parseInt(position.split(":")[0]);

        let startBar = currentBar + 1;
        // offset by 2: ignore measure 1 (countin)
        while ((startBar - 1) % 4 !== 0) {
            startBar++;
        }

        // Define start time based on measure
        console.log('startBar: ', startBar);

        // const transport = getTransport();
        transport.bpm.value = bpm;
        console.log('bpm in playNotes: ', bpm);

        // Make sure note sequence isn't zero length
        if (notes.notes && notes.notes.length === 0) {
            console.log("playNotes: note sequence had zero length");
            return;
        } else{
            const toneJSNotes = await magentaToToneSeq(notes, interval, startBar);
            console.log("toneJSNotes: ", toneJSNotes);
            const noteLetters: string[] = [];
            toneJSNotes.notes.forEach((note) => {
                noteLetters.push(Tone.Frequency(note, "midi").toNote());
            })
            console.log("noteLetters");
            console.log(noteLetters);

            // Create instrument that plays predicted notes
            const instrument = new Sampler({
                urls: {
                    C4 : "C4.mp3",
                    D4 : "D4.mp3",
                    E4 : "C4.mp3",
                },
                release: 1,
                baseUrl : "/samples/",
                onload: () => {
                    // This code will only run AFTER "C4.mp3" is loaded and ready.
                    console.log('Sampler is loaded and can now be played.');
                    
                    // Now it is safe to trigger the sound.
                    instrument.triggerAttackRelease("C4", "8n");
                }
            }).toDestination();

            // const instrument = new Tone.MonoSynth({
            //     "volume": -8,
            //     "detune": 0,
            //     "portamento": 0,
            //     "envelope": {
            //         "attack": 0.05,
            //         "attackCurve": "linear",
            //         "decay": 0.3,
            //         "decayCurve": "exponential",
            //         "release": 0.8,
            //         "releaseCurve": "exponential",
            //         "sustain": 0.4
            //     },
            //     "filter": {
            //         "Q": 1,
            //         "detune": 0,
            //         "frequency": 0,
            //         "gain": 0,
            //         "rolloff": -12,
            //         "type": "lowpass"
            //     },
            //     "filterEnvelope": {
            //         "attack": 0.001,
            //         "attackCurve": "linear",
            //         "decay": 0.2,
            //         "decayCurve": "exponential",
            //         "release": 0.2,
            //         "releaseCurve": "exponential",
            //         "sustain": 0.1,
            //         "baseFrequency": 300,
            //         "exponent": 2,
            //         "octaves": 4
            //     }
            // }).toDestination();

            // Adds notes from to note sequence to transport
            for (let i = 0; i < toneJSNotes.notes.length; i++) {
                const noteTime = toneJSNotes.time[i];
                const noteDuration = toneJSNotes.duration[i];
                const notePitch = toneJSNotes.notes[i];

                transport.scheduleOnce((time) => {
                    instrument.triggerAttackRelease(notePitch, noteDuration, time);
                }, noteTime);  
            }
        }
    }

    // --- Logic for processing and playing next notes
    // --- asynchronous function for getting results from the magenta model
    const predictNotes = async (chordProg: string[], basicPitchSeq: INoteSequence) => {
        if (!basicPitchSeq || Object.keys(basicPitchSeq).length === 0) {
            console.log("basicPitchSeq is empty or undefined");
        }
        if (musicModel.current != null) {
            try {
                console.log('predictNotes basicPitchSeq: ', basicPitchSeq)
                basicPitchSeq.quantizationInfo = { stepsPerQuarter: 4 };
                // Quantize NoteSequence and Transpose all pitches into valid range for Magenta
                let quantNoteSeq = quantizeNoteSequence(basicPitchSeq, 4) as INoteSequence;
                console.log('pre transpose: ', quantNoteSeq);
                quantNoteSeq = transposeToValidPitchRange(quantNoteSeq, selectedModel);
                
                console.log("quantNoteSeq.steps: ", quantNoteSeq.totalQuantizedSteps);
                // console.log("quantNoteSeq: ", quantNoteSeq);

                // Get next note predictions from Magenta model
                // 4 steps/quarter -> 64 steps for 4 measures
                let magentaResultLen = 0;
                let magentaResult: INoteSequence = new NoteSequence();
                
                while (magentaResultLen === 0) {
                    // Only used chord progression if proper model is selected
                    if (selectedModel === "CHORD_PITCHES_IMPROV_RNN") {
                        console.log('chord prog: ', chordProg);
                        magentaResult = await musicModel.current.continueSequence(quantNoteSeq, 64, 0.75, chordProg) as INoteSequence;
                    } else {
                        magentaResult = await musicModel.current.continueSequence(quantNoteSeq, 64, 0.75) as INoteSequence;
                    }
                    magentaResultLen = magentaResult.notes?.length ?? 0;
                    console.log('magentaResultLen: ', magentaResultLen);
                }

                return magentaResult;
            }
            catch (err) {
                console.error("Quantization or continuation error: ", err);
            }
        } else {
            console.log('musicModel is not initialized');
        }
            return new NoteSequence();
    }



    return({
        // isModelLoading,
        // isGeneratingNotes,
        // selectedModel,
        // setSelectedModel,
        predictNotes,
        playNotes
    });
}
