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
    basicPitchSeq: INoteSequence,
    temperature: number,
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
    basicPitchSeq,
    temperature,
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
    })

    // Makes call to Magenta model and plays it's output
    const predictAndPlay = useCallback(async () =>  {
        // console.log('predictAndPlay basicPitchSeq: ', basicPitchSeq);
        
        // Gets note generated from Magenta model
        const magentaSeq = await predictNotes(temperature, chordProg, basicPitchSeq);
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

    return null;
}

export default Magenta;