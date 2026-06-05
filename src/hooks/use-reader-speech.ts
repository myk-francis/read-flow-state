import { useCallback, useEffect, useRef, useState } from "react";

interface UseReaderSpeechOptions {
  enabled?: boolean;
  playing: boolean;
  speechKey: string | null;
  text: string;
  voiceName: string;
  rate: number;
  onEnd: () => void;
  onError: () => void;
  setPlaying: (playing: boolean) => void;
}

export function useReaderSpeech({
  enabled = true,
  playing,
  speechKey,
  text,
  voiceName,
  rate,
  onEnd,
  onError,
  setPlaying,
}: UseReaderSpeechOptions) {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const [availableVoices, setAvailableVoices] = useState<string[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const activeSpeechKeyRef = useRef<string | null>(null);
  const suppressEndRef = useRef(false);

  const resolveVoice = useCallback(() => {
    if (!supported) return null;
    return (
      window.speechSynthesis
        .getVoices()
        .find((voice) => voice.name === voiceName || voiceName === "Default voice") ?? null
    );
  }, [supported, voiceName]);

  const stop = useCallback(
    (nextPlaying = false) => {
      if (!supported) return;

      suppressEndRef.current = true;
      window.speechSynthesis.cancel();
      utteranceRef.current = null;
      activeSpeechKeyRef.current = null;
      setPlaying(nextPlaying);
    },
    [setPlaying, supported],
  );

  const speak = useCallback(() => {
    if (!enabled || !supported || !speechKey || !text.trim()) return;

    suppressEndRef.current = false;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;

    const selectedVoice = resolveVoice();
    if (selectedVoice && voiceName !== "Default voice") {
      utterance.voice = selectedVoice;
    }

    utterance.onend = () => {
      utteranceRef.current = null;
      activeSpeechKeyRef.current = null;

      if (suppressEndRef.current) {
        suppressEndRef.current = false;
        return;
      }

      onEnd();
    };

    utterance.onerror = () => {
      utteranceRef.current = null;
      activeSpeechKeyRef.current = null;
      suppressEndRef.current = false;
      onError();
    };

    utteranceRef.current = utterance;
    activeSpeechKeyRef.current = speechKey;
    window.speechSynthesis.speak(utterance);
    setPlaying(true);
  }, [
    enabled,
    onEnd,
    onError,
    rate,
    resolveVoice,
    setPlaying,
    speechKey,
    supported,
    text,
    voiceName,
  ]);

  useEffect(() => {
    if (!supported) return;

    const readVoices = () => {
      const voices = window.speechSynthesis.getVoices().map((voice) => voice.name);
      setAvailableVoices(voices.length > 0 ? voices : ["Default voice"]);
    };

    readVoices();
    window.speechSynthesis.addEventListener("voiceschanged", readVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", readVoices);
  }, [supported]);

  useEffect(() => {
    if (!enabled || !supported || !playing || !speechKey || !text.trim()) return;
    if (activeSpeechKeyRef.current === speechKey) return;

    speak();
  }, [enabled, playing, speak, speechKey, supported, text]);

  useEffect(() => {
    if (!supported) return;

    return () => {
      window.speechSynthesis.cancel();
      utteranceRef.current = null;
      activeSpeechKeyRef.current = null;
    };
  }, [supported]);

  return {
    supported,
    availableVoices,
    stop,
    speak,
  };
}
