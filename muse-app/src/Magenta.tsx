import { useMagentaIntegration } from "./useMagentaIntegration";
import { type INoteSequence } from "@magenta/music";
import type { KeySigName, ModelKey } from "./types";
import { useCallback, useEffect } from "react";
import type { Tone } from "./ToneService";

export interface MagentaProps {
    keySig: KeySigName,
    bpm: number,
    chordProg: string[],
    instrument: Tone.Synth | Tone.Sampler,
    modelCheckpointURL?: string,
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
    chordProg,
    instrument,
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
        selectedModel,
        setSelectedModel,
        isModelLoading,
        setIsModelLoading,
        isGeneratingNotes,
        setIsGeneratingNotes,
        modelCheckpointURL,
        keySig,
        bpm,
        instrument,
        chordProg,
        basicPitchSeq
    })

    // Makes call to Magenta model and plays it's output
    const predictAndPlay = useCallback(async () =>  {
        // console.log('predictAndPlay basicPitchSeq: ', basicPitchSeq);
        
        // Gets note generated from Magenta model
        const magentaSeq = await predictNotes(chordProg, basicPitchSeq);
        setIsGeneratingNotes(false);

        // Plays notes using Tone.JS
        await playNotes(magentaSeq, keySig, bpm, instrument);
    }, [predictNotes, playNotes])

    useEffect(() => {
        if (isGeneratingNotes) {
            console.log('isGeneratingNotes inside useEffect');
            predictAndPlay();
        }
    },[isGeneratingNotes]);


    // console.log('keySig: ', keySig);
    // console.log('bpm: ', bpm,);
    // console.log('modelCheckpointURL: ', modelCheckpointURL);
    // console.log('basicPitchSeq: ', basicPitchSeq);
    // console.log('selectedModel: ', selectedModel);
    // console.log('isModelLoading: ', isModelLoading);
    // console.log('isGeneratingNotes: ', isGeneratingNotes);

    return null;
}

export default Magenta;