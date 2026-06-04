"use client";

import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { useLocale } from "@/components/providers/locale-provider";

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
  const btnSize = size === "sm" ? "h-7 w-7" : "h-8 w-8";

  return (
    <div className={cn("flex flex-col items-end gap-1", className)}>
      <button
        type="button"
        title={isListening ? t("voice.stop") : t("voice.start")}
        aria-label={isListening ? t("voice.stop") : t("voice.start")}
        onClick={() => toggle(onTranscript)}
        className={cn(
          btnSize,
          "inline-flex shrink-0 items-center justify-center rounded-lg border transition-colors",
          isListening
            ? "border-danger/50 bg-danger/10 text-danger animate-pulse"
            : "border-card-border text-muted hover:border-accent/50 hover:text-accent",
        )}
      >
        {isListening ? <MicOff className={iconSize} /> : <Mic className={iconSize} />}
      </button>
      {isListening && interimText && (
        <p className="max-w-[200px] truncate text-xs text-muted">{interimText}</p>
      )}
      {error && (
        <p className="max-w-[200px] text-xs text-danger">
          {["microphone_denied", "not_supported", "transcription_failed", "network"].includes(error)
            ? t(`voice.errors.${error}`)
            : error}
        </p>
      )}
    </div>
  );
}

type VoiceTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  onValueChange: (value: string) => void;
};

export function VoiceTextarea({ onValueChange, value, className, ...props }: VoiceTextareaProps) {
  const append = (text: string) => {
    const current = String(value ?? "");
    onValueChange(current ? `${current} ${text}` : text);
  };

  return (
    <div className="relative">
      <textarea
        {...props}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        className={cn(className, "pr-10")}
      />
      <div className="absolute right-2 top-2">
        <VoiceMicButton onTranscript={append} />
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
        className={cn(className, "pr-10")}
      />
      <div className="absolute right-2 top-1/2 -translate-y-1/2">
        <VoiceMicButton onTranscript={append} />
      </div>
    </div>
  );
}
