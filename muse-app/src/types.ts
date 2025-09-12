import type { NoteSequence } from "@magenta/music";
import { CONSTANTS } from "./utils";

// Defines Key Signature key 
export type KeySigName = keyof typeof CONSTANTS.KEY_NUMBERS;

// Defines valid model keys to be just the keys within the CONSTANTS object
export type ModelKey = keyof typeof CONSTANTS;

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
  filename?: string; // For file upload endpointœ
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
