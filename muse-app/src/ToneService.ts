import * as Tone from "tone";

declare global {
  var _toneTransport: ReturnType<typeof Tone.getTransport> | undefined;
}

if (!globalThis._toneTransport) {
  globalThis._toneTransport = Tone.getTransport();
}

export const transport = globalThis._toneTransport!;
export { Tone };