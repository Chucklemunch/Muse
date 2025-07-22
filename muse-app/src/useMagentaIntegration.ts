import { MusicRNN, NoteSequence } from "@magenta/music";
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
        }

        loadModel();

    }, [selectedModel]);

    // --- Logic for processing and playing next notes
    const predictAndPlay = () => {
        if (musicModel.current != null) {
            setIsGeneratingNotes(true);
            console.log(`basicPitchSeq : ${basicPitchSeq}`)
            const magentaResult = musicModel.current.continueSequence(basicPitchSeq, 10);
            console.log(`magenta result: ${magentaResult}`)
            return magentaResult;
        } else {
            console.log('error in predictAndPlay');
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