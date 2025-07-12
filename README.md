# Muse
- What: A web app that listens to the user’s playing (start with piano, figure out guitar later)(via mic) and shows real-time visual feedback on scales, keys, and suggested note transitions for improvisation.
- Unique angle: Uses ML to analyze note sequences and suggests "next-tone probabilities" like predictive text, but for solos.
- Tech: Web Audio API, ML models trained on solos, pitch detection (e.g., YIN, CREPE).

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

### How am I  going to convert audio to MIDI to audio?
- Audio to Midi: Spotify Basic Pitch OR Magenta
- Midi to Audio: Magenta + something else?
