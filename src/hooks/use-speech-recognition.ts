"use client";

import { useCallback, useRef, useState } from "react";
import { useLocale } from "@/components/providers/locale-provider";

function hasRecorderSupport(): boolean {
  if (typeof window === "undefined") return false;
  return (
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== "undefined"
  );
}

function hasBrowserSpeech(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition);
}

function createBrowserSpeech(): SpeechRecognition | null {
  const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

function pickRecorderMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/aac",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t));
}

function mimeToFormat(mime: string): string {
  if (mime.includes("mp4") || mime.includes("aac")) return "mp4";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("wav")) return "wav";
  return "webm";
}

function mapServerError(errMsg: string): string {
  const lower = errMsg.toLowerCase();
  if (lower.includes("too short")) return "recording_too_short";
  if (
    lower.includes("$0.50") ||
    lower.includes("balance") ||
    lower.includes("insufficient") ||
    lower.includes("402")
  ) {
    return "service_balance";
  }
  if (
    lower.includes("network error") ||
    lower.includes("timeout") ||
    lower.includes("econnrefused") ||
    lower.includes("fetch failed") ||
    lower.includes("aborterror")
  ) {
    return "network";
  }
  return "transcription_failed";
}

export function useSpeechRecognition() {
  const { locale } = useLocale();
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const onResultRef = useRef<((text: string) => void) | null>(null);
  const recordedMimeRef = useRef("audio/webm");
  const startedAtRef = useRef(0);
  const browserSpeechRef = useRef<SpeechRecognition | null>(null);
  const browserFinalRef = useRef("");
  const browserHadErrorRef = useRef(false);
  const fallingBackToRecorderRef = useRef(false);

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
  }, []);

  const cleanupBrowserSpeech = useCallback(() => {
    try {
      browserSpeechRef.current?.abort();
    } catch {
      /* ignore */
    }
    browserSpeechRef.current = null;
    browserFinalRef.current = "";
  }, []);

  const transcribeBlob = useCallback(
    async (blob: Blob, mimeType: string) => {
      if (blob.size < 500) {
        setError("recording_too_short");
        setIsListening(false);
        setInterimText("");
        cleanupStream();
        return;
      }

      setInterimText(locale === "zh" ? "正在转写…" : "Transcribing…");
      const format = mimeToFormat(mimeType);
      const ext = format === "mp4" ? "recording.mp4" : `recording.${format}`;
      const form = new FormData();
      form.append("audio", blob, ext);
      form.append("language", locale === "zh" ? "zh" : "en");

      try {
        const res = await fetch("/api/voice/transcribe", { method: "POST", body: form });
        const data = await res.json();
        if (data.text) {
          onResultRef.current?.(data.text);
          setError(null);
        } else {
          setError(mapServerError(String(data.error ?? "transcription_failed")));
        }
      } catch {
        setError("network");
      } finally {
        setIsListening(false);
        setInterimText("");
        cleanupStream();
      }
    },
    [cleanupStream, locale],
  );

  const stopRecording = useCallback(() => {
    if (browserSpeechRef.current) {
      try {
        browserSpeechRef.current.stop();
      } catch {
        cleanupBrowserSpeech();
        setIsListening(false);
        setInterimText("");
      }
      return;
    }

    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      setIsListening(false);
      setInterimText("");
      cleanupStream();
      return;
    }

    const elapsed = Date.now() - startedAtRef.current;
    if (elapsed < 400) {
      setError("recording_too_short");
      try {
        recorder.stop();
      } catch {
        /* ignore */
      }
      setIsListening(false);
      setInterimText("");
      cleanupStream();
      return;
    }

    try {
      if (typeof recorder.requestData === "function") {
        recorder.requestData();
      }
      recorder.stop();
    } catch {
      setError("transcription_failed");
      setIsListening(false);
      cleanupStream();
    }
  }, [cleanupBrowserSpeech, cleanupStream]);

  const startBrowserSpeech = useCallback(
    (onResult: (text: string) => void, onNetworkFallback?: () => void) => {
      const recognition = createBrowserSpeech();
      if (!recognition) {
        setError("not_supported");
        return;
      }

      onResultRef.current = onResult;
      browserSpeechRef.current = recognition;
      browserFinalRef.current = "";
      browserHadErrorRef.current = false;
      setError(null);

      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = locale === "zh" ? "zh-CN" : "en-US";
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        let interim = "";
        let finalText = browserFinalRef.current;
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const part = event.results[i][0]?.transcript ?? "";
          if (event.results[i].isFinal) {
            finalText = `${finalText}${part}`.trim();
          } else {
            interim = part;
          }
        }
        browserFinalRef.current = finalText;
        setInterimText(
          interim || finalText || (locale === "zh" ? "录音中… 再点结束" : "Recording… tap again to stop"),
        );
      };

      recognition.onerror = (event) => {
        if (event.error === "aborted") return;
        browserHadErrorRef.current = true;
        if (event.error === "no-speech") {
          setError("recording_too_short");
        } else if (event.error === "not-allowed") {
          setError("microphone_denied");
        } else if (event.error === "network") {
          cleanupBrowserSpeech();
          if (onNetworkFallback) {
            fallingBackToRecorderRef.current = true;
            setInterimText(locale === "zh" ? "改用服务器转写…" : "Switching to server…");
            onNetworkFallback();
            return;
          }
          setError("network");
        } else {
          setError("transcription_failed");
        }
        setIsListening(false);
        setInterimText("");
        cleanupBrowserSpeech();
      };

      recognition.onend = () => {
        if (fallingBackToRecorderRef.current) {
          fallingBackToRecorderRef.current = false;
          cleanupBrowserSpeech();
          return;
        }
        const text = browserFinalRef.current.trim();
        if (text) {
          onResultRef.current?.(text);
          setError(null);
        } else if (!browserHadErrorRef.current) {
          setError("recording_too_short");
        }
        setIsListening(false);
        setInterimText("");
        cleanupBrowserSpeech();
      };

      try {
        recognition.start();
        setIsListening(true);
        setInterimText(locale === "zh" ? "录音中… 再点结束" : "Recording… tap again to stop");
      } catch {
        setError("not_supported");
        cleanupBrowserSpeech();
      }
    },
    [cleanupBrowserSpeech, locale],
  );

  const startMediaRecorder = useCallback(
    async (onResult: (text: string) => void) => {
      if (!hasRecorderSupport()) {
        setError("not_supported");
        return;
      }

      onResultRef.current = onResult;
      setError(null);
      chunksRef.current = [];

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            channelCount: 1,
          },
        });
        streamRef.current = stream;

        const mimeType = pickRecorderMime();
        if (!mimeType) {
          setError("not_supported");
          cleanupStream();
          return;
        }

        const recorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = recorder;
        recordedMimeRef.current = mimeType;

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunksRef.current.push(event.data);
        };

        recorder.onerror = () => {
          setError("transcription_failed");
          setIsListening(false);
          cleanupStream();
        };

        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: recordedMimeRef.current });
          void transcribeBlob(blob, recordedMimeRef.current);
        };

        recorder.start(250);
        startedAtRef.current = Date.now();
        setIsListening(true);
        setInterimText(
          locale === "zh" ? "录音中… 再点结束" : "Recording… tap again to stop",
        );
      } catch (err) {
        const name = err instanceof Error ? err.name : "";
        setError(
          name === "NotAllowedError" || name === "PermissionDeniedError"
            ? "microphone_denied"
            : "not_supported",
        );
        setIsListening(false);
        cleanupStream();
      }
    },
    [cleanupStream, locale, transcribeBlob],
  );

  const startRecording = useCallback(
    async (onResult: (text: string) => void) => {
      if (hasRecorderSupport()) {
        await startMediaRecorder(onResult);
        return;
      }

      if (hasBrowserSpeech()) {
        startBrowserSpeech(onResult, () => {
          void startMediaRecorder(onResult);
        });
        return;
      }

      setError("not_supported");
    },
    [startBrowserSpeech, startMediaRecorder],
  );

  const toggle = useCallback(
    (onResult: (text: string) => void) => {
      if (isListening) {
        stopRecording();
        return;
      }
      void startRecording(onResult);
    },
    [isListening, startRecording, stopRecording],
  );

  return {
    isListening,
    interimText,
    error,
    isSupported: hasBrowserSpeech() || hasRecorderSupport(),
    toggle,
    stop: stopRecording,
  };
}
