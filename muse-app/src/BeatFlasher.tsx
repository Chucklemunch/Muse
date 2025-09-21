import React from "react";
import { Box, Typography } from "@mui/material";

interface BeatFlasherProps {
  currentBeat: number;       // 1, 2, 3, 4…
  beatsPerMeasure?: number;  // default 4
}

const BeatFlasher: React.FC<BeatFlasherProps> = ({
  currentBeat,
  beatsPerMeasure = 4
}) => {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", gap: 2, mt: 2 }}>
      {Array.from({ length: beatsPerMeasure }, (_, i) => i + 1).map((beat) => (
        <Box
          key={beat}
          sx={{
            width: 50,
            height: 50,
            borderRadius: "50%",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            bgcolor: currentBeat === beat ? "primary.main" : "grey.300",
            color: currentBeat === beat ? "white" : "black",
            fontWeight: "bold",
            transition: "background-color 0.1s ease"
          }}
        >
          <Typography>{beat}</Typography>
        </Box>
      ))}
    </Box>
  );
};

export default BeatFlasher;
