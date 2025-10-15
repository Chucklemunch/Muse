import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  Box,
  Button
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

export default function Instructions() {
  const [open, setOpen] = useState(true); // starts visible

  const handleClose = () => setOpen(false);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
    >
      {/* Header with close button */}
      <DialogTitle>
        Instructions
        <IconButton
          aria-label="close"
          onClick={handleClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      {/* Body content */}
      <DialogContent dividers>
        <Typography gutterBottom>
          Welcome to <strong>Muse</strong>! 🎵
        </Typography>
        <br/>
        <Typography gutterBottom>
          To get started:
        </Typography>
        <Box component="ul" sx={{ pl: 3 }}>
          <li><Typography>Allow microphone access when prompted.</Typography></li>
          <li><Typography>Select tempo, key, chord progression, and how spicy your want Muse to be.</Typography></li>
          <li><Typography>Start the jam!</Typography></li>
          <li><Typography>Muse will count in one measure, then begin trading 8s with you!
            <br/>(You play 8 measures, then Muse plays 8 measures)</Typography></li>
          <li><Typography><i>Note: After the count-in, the jam starts with you, so be ready!</i></Typography></li>
        </Box>
        <br/>
        <Typography gutterBottom>
          Useful Tips:
        </Typography>          
        <Box component="ul" sx={{ pl: 3}} >
            <li><Typography>Make sure your internet connection is strong.</Typography></li>
            <li><Typography>Setting tempo too fast can make Muse struggle.</Typography></li>
            <li><Typography>The "Spiciness" sets the temperature of Muse's model. Thus more spiciness will 
                make Muse more likely to play non-diatonically.</Typography></li>
            <li><Typography>Selecting the 'Key' determines the key of the model output,
                but you can select a chord progression that contains non-diatonic chords. 
                For example, you can have Muse improvise in the key of Am, but play 
                a chord progression typical in the key of A (major) for a bluesy sound. </Typography></li>
        </Box>
      </DialogContent>

      {/* Optional button at the bottom */}
      <Box display="flex" justifyContent="flex-end" p={2}>
        <Button onClick={handleClose} variant="contained" color="primary">
          Got it
        </Button>
      </Box>
    </Dialog>
  );
}