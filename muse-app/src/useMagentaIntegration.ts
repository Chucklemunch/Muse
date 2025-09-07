import { MusicRNN, NoteSequence, type INoteSequence } from "@magenta/music";
import { type ModelKey, CONSTANTS, transposeToValidPitchRange, magentaToToneSeq } from "./utils";
import { quantizeNoteSequence } from "@magenta/music/esm/core/sequences";
import { useEffect, useRef, useState } from "react";
import { getTransport, Sampler } from "tone";
import * as Tone from "tone";

/*
The magenta model makes predictions based on probabilities.
The number of classes is NUM_SPECIAL_MELODY_EVENTS + midi-note-range
The valid note range depends on the model being used
Class 0 = no event
Class 1 = note-off event
*/
export function useMagentaIntegration (modelCheckpointURL: string, basicPitchSeq: INoteSequence) {
    // Model Checkpoints for pre-trained MagentaJS Models
    const musicModel = useRef<MusicRNN | null>(null);

    // Managing Model State
    const [selectedModel, setSelectedModel] = useState<ModelKey>(modelCheckpointURL === CONSTANTS.MELODY_RNN.URL ? "MELODY_RNN" : 
                                                                modelCheckpointURL === CONSTANTS.CHORD_PITCHES_IMPROV_RNN.URL ? "CHORD_PITCHES_IMPROV_RNN" : "BASIC_RNN");
    const [isModelLoading, setIsModelLoading] = useState<boolean>(false);
    const [isGeneratingNote, setIsGeneratingNotes] = useState<boolean>(false);


    // Loads Model When Browser Loads
    useEffect (() => {
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
    const playNotes = async (notes : INoteSequence, bpm : number) => {
        // TODO NEED TO FIGURE OUT HOW TO SCHEDULE EVENTS ALONG TIMELINE USING TRANSPORT
        const transport = getTransport();
        transport.bpm.value = bpm;
        console.log(transport);

        // const notes :  INoteSequence = await predictNotes();
        
        // Make sure note sequence isn't zero length
        if (notes.notes && notes.notes.length === 0) {
            console.log("playNotes: note sequence had zero length");
            return;
        } else{
            const toneJSNotes = magentaToToneSeq(notes, bpm);
            console.log("toneJSNotes: ", toneJSNotes);

            // Create sampler that plays predicted notes
            const sampler = new Sampler({
                urls: {
                    A1: "A1.mp3",
                    A2: "A2.mp3",
                },
                baseUrl: "https://tonejs.github.io/audio/salamander/",
                onload: () => {

                    // Creating empty part
                    const part = new Tone.Part((time, value) => {
                        sampler.triggerAttackRelease(value.notePitch, value.noteDuration, time);
                    });

                    part.loop = false;

                    // Adds notes from to note sequence to Part to be played back
                    for (let i = 0; i < toneJSNotes.notes.length; i++) {
                        const noteTime = toneJSNotes.time[i];
                        const noteDuration = toneJSNotes.duration[i];
                        const notePitch = toneJSNotes.notes[i];
                        
                        part.add(noteTime, {notePitch, noteDuration});
                    }

                    part.start("+0.1")
                    transport.start("+0.1");
                },
            }).toDestination();
        }
    }

    // --- Logic for processing and playing next notes
    // --- asynchronous function for getting results from the magenta model
    const predictNotes = async (bpm : number) => {
        if (!basicPitchSeq || Object.keys(basicPitchSeq).length === 0) {
            console.log("basicPitchSeq is empty or undefined");
        }
        if (musicModel.current != null) {
            try {
                setIsGeneratingNotes(true);

                // Quantize NoteSequence and Transpose all pitches into valid range for Magenta
                const quantNoteSeq = transposeToValidPitchRange(quantizeNoteSequence(basicPitchSeq, 8), selectedModel);
                
                console.log("quantNoteSeq.steps: ", quantNoteSeq.totalQuantizedSteps);
                console.log("quantNoteSeq: ", quantNoteSeq);

                // Just to try outputting input sequence to audio
                console.log('playing input seq');
                // await playNotes(quantNoteSeq);


                // Get next note predictions from Magenta model
                const magentaResult : INoteSequence = await musicModel.current.continueSequence(quantNoteSeq, 128, 5) as INoteSequence;

                console.log("magenta result: ", magentaResult);
                console.log("magenta result sequence type: ", typeof(magentaResult));
                
                setIsGeneratingNotes(false);

                
                // Started audio context
                // await Tone.start();
                // console.log("context started");

                // Function call that plays notes as audio
                console.log('playing magenta seq');
                await playNotes(magentaResult, bpm);
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
        isModelLoading,
        isGeneratingNote,
        selectedModel,
        setSelectedModel,
        predictNotes,
        playNotes
    });
}
