import type { INoteSequence } from "@magenta/music";

export function transposeToValidPitchRange(ns: INoteSequence): INoteSequence {
    // const MIN_PITCH = 48; 
    // const MAX_PITCH = 83;

    const MIN_PITCH = 1; 
    const MAX_PITCH = 127;

    if (!ns.notes || ns.notes.length === 0) {
        console.warn('No notes to transpose.');
        return ns;
    }

    const transposedNotes = ns.notes.map(note => {
        let pitch = note.pitch ?? 60; // default to middle C if missing

        while (pitch < MIN_PITCH) pitch += 12;
        while (pitch > MAX_PITCH) pitch -= 12;

        pitch = Math.max(MIN_PITCH, Math.min(MAX_PITCH, pitch));

        return {
            ...note,
            pitch,
        };
    });

    return {
        ...ns,
        notes: transposedNotes,
    };
}