"use client";

import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { useLocale } from "@/components/providers/locale-provider";

const ERROR_KEYS = [
  "microphone_denied",
  "not_supported",
  "transcription_failed",
  "network",
  "recording_too_short",
  "service_balance",
] as const;

export function VoiceMicButton({
  onTranscript,
  className,
  size = "sm",
}: {
  onTranscript: (text: string) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  const { t } = useLocale();
  const { isListening, interimText, error, isSupported, toggle } = useSpeechRecognition();

  if (!isSupported) return null;

  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const btnSize = size === "sm" ? "h-8 w-8" : "h-9 w-9";

  const statusText = error
    ? ERROR_KEYS.includes(error as typeof ERROR_KEYS[number])
      ? t(`voice.errors.${error}`)
      : error
    : isListening
      ? interimText || t("voice.recordingHint")
      : null;

  const buttonTitle = isListening
    ? t("voice.stop")
    : `${t("voice.tapToRecord")} · ${t("voice.macMicHint")}`;

  return (
    <div className={cn("relative shrink-0", className)}>
      <button
        type="button"
        title={buttonTitle}
        aria-label={isListening ? t("voice.stop") : t("voice.start")}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggle(onTranscript);
        }}
        className={cn(
          btnSize,
          "inline-flex items-center justify-center rounded-xl border transition-colors",
          isListening
            ? "border-danger/50 bg-danger/10 text-danger animate-pulse"
            : "border-accent/30 bg-accent/5 text-accent hover:border-accent/50",
        )}
      >
        {isListening ? <MicOff className={iconSize} /> : <Mic className={iconSize} />}
      </button>
      {statusText ? (
        <p
          className={cn(
            "absolute right-0 top-full z-20 mt-1 w-52 rounded-lg border border-card-border bg-card px-2 py-1.5 text-xs leading-snug shadow-lg",
            error ? "text-danger" : "text-muted",
          )}
        >
          {statusText}
        </p>
      ) : null}
    </div>
  );
}

type VoiceTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  onValueChange: (value: string) => void;
  onSubmitEnter?: () => void;
  onAfterVoiceTranscript?: (value: string) => void;
  micPosition?: "top" | "bottom";
};

export function VoiceTextarea({
  onValueChange,
  onSubmitEnter,
  onAfterVoiceTranscript,
  micPosition = "top",
  value,
  className,
  onKeyDown,
  disabled,
  ...props
}: VoiceTextareaProps) {
  const append = (text: string) => {
    const current = String(value ?? "");
    const next = current ? `${current} ${text}` : text;
    onValueChange(next);
    onAfterVoiceTranscript?.(next);
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <textarea
          {...props}
          value={value}
          disabled={disabled}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={(e) => {
            onKeyDown?.(e);
            if (e.defaultPrevented) return;
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              if (onSubmitEnter) {
                e.preventDefault();
                onSubmitEnter();
              }
            }
          }}
          className={cn(className, "pr-12")}
        />
        <div
          className={cn(
            "absolute right-2",
            micPosition === "bottom" ? "bottom-2" : "top-2",
          )}
        >
          <VoiceMicButton onTranscript={append} />
        </div>
      </div>
    </div>
  );
}

type VoiceInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  onValueChange: (value: string) => void;
};

export function VoiceInput({ onValueChange, value, className, ...props }: VoiceInputProps) {
  const append = (text: string) => {
    const current = String(value ?? "");
    onValueChange(current ? `${current} ${text}` : text);
  };

  return (
    <div className="relative">
      <input
        {...props}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        className={cn(className, "pr-12")}
      />
      <div className="absolute right-2 top-1/2 -translate-y-1/2">
        <VoiceMicButton onTranscript={append} />
      </div>
    </div>
  );
}
