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

export interface BasicPitchMidiResponse {
  filename?: string; // For file upload endpoint
  source_file?: string; // For local file endpoint
  midiData: MidiNoteEvent[];
  status?: string; // 'success', 'no_notes_detected'
}
export interface MagentaMidiResponse {
  filename?: string; // For file upload endpoint
  source_file?: string; // For local file endpoint
  midi_data: MidiNoteEvent[];
  status?: string; // 'success', 'no_notes_detected'
}

