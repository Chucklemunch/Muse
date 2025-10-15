import React from "react";
import { Slider, Typography, Box } from "@mui/material";

export interface TemperatureControlProps {
  isJamming: boolean;
  temperature: number;
  setTemperature: React.Dispatch<React.SetStateAction<number>>;
}

const TemperatureControl: React.FC<TemperatureControlProps> = ({ temperature, isJamming, setTemperature }) => {
  const handleChange = (_: Event, value: number | number[]) => {
    const temp = Array.isArray(value) ? value[0] : value;
    setTemperature(temp);
    console.log('model temperature changed to: ', temp);
  };

  return (
    <Box sx={{ width: 300, margin: "2rem auto", textAlign: "center" }}>
      <Typography variant="h6" fontWeight="bold" gutterBottom>
        Spiciness
      </Typography>
      <Slider
        value={temperature}
        onChange={handleChange}
        disabled={isJamming}
        min={0}
        max={3}
        step={0.1}
        valueLabelDisplay="auto"
        sx={{ color: "#fa0a6eff" }}
      />
      <Typography variant="body1">{temperature}</Typography>
    </Box>
  );
};

export default TemperatureControl;
