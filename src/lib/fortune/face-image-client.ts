/** Resize & compress face photo for fast vision API (target ~150KB base64). */
export async function prepareFaceImageFile(
  file: File,
  maxWidth = 512,
): Promise<{ data: string; mimeType: "image/jpeg" | "image/png" | "image/webp" }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Compress failed"))),
      "image/jpeg",
      0.68,
    );
  });

  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return { data: btoa(binary), mimeType: "image/jpeg" };
}
