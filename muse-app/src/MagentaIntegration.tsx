import React from "react";
import { useMagentaIntegration } from "./useMagentaIntegration";
import { type INoteSequence } from "@magenta/music";

interface MagentaProps {
    modelCheckpointURL: string,
    basicPitchSeq: INoteSequence
}

export default function MagentaIntegration({ modelCheckpointURL, basicPitchSeq }: MagentaProps) {
    const { 
        isModelLoading, 
        isGeneratingNote,
        selectedModel,
        setSelectedModel,
        predictNotes
    } = useMagentaIntegration(modelCheckpointURL, basicPitchSeq);

    return null;
}