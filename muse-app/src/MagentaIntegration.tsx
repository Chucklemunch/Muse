import { MusicRNN } from "@magenta/music";
import { useEffect, useState } from "react";

const MagentaIntegration: React.FC = () => {
    // Model Checkpoints for pre-trained MagentaJS Models
    const CHORD_PITCHES_IMPROV_RNN = "https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/chord_pitches_improv";
    const BASIC_RNN = "https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/basic_rnn"; 
     
    // Managing Model State
    const [selectedModel, setSelectedModel] = useState<string>(BASIC_RNN);
    const [isModelLoading, setIsModelLoading] = useState<boolean>(false);
    const [isGeneratingNote, setIsGeneratingNotes] = useState<boolean>(false);


    const modelURL = BASIC_RNN;

    // Loads Model When Browser Loads
    useEffect (() => {
        const loadModel = async () => {
            setIsModelLoading(true);
            console.log(`model loading`);
            
            try {
                // Get model
                music_model = new MusicRNN(BASIC_RNN);
                await music_model.initialize();
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


    }, [modelURL]);


    return (
         <>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '30px' }}>
                <button
                    disabled={isModelLoading}
                    style={{ backgroundColor: (selectedModel === BASIC_RNN) ? '#cccccc' : '#28a745', color: 'white' }}
                >
                    BasicRNN
                </button>
                <button
                    disabled={isModelLoading}
                    style={{ backgroundColor: (selectedModel === CHORD_PITCHES_IMPROV_RNN) ? '#cccccc' : '#28a745', color: 'white' }}
                >
                    ChordPitchImproveRNN
                </button>
            </div>        
        </>
    );

}


export default MagentaIntegration;