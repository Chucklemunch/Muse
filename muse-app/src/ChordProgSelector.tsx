import React from "react";

const chords = [
        "C",
        "Db",
        "D",
        "Eb",
        "E",
        "F",
        "F#",
        "G",
        "Ab",
        "A",
        "Bb",
        "B",
        "Cm",
        "C#m",
        "Dm",
        "Ebm",
        "Em",
        "Fm",
        "F#m",
        "Gm",
        "G#m",
        "Am",
        "Bbm",
        "Bm",
];

export interface ChordProgSelectorProps {
    chordProg: string[],
    setChordProg:  React.Dispatch<React.SetStateAction<string[]>>
}

const ChordProgSelector: React.FC<ChordProgSelectorProps> =({
    chordProg,
    setChordProg
}: ChordProgSelectorProps) => {

  const handleChange = (index: number, value: string) => {
    const newProgression = [...chordProg];
    newProgression[index] = value;
    setChordProg(newProgression);
  };

  return (
    <div
    style={{
        display: "flex",
        flexDirection: "column", // stack vertically
        alignItems: "center",    // center horizontally
        gap: "0.5rem",           // space between title and menus
    }}
    >
    <div style={{ fontWeight: "bold" }}>Chord Progression</div>

    <div
        style={{
        display: "flex",
        justifyContent: "center",
        gap: "1rem",
        }}
    >
        {chordProg.map((chord, i) => (
        <select
            key={i}
            value={chord}
            onChange={(e) => handleChange(i, e.target.value)}
        >
            {chords.map((c) => (
            <option key={c} value={c}>
                {c}
            </option>
            ))}
        </select>
        ))}
    </div>
    </div>
  );
}

export default ChordProgSelector;