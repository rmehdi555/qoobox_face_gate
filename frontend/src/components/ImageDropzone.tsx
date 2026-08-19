import { useEffect, useRef, useState } from "react";
import { Camera, Upload, X } from "lucide-react";

import { Button } from "./ui/Button";

type Preview = { id: string; file: File; url: string };

type Props = {
  files: File[];
  onChange: (files: File[]) => void;
  error?: string;
};

export function ImageDropzone({ files, onChange, error }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const filesRef = useRef(files);
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [capturing, setCapturing] = useState(false);

  filesRef.current = files;

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (!cameraOpen) {
      return;
    }
    let cancelled = false;
    async function start() {
      setCameraError("");
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("This browser does not support camera capture.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
        }
      } catch (caught) {
        const name = caught instanceof DOMException ? caught.name : "";
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          setCameraError("Please allow camera access and try again.");
        } else if (name === "NotFoundError") {
          setCameraError("No camera was detected on this device.");
        } else {
          setCameraError("Camera unavailable. Please allow camera access and try again.");
        }
      }
    }
    void start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [cameraOpen]);

  function sync(next: File[]) {
    setPreviews((current) => {
      current.forEach((item) => URL.revokeObjectURL(item.url));
      return next.map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${file.type}`,
        file,
        url: URL.createObjectURL(file),
      }));
    });
    onChange(next);
  }

  function addFiles(list: FileList | null) {
    if (!list) {
      return;
    }
    const incoming = Array.from(list).filter((file) => file.type.startsWith("image/"));
    sync([...filesRef.current, ...incoming]);
  }

  function remove(index: number) {
    sync(filesRef.current.filter((_, i) => i !== index));
  }

  async function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      setCameraError("Wait for the camera preview, then capture.");
      return;
    }
    setCapturing(true);
    setCameraError("");
    try {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const context = canvas.getContext("2d");
      if (!context) {
        return;
      }
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
      if (!blob) {
        setCameraError("Could not capture this frame. Try again.");
        return;
      }
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      sync([...filesRef.current, new File([blob], `camera-${stamp}.jpg`, { type: "image/jpeg" })]);
    } finally {
      setCapturing(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            addFiles(event.dataTransfer.files);
          }}
          className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center hover:border-brand-400 hover:bg-brand-50/40"
        >
          <Upload className="mb-2 h-6 w-6 text-brand-600" />
          <span className="text-sm font-medium text-slate-800">Upload Images</span>
          <span className="mt-1 text-xs text-slate-500">JPG, JPEG, PNG, or WEBP. Drag and drop or browse.</span>
        </button>
        <button
          type="button"
          onClick={() => setCameraOpen(true)}
          className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center hover:border-brand-400 hover:bg-brand-50/40"
        >
          <Camera className="mb-2 h-6 w-6 text-brand-600" />
          <span className="text-sm font-medium text-slate-800">Take Photo</span>
          <span className="mt-1 text-xs text-slate-500">Use the webcam to capture a face photo.</span>
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        multiple
        className="hidden"
        onChange={(event) => {
          addFiles(event.target.files);
          event.target.value = "";
        }}
      />
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}

      {cameraOpen ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
          <div className="relative aspect-video bg-black">
            <video ref={videoRef} className="h-full w-full object-contain" playsInline muted autoPlay />
            <canvas ref={canvasRef} className="hidden" />
            {cameraError ? (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 px-4 text-center text-sm text-white">
                {cameraError}
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 bg-slate-900 p-3">
            <Button type="button" variant="secondary" onClick={() => setCameraOpen(false)}>
              Close camera
            </Button>
            <Button type="button" onClick={() => void capturePhoto()} disabled={Boolean(cameraError) || capturing}>
              {capturing ? "Capturing..." : "Capture Photo"}
            </Button>
          </div>
        </div>
      ) : null}

      {previews.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {previews.map((item, index) => (
            <div key={item.id} className="relative overflow-hidden rounded-xl border border-slate-200">
              <img src={item.url} alt={item.file.name} className="h-28 w-full object-cover" />
              <button
                type="button"
                onClick={() => remove(index)}
                className="absolute right-1 top-1 rounded-full bg-slate-900/70 p-1 text-white"
                aria-label="Remove image"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
