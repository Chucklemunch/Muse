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

### Demo Video

COMING SOON...

### TODOs
- Make sure tempo is successfully updated and passed to websocket
- Makes sure notes are played in time
- Add pitch bends to ToneJS seq that are contained within Basic Pitches results