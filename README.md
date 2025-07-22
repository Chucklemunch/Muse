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
- [Spotify Basic Pitch](https://basicpitch.spotify.com/about) converts audio files to MIDI
- [Google Magenta Music Models](https://magenta.withgoogle.com/magenta-realtime)
- [MagentaJS](https://github.com/magenta/magenta-js) for MIDI to music production in frontend after backen processing with basic-pitch
- [Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) for processing incoming audio to not block main UI thread
- [FastAPI](https://fastapi.tiangolo.com/) for Python backend

### How am I  going to convert audio to MIDI to audio?
- Audio to Midi: Spotify Basic Pitch OR Magenta. Gemini suggests using Spotify basic-pitch because it is more specifically designed for converting instruments to MIDI
- Midi to Audio: Magenta models
1. Chunk audio input into measures (or a few measures) and send it to the basic-pitch python backend for processing
2. Send MIDI output from basic-pitch backend to frontend where Magenta models will process it on a web worker and output more MIDI notes that represent next notes
3. Play MIDI notes through some sort of player to create a continuous jam loop of you play -> AI plays -> you play -> etc.

### TODOs
**- Connect basic-pitch model between .ts frontend and FastAPI backend (DONE)
- Add access to magenta models and ability to load different model based on checkpoint (DONE)**
- Convert output from basic-pitch to NoteSequence that can be fed into magenta model
- Make magenta model output next notes and play through speaker: might want to upload sounds patches so it's not just a beep
- Set up microphone connection and a count-in before the recording starts
- Add time signature feature that changes how MIDI gets processed
- Add tempo control and a metronome of sorts
- Figure out how to chunk audio by number of beats/notes
- Make UI cool and pretty
