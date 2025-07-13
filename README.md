# Muse
- What: A web app that listens to the user’s playing (start with piano, figure out guitar later)(via mic) and shows real-time visual feedback on scales, keys, and suggested note transitions for improvisation.
- Unique angle: Uses ML to analyze note sequences and suggests "next-tone probabilities" like predictive text, but for solos.

### Core Features
- Live audio input
- Converts audio to MIDI
- Integration with LLM API (maybe ChatGPT) to generate detailed note and rhythm suggestions for the next measures
- Next note(s) suggestions

### Potential Tools/Datasets
- [Librosa](https://librosa.org/doc/latest/index.html) (Python) for audio analysis in the backend
- [Guitar Sounds Dataset](https://www.idmt.fraunhofer.de/en/publications/datasets/guitar.html) for training a string classifier (which string a note is coming from)
- [MAESTRO Dataset](https://magenta.tensorflow.org/datasets/maestro#dataset) contains hours of piano playing from competition, but it's too big for a local machine (120 GB)
- [Spotify Basic Pitch](https://basicpitch.spotify.com/about) converts audio files to MIDI
- [Google Magenta Music Models](https://magenta.withgoogle.com/magenta-realtime)
- [Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) for processing incoming audio to not block main UI thread
- 

### How am I  going to convert audio to MIDI to audio?
- Audio to Midi: Spotify Basic Pitch OR Magenta. Gemini suggests using Spotify basic-pitch because it is more specifically designed for converting instruments to MIDI
- Midi to Audio: Magenta models
From Gemini:
Example Concurrent Flow:

Main Thread (UI, Playback Scheduling):

    Sets up MediaStream (microphone input).

    Creates and manages Web Workers for basic-pitch and Magenta.js.

    Receives generated MIDI notes from the Magenta.js worker.

    Uses Tone.js to schedule and play notes, managing an output queue to ensure continuous sound.

Web Worker 1 (Audio Transcription - basic-pitch):

    Receives small audio chunks from the main thread.

    Performs basic-pitch inference.

    Sends detected MIDI events (note-on, note-off, pitch, velocity, time) back to the main thread or directly to the AI model worker.

Web Worker 2 (AI Music Generation - Magenta.js ImprovRNN):

    Receives a stream of incoming MIDI events (or a continuously updated NoteSequence primer) from the transcription worker or main thread.

    Continuously calls improvRnn.continueSequence() to generate short segments (e.g., 1-4 beats) of new MIDI.

    Sends these generated MIDI segments back to the main thread for playback.
