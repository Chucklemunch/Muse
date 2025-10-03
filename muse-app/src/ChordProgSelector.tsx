import React from "react";
import { Box, FormControl, InputLabel, Select, MenuItem, Typography } from "@mui/material";

const chords = [
  "C", "Db", "D", "Eb", "E",
  "F", "F#", "G", "Ab", "A",
  "Bb", "B", "Cm", "C#m", "Dm",
  "Ebm", "Em", "Fm", "F#m", "Gm",
  "G#m", "Am", "Bbm", "Bm"
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


// import React from "react";

// const chords = [
//         "C",
//         "Db",
//         "D",
//         "Eb",
//         "E",
//         "F",
//         "F#",
//         "G",
//         "Ab",
//         "A",
//         "Bb",
//         "B",
//         "Cm",
//         "C#m",
//         "Dm",
//         "Ebm",
//         "Em",
//         "Fm",
//         "F#m",
//         "Gm",
//         "G#m",
//         "Am",
//         "Bbm",
//         "Bm",
// ];

// export interface ChordProgSelectorProps {
//     chordProg: string[],
//     setChordProg:  React.Dispatch<React.SetStateAction<string[]>>
// }

// const ChordProgSelector: React.FC<ChordProgSelectorProps> =({
//     chordProg,
//     setChordProg
// }: ChordProgSelectorProps) => {

//   const handleChange = (index: number, value: string) => {
//     const newProgression = [...chordProg];
//     newProgression[index] = value;
//     setChordProg(newProgression);
//   };

//   return (
//     <div
//     style={{
//         display: "flex",
//         flexDirection: "column", // stack vertically
//         alignItems: "center",    // center horizontally
//         gap: "0.5rem",           // space between title and menus
//     }}
//     >
//     <div style={{ fontWeight: "bold" }}>Chord Progression</div>

//     <div
//         style={{
//         display: "flex",
//         justifyContent: "center",
//         gap: "1rem",
//         }}
//     >
//         {chordProg.map((chord, i) => (
//         <select
//             key={i}
//             value={chord}
//             onChange={(e) => handleChange(i, e.target.value)}
//         >
//             {chords.map((c) => (
//             <option key={c} value={c}>
//                 {c}
//             </option>
//             ))}
//         </select>
//         ))}
//     </div>
//     </div>
//   );
// }

// export default ChordProgSelector;