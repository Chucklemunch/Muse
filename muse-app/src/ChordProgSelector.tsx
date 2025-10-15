import React from "react";
import { Box, FormControl, InputLabel, Select, MenuItem, Typography } from "@mui/material";

const chords = [
  "I", "ii", "II", "iii", "IV", "V", "vi", "VI",  "vii°",
  "i", "III", "iv", "v", "bVI", "bVII"
];


export interface ChordProgSelectorProps {
  chordProg: string[];
  setChordProg: React.Dispatch<React.SetStateAction<string[]>>;
  isJamming: boolean;
}

const ChordProgSelector: React.FC<ChordProgSelectorProps> = ({
  chordProg,
  setChordProg,
  isJamming
}) => {

  const handleChange = (index: number, value: string) => {
    const newProgression = [...chordProg];
    newProgression[index] = value;
    setChordProg(newProgression);
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 1
      }}
    >
      <Typography variant="h6" fontWeight="bold" gutterBottom>
        Chord Progression
      </Typography>

      <Box sx={{ display: "flex", gap: 2 }} >
        {chordProg.map((chord, i) => (
          <FormControl key={i} sx={{ minWidth: 80 }}>
            <InputLabel>Chord</InputLabel>
            <Select
              value={chord}
              label="Chord"
              onChange={(e) => handleChange(i, e.target.value)}
              disabled={isJamming}
            >
              {chords.map((c) => (
                <MenuItem key={c} value={c}>
                  {c}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ))}
      </Box>
    </Box>
  );
}

export default ChordProgSelector;