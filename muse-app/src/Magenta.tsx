import { useMagentaIntegration } from "./useMagentaIntegration";
import { type INoteSequence } from "@magenta/music";
import type { KeySigName, ModelKey } from "./types";
import { useCallback, useEffect } from "react";

export interface MagentaProps {
    keySig: KeySigName,
    bpm: number,
    modelCheckpointURL: string,
    basicPitchSeq: INoteSequence,
    selectedModel: ModelKey,
    setSelectedModel: React.Dispatch<React.SetStateAction<ModelKey>>,
    isModelLoading: boolean,
    setIsModelLoading: React.Dispatch<React.SetStateAction<boolean>>,
    isGeneratingNotes: boolean,
    setIsGeneratingNotes: React.Dispatch<React.SetStateAction<boolean>>,
}



const Magenta: React.FC<MagentaProps> =({ 
    keySig,
    bpm,
    modelCheckpointURL,
    basicPitchSeq,
    selectedModel,
    setSelectedModel,
    isModelLoading,
    setIsModelLoading,
    isGeneratingNotes,
    setIsGeneratingNotes
}: MagentaProps) => {

    const {predictNotes, playNotes} = useMagentaIntegration({
        keySig,
        bpm,
        modelCheckpointURL,
        basicPitchSeq,
        selectedModel,
        setSelectedModel,
        isModelLoading,
        setIsModelLoading,
        isGeneratingNotes,
        setIsGeneratingNotes
    })

    // Makes call to Magenta model and plays it's output
    const predictAndPlay = useCallback(async () =>  {
        // Gets note generated from Magenta model
        const magentaSeq = await predictNotes(keySig, bpm, basicPitchSeq);
        setIsGeneratingNotes(false);

        // Plays notes using Tone.JS
        await playNotes(magentaSeq, keySig, bpm);
    }, [predictNotes, playNotes])

    useEffect(() => {
        if (isGeneratingNotes) {
            console.log('isGeneratingNotes inside useEffect');
            predictAndPlay();
        }
    },[isGeneratingNotes, predictAndPlay]);


    console.log('keySig: ', keySig);
    console.log('bpm: ', bpm,);
    console.log('modelCheckpointURL: ', modelCheckpointURL);
    console.log('basicPitchSeq: ', basicPitchSeq);
    console.log('selectedModel: ', selectedModel);
    console.log('isModelLoading: ', isModelLoading);
    console.log('isGeneratingNotes: ', isGeneratingNotes);

    return null;
}

export default Magenta;