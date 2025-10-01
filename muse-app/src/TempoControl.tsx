import React from "react";
import { transport } from './ToneService';
import { Slider, Typography, Box } from "@mui/material";

export interface TempoControlProps {
  tempo: number;
  setTempo: React.Dispatch<React.SetStateAction<number>>;
}

const TempoControl: React.FC<TempoControlProps> = ({ tempo, setTempo }) => {
  const handleChange = (_: Event, value: number | number[]) => {
    const bpm = Array.isArray(value) ? value[0] : value;
    setTempo(bpm);
    transport.bpm.value = bpm;
    console.log('tempo changed to: ', bpm);
  };

  return (
    <Box sx={{ width: 300, margin: "2rem auto", textAlign: "center" }}>
      <Typography variant="h6" fontWeight="bold" gutterBottom>
        Tempo
      </Typography>
      <Slider
        value={tempo}
        onChange={handleChange}
        min={40}
        max={240}
        step={1}
        valueLabelDisplay="auto"
        sx={{ color: "primary.main" }}
      />
      <Typography variant="body1">{tempo} BPM</Typography>
    </Box>
  );
};

export default TempoControl;
