import { MusicRNN, NoteSequence, type INoteSequence } from "@magenta/music";
import { CONSTANTS, KEY_NUMBERS, transposeToValidPitchRange, magentaToToneSeq } from "./utils";
import type { KeySigName } from "./types";
import { quantizeNoteSequence } from "@magenta/music/esm/core/sequences";
import { useEffect, useRef } from "react";
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
    //    isGeneratingNotes,
    //    setIsGeneratingNotes,
    //    instrument,
    //    chordProg,
    //    basicPitchSeq
    }: MagentaProps 
) => {
    // // Model Checkpoints for pre-trained MagentaJS Models
    const musicModel = useRef<MusicRNN | null>(null);

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
    const playNotes = async (notes : INoteSequence, keySig: KeySigName, bpm : number, instrument: Tone.Sampler | Tone.Synth) => {
        // Interval that sequence needs to be transposed
        const interval = KEY_NUMBERS[keySig];

        // Calculate which measure to start part on
        // const position = Tone.getTransport().position as string; // Bars:Beats:Sixteenths
        const position = transport.position as string; // Bars:Beats:Sixteenths
        console.log('transport position (playNotes): ', position);
        console.log('transport (playNotes): ', transport);
        console.log('transport loop (playNotes): ', transport.loop);
        
        const startBar = 5; // trading 4's means user has bars 1-4 and AI has 5-8

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
                basicPitchSeq.tempos = [{ qpm : transport.bpm.value }];
                
                console.log('basicPitchSeq: ', basicPitchSeq);

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
                        magentaResult = await musicModel.current.continueSequence(quantNoteSeq, 64, 2, chordProg) as INoteSequence;
                    } else {
                        magentaResult = await musicModel.current.continueSequence(quantNoteSeq, 64, 2) as INoteSequence;
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
