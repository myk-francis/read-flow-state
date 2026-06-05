import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface UseReaderSpeechOptions {
  enabled: boolean;
  playing: boolean;
  speechKey: string | null;
  text: string;
  voiceName?: string;
  rate: number;
  onEnd?: () => void;
  onError?: (event?: SpeechSynthesisErrorEvent) => void;
  setPlaying: (playing: boolean) => void;
}

interface UseReaderSpeechResult {
  supported: boolean;
  availableVoices: string[];
  speak: () => void;
  stop: (keepPausedState?: boolean) => void;
}

export function useReaderSpeech({
  enabled,
  playing,
  speechKey,
  text,
  voiceName,
  rate,
  onEnd,
  onError,
  setPlaying,
}: UseReaderSpeechOptions): UseReaderSpeechResult {
  const supported =
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof window.SpeechSynthesisUtterance !== "undefined";

  const [availableVoices, setAvailableVoices] = useState<string[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const cancelReasonRef = useRef<"manual" | "transition" | null>(null);
  const activeSpeechKeyRef = useRef<string | null>(null);

  const voiceList = useMemo(() => {
    if (!supported) return [];
    return window.speechSynthesis.getVoices();
  }, [supported]);

  useEffect(() => {
    if (!supported) {
      setAvailableVoices(["Default voice"]);
      return;
    }

    const readVoices = () => {
      const names = window.speechSynthesis.getVoices().map((voice) => voice.name);
      setAvailableVoices(names.length > 0 ? names : ["Default voice"]);
    };

    readVoices();
    window.speechSynthesis.addEventListener("voiceschanged", readVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", readVoices);
  }, [supported]);

  const stop = useCallback(
    (keepPausedState = false) => {
      if (!supported) return;
      cancelReasonRef.current = keepPausedState ? "transition" : "manual";
      window.speechSynthesis.cancel();
      utteranceRef.current = null;
      activeSpeechKeyRef.current = null;
      if (!keepPausedState) {
        setPlaying(false);
      }
    },
    [setPlaying, supported],
  );

  const speak = useCallback(() => {
    if (!supported || !enabled || !text.trim() || !speechKey) return;

    cancelReasonRef.current = "transition";
    window.speechSynthesis.cancel();

    const utterance = new window.SpeechSynthesisUtterance(text);
    const selectedVoice = voiceList.find((voice) => voice.name === voiceName);

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.rate = rate;
    utterance.onend = () => {
      utteranceRef.current = null;
      const reason = cancelReasonRef.current;
      cancelReasonRef.current = null;

      if (reason === "manual" || reason === "transition") {
        return;
      }

      onEnd?.();
    };

    utterance.onerror = (event) => {
      utteranceRef.current = null;
      const reason = cancelReasonRef.current;
      cancelReasonRef.current = null;

      if (reason === "manual" || reason === "transition") {
        return;
      }

      onError?.(event);
    };

    utteranceRef.current = utterance;
    activeSpeechKeyRef.current = speechKey;
    cancelReasonRef.current = null;
    setPlaying(true);
    window.speechSynthesis.speak(utterance);
  }, [enabled, onEnd, onError, rate, setPlaying, speechKey, supported, text, voiceList, voiceName]);

  useEffect(() => {
    if (!supported || !enabled) {
      return;
    }

    if (!speechKey || !text.trim()) {
      stop();
      return;
    }

    if (!playing) {
      return;
    }

    if (utteranceRef.current && activeSpeechKeyRef.current === speechKey) {
      return;
    }

    speak();

    return () => {
      cancelReasonRef.current = "transition";
      window.speechSynthesis.cancel();
      utteranceRef.current = null;
      activeSpeechKeyRef.current = null;
    };
  }, [enabled, playing, speak, speechKey, stop, supported, text]);

  useEffect(() => {
    return () => {
      if (!supported) return;
      cancelReasonRef.current = "manual";
      window.speechSynthesis.cancel();
      utteranceRef.current = null;
      activeSpeechKeyRef.current = null;
    };
  }, [supported]);

  return {
    supported,
    availableVoices,
    speak,
    stop,
  };
}
