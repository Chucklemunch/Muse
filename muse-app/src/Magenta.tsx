import { useMagentaIntegration } from "./useMagentaIntegration";
import { type INoteSequence } from "@magenta/music";
import type { KeyName, ModelKey } from "./types";

export interface MagentaProps {
    key: KeyName,
    bpm: number,
    modelCheckpointURL: string,
    basicPitchSeq: INoteSequence,
    selectedModel: ModelKey,
    setSelectedModel: React.Dispatch<React.SetStateAction<ModelKey>>,
    isModelLoading: boolean,
    setIsModelLoading: React.Dispatch<React.SetStateAction<boolean>>,
    isGeneratingNotes: boolean,
    setIsGeneratingNotes: React.Dispatch<React.SetStateAction<boolean>>
}



export default function Magenta({ 
    key,
    bpm,
    modelCheckpointURL,
    basicPitchSeq,
    selectedModel,
    setSelectedModel,
    isModelLoading,
    setIsModelLoading,
    isGeneratingNotes,
    setIsGeneratingNotes
}: MagentaProps) {

const {predictNotes} = useMagentaIntegration(
    key,
    bpm,
    modelCheckpointURL,
    basicPitchSeq,
    selectedModel,
    setSelectedModel,
    isModelLoading,
    setIsModelLoading,
    isGeneratingNotes,
    setIsGeneratingNotes
)

    console.log(
        key,
        bpm,
        modelCheckpointURL,
        basicPitchSeq,
        selectedModel,
        setSelectedModel,
        isModelLoading,
        setIsModelLoading,
        isGeneratingNotes,
        setIsGeneratingNotes
    );

    return (
        <button
          onClick={() => predictNotes(key, bpm)}
          disabled={isGeneratingNotes}
          style={{ backgroundColor: isGeneratingNotes ? '#cccccc' : '#dc3545', color: 'white' }}
        >
          Predict and Play Notes
        </button>
    );
}