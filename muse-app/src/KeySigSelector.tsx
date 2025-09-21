import React from "react";
import {
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  Box,
  Grid
} from "@mui/material";

export type KeySigName =
  | "C" | "Db" | "D" | "Eb" | "E"
  | "F" | "F#" | "G" | "Ab" | "A"
  | "Bb" | "B" | "Cm" | "C#m" | "Dm"
  | "Ebm" | "Em" | "Fm" | "F#m" | "Gm"
  | "G#m" | "Am" | "Bbm" | "Bm";

export interface KeySigSelectorProps {
  keySig: KeySigName;
  setKeySig: React.Dispatch<React.SetStateAction<KeySigName>>;
}

const KEYS: KeySigName[] = [
  "C", "Db", "D", "Eb", "E",
  "F", "F#", "G", "Ab", "A",
  "Bb", "B", "Cm", "C#m", "Dm",
  "Ebm", "Em", "Fm", "F#m", "Gm",
  "G#m", "Am", "Bbm", "Bm"
];

const KeySigSelector: React.FC<KeySigSelectorProps> = ({ keySig, setKeySig }) => {
  const handleChange = (_: React.MouseEvent<HTMLElement>, newKey: KeySigName | null) => {
    if (newKey !== null) {
      setKeySig(newKey);
    }
  };

  return (
    <Box sx={{ textAlign: "center", margin: "2rem auto" }}>
      <Typography variant="h6" fontWeight="bold" gutterBottom>
        Select Key Signature
      </Typography>
      <ToggleButtonGroup
        value={keySig}
        exclusive
        onChange={handleChange}
        sx={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 1 }}
      >
        {KEYS.map((k) => (
          <ToggleButton key={k} value={k} sx={{ textTransform: "none"}}>
            {k}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Box>
  );
};

export default KeySigSelector;
