class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0]
        const ch0 = input[0];

        if (ch0) {
            this.port.postMessage(ch0.slice());
        }
        return true;
    }

}

registerProcessor("audio-processor", AudioProcessor);
