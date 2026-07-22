export const DEFAULT_VOICE_NAME = "Default voice";

export function readAvailableVoiceNames() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return [];
  }

  return [
    ...new Set(
      window.speechSynthesis
        .getVoices()
        .map((voice) => voice.name)
        .filter(Boolean),
    ),
  ];
}

export function resolvePreferredVoiceName(preferredVoice: string | undefined, voices: string[]) {
  if (preferredVoice && voices.includes(preferredVoice)) {
    return preferredVoice;
  }

  return voices[0] ?? DEFAULT_VOICE_NAME;
}
