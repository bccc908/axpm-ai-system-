"use client";

import { useCallback, useRef, useState } from "react";
import { useLocale } from "@/components/providers/locale-provider";

type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useSpeechRecognition() {
  const { locale } = useLocale();
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"browser" | "whisper" | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const onResultRef = useRef<((text: string) => void) | null>(null);

  const speechLang = locale === "zh" ? "zh-CN" : "en-US";
  const hasBrowserSpeech = getSpeechRecognitionCtor() !== null;
  const hasMicrophone =
    typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      /* already stopped */
    }

    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    } else {
      setIsListening(false);
      setInterimText("");
    }
  }, []);

  const transcribeWithWhisper = useCallback(
    async (blob: Blob) => {
      setInterimText("");
      const form = new FormData();
      form.append("audio", blob, "recording.webm");
      form.append("language", locale === "zh" ? "zh" : "en");

      try {
        const res = await fetch("/api/voice/transcribe", { method: "POST", body: form });
        const data = await res.json();
        if (data.text) {
          onResultRef.current?.(data.text);
        } else {
          setError(data.error ?? "transcription_failed");
        }
      } catch {
        setError("transcription_failed");
      } finally {
        setIsListening(false);
        cleanupStream();
      }
    },
    [cleanupStream, locale],
  );

  const startWhisper = useCallback(
    async (onResult: (text: string) => void) => {
      if (!hasMicrophone) {
        setError("not_supported");
        return;
      }

      onResultRef.current = onResult;
      setError(null);
      setMode("whisper");

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        chunksRef.current = [];

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunksRef.current.push(event.data);
        };

        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          void transcribeWithWhisper(blob);
        };

        recorder.start();
        setIsListening(true);
        setInterimText(locale === "zh" ? "正在录音…" : "Recording…");
      } catch {
        setError("microphone_denied");
        setIsListening(false);
        cleanupStream();
      }
    },
    [cleanupStream, hasMicrophone, locale, transcribeWithWhisper],
  );

  const startBrowser = useCallback(
    (onResult: (text: string) => void) => {
      const Ctor = getSpeechRecognitionCtor();
      if (!Ctor) return false;

      onResultRef.current = onResult;
      setError(null);
      setMode("browser");

      const recognition = new Ctor();
      recognition.lang = speechLang;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognitionRef.current = recognition;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0]?.transcript ?? "";
          if (result.isFinal) {
            const trimmed = transcript.trim();
            if (trimmed) onResult(trimmed);
            setInterimText("");
          } else {
            interim += transcript;
          }
        }
        if (interim) setInterimText(interim);
      };

      recognition.onerror = (event) => {
        setError(event.error === "not-allowed" ? "microphone_denied" : event.error);
        setIsListening(false);
        setInterimText("");
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimText("");
      };

      recognition.start();
      setIsListening(true);
      return true;
    },
    [speechLang],
  );

  const toggle = useCallback(
    (onResult: (text: string) => void) => {
      if (isListening) {
        stop();
        return;
      }

      if (hasBrowserSpeech && startBrowser(onResult)) {
        return;
      }

      void startWhisper(onResult);
    },
    [hasBrowserSpeech, isListening, startBrowser, startWhisper, stop],
  );

  return {
    isListening,
    interimText,
    error,
    mode,
    hasBrowserSpeech,
    hasMicrophone,
    isSupported: hasBrowserSpeech || hasMicrophone,
    toggle,
    stop,
  };
}
