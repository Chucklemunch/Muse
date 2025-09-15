class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0]
        
        if (input) {
            this.port.postMessage(input.slice());
        }
        return true;
    }

}

registerProcessor("audio-processor", AudioProcessor);
