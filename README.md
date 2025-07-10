# Muse
- What: A web app that listens to the user’s guitar playing (via mic) and shows real-time visual feedback on scales, keys, and suggested note transitions for improvisation.
- Unique angle: Uses ML to analyze note sequences and suggests "next-tone probabilities" like predictive text, but for solos.
- Tech: Web Audio API, ML models trained on solos, pitch detection (e.g., YIN, CREPE).

### Core Features
- Live audio input
- Pitch/string detection from audio input
- Integration with LLM API (maybe ChatGPT) to generate detailed tab and rhythm suggestions for the next measures
- Parsing of LLM tab/rhythm output that is converted to a playback
- Next note(s) suggestions

### Potential Tools/Datasets
- [Librosa](https://librosa.org/doc/latest/index.html) (Python) for audio analysis in the backend
- [Guitar Sounds Dataset](https://www.idmt.fraunhofer.de/en/publications/datasets/guitar.html) for training a string classifier (which string a note is coming from)
