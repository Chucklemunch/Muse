# Muse
- What: A web app that can jam along with the user

### Environments
- FastAPI backend is run in a miniconda environment that uses python 3.10
- Python 3.10 was necessary for compatability with some Magenta and Tensorflow dependencies

### Core Features
- Live audio input
- Uses Spotify's Basic Pitch Model to convert raw audio to MIDI
- Uses MagentaJS's MusicRNN models to generate a note sequence to be output as computer audio
- Allows user to "trade" bars with an AI.

### Tools/Resources
- [Spotify Basic Pitch](https://basicpitch.spotify.com/about) converts audio files to MIDI
- [Google Magenta Music Models](https://magenta.withgoogle.com/magenta-realtime)
- [MagentaJS](https://github.com/magenta/magenta-js) for MIDI to music production in frontend after backen processing with basic-pitch
- [Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) for processing incoming audio to not block main UI thread
- [FastAPI](https://fastapi.tiangolo.com/) for Python backend
- [ToneJS](https://tonejs.github.io/docs/15.1.22/index.html) for playback
- [Melody_RNN](https://gitlab.cci.drexel.edu/tjh346/CI103-66-003/-/tree/bc0f46c69f4174f280facb0088c5e6f67188e546/Magenta/magenta-master/magenta/models/melody_rnn?utm_source=chatgpt.com) Info about how to train new models. Also says that all output are in key of C, so we need to transpose output

### How am I  going to convert audio to MIDI to audio?
- Audio to Midi: Spotify Basic Pitch OR Magenta. Gemini suggests using Spotify basic-pitch because it is more specifically designed for converting instruments to MIDI
- Midi to Audio: Magenta models
- [Magenta Model Checkpoints](https://github.com/magenta/magenta-js/blob/master/music/checkpoints/README.md#table)
1. Chunk audio input into measures (or a few measures) and send it to the basic-pitch python backend for processing
2. Send MIDI output from basic-pitch backend to frontend where Magenta models will process it on a web worker and output more MIDI notes that represent next notes
3. Play MIDI notes through some sort of player to create a continuous jam loop of you play -> AI plays -> you play -> etc.

### TODOs
- Connect basic-pitch model between .ts frontend and FastAPI backend (DONE)
- Add access to magenta models and ability to load different model based on checkpoint (DONE)
- Convert output from basic-pitch to NoteSequence that can be fed into magenta model: Need to transpose out of range notes (DONE)
- Make magenta model output next notes and play through speaker (DONE)
- Make NoteSequence have time information that can be interpreted in measures/beats, so that model outputs can be scheduled (DONE)
- Create audio player that uses ToneJS's Sampler to use piano (or other) sounds to play output from Magenta model (DONE)
- Add tempo control and a metronome of sorts (DONE)
- Add ability to select key (DONE)
- Transpose sequence output from Magenta model to be in user selected key (DONE)
- Restructure how audio is recorded so only one message is sent to basic-pitch during recording: Set up audio recording to record user audio and pass it to basic pitch model in time (DONE)
- Set up microphone connection and a count-in before the recording starts (DONE)
- Change audio recording to AudioWorklet to allow for better streaming (DONE)
- Debug magenta generation after basic-pitch seq gets sent (DONE)
- Correct creation of ToneJS notes so that they play within desired time frame and in time (DONE)
- Figure out how to chunk audio by number of beats/notes (DONE)
- Add time signature feature that changes how MIDI gets processed
- Make UI cool and pretty
