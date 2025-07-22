import { NoteSequence, type INoteSequence } from "@magenta/music";

export function transposeToValidPitchRange(ns: INoteSequence): INoteSequence {
    const MIN_PITCH = 48; 
    const MAX_PITCH = 84;


    if (ns.notes && ns.notes.length !== 0) {
        const transposedNotes: NoteSequence = ns.notes.map(note => {
        let newPitch = note.pitch;
            if (newPitch){
                while (newPitch < MIN_PITCH) newPitch += 12;
                while (newPitch > MAX_PITCH) newPitch -= 12;

                newPitch = Math.max(MIN_PITCH, Math.min(MAX_PITCH, newPitch));
            }
            return {
                ...ns,
                notes: transposedNotes,
            };
        });
    }

    return new NoteSequence(); // Returns empty note sequence was null or empty
}