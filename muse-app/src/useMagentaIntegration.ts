import { MusicRNN, NoteSequence } from "@magenta/music";
import { transposeToValidPitchRange } from "./utils";
import { quantizeNoteSequence } from "@magenta/music/esm/core/sequences";
import { useEffect, useRef, useState } from "react";


export const useMagentaIntegration = (modelCheckpoint: string, basicPitchSeq: NoteSequence) => {
    // Model Checkpoints for pre-trained MagentaJS Models
     
    const musicModel = useRef<MusicRNN | null>(null);

    // Managing Model State
    const [selectedModel, setSelectedModel] = useState<string>(modelCheckpoint);
    const [isModelLoading, setIsModelLoading] = useState<boolean>(false);
    const [isGeneratingNote, setIsGeneratingNotes] = useState<boolean>(false);


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
            
            // Outputs model config
            await fetch(`${selectedModel}/config.json`)
                .then((response) => response.json())
                .then((spec) => {
                    console.log('Fetched config.json for model: ', spec);
            });
        }

        loadModel();
    }, [selectedModel]);

    // --- Logic for processing and playing next notes
    // --- asynchronous function for getting results from the magenta model
    const predictAndPlay = async () => {
        if (!basicPitchSeq || Object.keys(basicPitchSeq).length === 0) {
            console.log("basicPitchSeq is empty or undefined")
        }
        if (musicModel.current != null) {
            try {
                setIsGeneratingNotes(true);

                // Quantize NoteSequence and Transpose all pitches into valid range for Magenta
                const quantNoteSeq = transposeToValidPitchRange(quantizeNoteSequence(basicPitchSeq, 8));

                console.log("quantNoteSeq.steps: ", quantNoteSeq.totalQuantizedSteps)
                console.log("quantNoteSeq: ", quantNoteSeq)
                // const magentaResult = await musicModel.current.continueSequence(quantNoteSeq, 64, 0.3);
                const magentaResult = await musicModel.current.continueSequenceAndReturnProbabilities(quantNoteSeq, 256, 0.3);
                console.log("magenta result: ", magentaResult)
                
                setIsGeneratingNotes(false)
                return magentaResult;
            }
            catch (err) {
                console.error("Quantization or continuation error: ", err)
            }
        } else {
            console.log('musicModel is not initialized');
        }

    }

    return({
        isModelLoading,
        isGeneratingNote,
        selectedModel,
        setSelectedModel,
        predictAndPlay
    });
}