import type { NoteSequence } from "@magenta/music";

export interface Note {
      pitch: number,
      velocity: number,
      startTime: number,
      endTime: number
      program?: number
}

// Define types for MIDI data structure
export interface MidiNoteEvent {
  type: 'note';
  start_time: number;
  end_time: number;
  duration: number;
  pitch: number;
  velocity: number;
}

export interface BackendStatusMessage {
  status: string;
  message: string;
}

export interface BackendError {
  error: string;
}

export interface BasicPitchNoteSequenceResponse {
  filename?: string; // For file upload endpoint
  source_file?: string; // For local file endpoint
  note_sequence: NoteSequence;
  status?: string; // 'success', 'no_notes_detected'
}
export interface MagentaMidiResponse {
  filename?: string; // For file upload endpoint
  source_file?: string; // For local file endpoint
  midiData: MidiNoteEvent[];
  status?: string; // 'success', 'no_notes_detected'
}

// export interface NoteSequence {
//     timeSignatures : [];
//     keySignatures : [];
//     tempos : [];
//     notes : [];
//     pitchBends : [];
//     controlChanges : [];
//     partInfos : [];
//     textAnnotations : [];
//     sectionAnnotations : [];
//     sectionGroups : [];
// }
