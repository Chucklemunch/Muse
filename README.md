# Muse: Jamming with AI
### Demo Video : *Download raw mp4 "muse-demo.mp4" from files to view. Video is too large to embed here*.

![alt text](/media/top-half.png)
![alt text](/media/bottom-half.png)

### Environments
- FastAPI backend is run in a miniconda environment that uses Python 3.10
- Python 3.10 was necessary for compatability with some Magenta and Tensorflow dependencies

### Core Features
- Live audio input from user
- Uses [Spotify's Basic Pitch Model](https://basicpitch.spotify.com/about) to convert raw audio to MIDI
- Uses [MagentaJS's](https://github.com/magenta/magenta-js) MusicRNN models to generate a note sequence to be output as computer audio
- Allows user to "trade" bars with an AI.

### Tools/Resources
- [FastAPI](https://fastapi.tiangolo.com/)
- [MagentaJS](https://github.com/magenta/magenta-js)
- [Spotify's Basic Pitch Model](https://basicpitch.spotify.com/about)
- [ToneJS](https://tonejs.github.io/docs/15.1.22/index.html)
- [Melody_RNN](https://gitlab.cci.drexel.edu/tjh346/CI103-66-003/-/tree/bc0f46c69f4174f280facb0088c5e6f67188e546/Magenta/magenta-master/magenta/models/melody_rnn?utm_source=chatgpt.com)
