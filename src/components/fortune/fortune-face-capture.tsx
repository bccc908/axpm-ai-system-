"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, Trash2, Upload, Wand2 } from "lucide-react";
import { prepareFaceImageFile } from "@/lib/fortune/face-image-client";

const btnPrimary =
  "inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white hover:bg-accent-muted disabled:opacity-50";
const btnGhost =
  "inline-flex items-center gap-1.5 rounded-lg border border-card-border px-3 py-1.5 text-xs text-muted hover:text-foreground";

export type FaceImagePayload = {
  data: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  previewUrl: string;
};

const btnAnalyze =
  "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 px-5 py-3 text-sm font-semibold text-white shadow-md hover:from-amber-500 hover:to-orange-500 disabled:opacity-50 sm:w-auto";

export function FortuneFaceCapture({
  value,
  onChange,
  onAnalyze,
  analyzing,
  t,
  disabled,
}: {
  value: FaceImagePayload | null;
  onChange: (next: FaceImagePayload | null) => void;
  onAnalyze?: () => void;
  analyzing?: boolean;
  t: (key: string) => string;
  disabled?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
    setCameraStarting(false);
    setVideoReady(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
      if (value?.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(value.previewUrl);
      }
    };
  }, [stopCamera, value?.previewUrl]);

  // Bind stream after <video> is in the DOM (fixes black preview)
  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!cameraOn || !video || !stream) return;

    video.srcObject = stream;
    setVideoReady(false);

    const onReady = () => setVideoReady(true);
    video.addEventListener("loadedmetadata", onReady);

    void video.play().catch(() => {
      setError(t("fortune.faceCameraPlayFailed"));
    });

    return () => {
      video.removeEventListener("loadedmetadata", onReady);
    };
  }, [cameraOn, t]);

  async function applyFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      if (!file.type.startsWith("image/")) {
        setError(t("fortune.faceImageInvalid"));
        return;
      }
      const prepared = await prepareFaceImageFile(file);
      const previewUrl = URL.createObjectURL(file);
      if (value?.previewUrl.startsWith("blob:")) URL.revokeObjectURL(value.previewUrl);
      onChange({ ...prepared, previewUrl });
    } catch {
      setError(t("fortune.faceImageFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function startCamera() {
    setError(null);
    setCameraStarting(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(t("fortune.faceCameraUnsupported"));
        fileInputRef.current?.click();
        return;
      }

      stopCamera();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "user" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
    } catch {
      setError(t("fortune.faceCameraDenied"));
      fileInputRef.current?.click();
      setCameraOn(false);
    } finally {
      setCameraStarting(false);
    }
  }

  async function capturePhoto() {
    const video = videoRef.current;
    if (!video || !videoReady || video.videoWidth < 1) {
      setError(t("fortune.faceCameraWait"));
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    stopCamera();
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      await applyFile(new File([blob], "face.jpg", { type: "image/jpeg" }));
    }, "image/jpeg", 0.92);
  }

  function clearPhoto() {
    stopCamera();
    if (value?.previewUrl.startsWith("blob:")) URL.revokeObjectURL(value.previewUrl);
    onChange(null);
    setError(null);
  }

  return (
    <div className="mb-4 rounded-xl border border-amber-500/35 bg-amber-500/10 p-4">
      <p className="text-sm font-medium text-foreground">{t("fortune.facePhotoTitle")}</p>
      <p className="mt-1 text-xs text-muted">{t("fortune.facePhotoDesc")}</p>

      {value?.previewUrl ? (
        <div className="mt-3 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value.previewUrl}
              alt=""
              className="max-h-48 w-full max-w-xs rounded-lg border border-card-border object-cover"
            />
            <div className="flex flex-1 flex-col gap-2">
              {onAnalyze ? (
                <button
                  type="button"
                  className={btnAnalyze}
                  disabled={disabled || busy || analyzing}
                  onClick={onAnalyze}
                >
                  {analyzing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4" />
                  )}
                  {analyzing ? t("fortune.generating") : t("fortune.facePhotoAnalyze")}
                </button>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button type="button" className={btnGhost} disabled={disabled || busy || analyzing} onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5" />
                  {t("fortune.facePhotoReplace")}
                </button>
                <button type="button" className={btnGhost} disabled={disabled || busy || analyzing} onClick={clearPhoto}>
                  <Trash2 className="h-3.5 w-3.5" />
                  {t("fortune.facePhotoRemove")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : cameraOn || cameraStarting ? (
        <div className="mt-3 space-y-2">
          <div className="relative aspect-[4/3] max-h-72 w-full overflow-hidden rounded-lg border border-card-border bg-black">
            <video
              ref={videoRef}
              className="h-full w-full -scale-x-100 object-cover"
              playsInline
              muted
              autoPlay
            />
            {!videoReady ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-xs text-white">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("fortune.faceCameraStarting")}
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={btnPrimary}
              disabled={disabled || busy || !videoReady}
              onClick={capturePhoto}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
              {t("fortune.facePhotoCapture")}
            </button>
            <button type="button" className={btnGhost} onClick={stopCamera}>
              {t("common.cancel")}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={btnPrimary} disabled={disabled || busy} onClick={startCamera}>
            <Camera className="h-3.5 w-3.5" />
            {t("fortune.facePhotoCamera")}
          </button>
          <button
            type="button"
            className={btnGhost}
            disabled={disabled || busy}
            onClick={() => fileInputRef.current?.click()}
          >
            <ImagePlus className="h-3.5 w-3.5" />
            {t("fortune.facePhotoUpload")}
          </button>
        </div>
      )}

      {error ? <p className="mt-2 text-xs text-red-500">{error}</p> : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        capture="user"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void applyFile(file);
          e.target.value = "";
        }}
      />

    </div>
  );
}
