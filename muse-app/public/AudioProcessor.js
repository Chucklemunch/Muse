class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
    }

    // Takes input from Audio Context (stereo sound, two duplicate channels)
    // and sends just a single channel of audio
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
