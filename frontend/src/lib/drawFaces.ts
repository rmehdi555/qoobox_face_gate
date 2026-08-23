import type { BoundingBox } from "../types";

type OverlayFace = {
  index: number;
  bbox: BoundingBox;
  recognized: boolean;
  label: string;
};

export function drawFaceOverlay(
  canvas: HTMLCanvasElement,
  faces: OverlayFace[],
  recognizedIndex: number | null,
) {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }
  context.clearRect(0, 0, canvas.width, canvas.height);
  faces.forEach((face) => {
    const x = face.bbox.x * canvas.width;
    const y = face.bbox.y * canvas.height;
    const width = face.bbox.width * canvas.width;
    const height = face.bbox.height * canvas.height;
    const isPrimary = recognizedIndex === face.index;
    const color = face.recognized ? "#34d399" : "#fbbf24";
    context.lineWidth = isPrimary ? 5 : 3;
    context.strokeStyle = color;
    context.strokeRect(x, y, width, height);

    context.font = "600 16px Inter, sans-serif";
    const textWidth = context.measureText(face.label).width;
    const boxHeight = 26;
    const labelY = Math.max(0, y - boxHeight - 4);
    context.fillStyle = "rgba(15, 23, 42, 0.85)";
    context.fillRect(x, labelY, Math.min(textWidth + 16, width + 120), boxHeight);
    context.fillStyle = color;
    context.fillText(face.label, x + 8, labelY + 18);
  });
}
