import { useCallback, useEffect, useRef, useState } from "react";

import { drawFaceOverlay } from "../lib/drawFaces";
import { ApiError, api } from "../services/api";
import type { CameraState, RecognitionResult, RecognitionUiState } from "../types";

type Options = {
  intervalMs: number;
  enabled: boolean;
};

export function useLiveRecognition({ intervalMs, enabled }: Options) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const inFlight = useRef(false);
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [cameraError, setCameraError] = useState<string>("");
  const [uiState, setUiState] = useState<RecognitionUiState>("idle");
  const [result, setResult] = useState<RecognitionResult | null>(null);
  const [networkError, setNetworkError] = useState<string>("");

  const startCamera = useCallback(async () => {
    setCameraState("starting");
    setCameraError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState("unavailable");
      setCameraError("This browser does not support camera access.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
      setCameraState("running");
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setCameraState("denied");
        setCameraError("Please allow camera access and try again.");
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setCameraState("unavailable");
        setCameraError("No camera was detected on this device.");
      } else {
        setCameraState("unavailable");
        setCameraError("Camera Unavailable. Please allow camera access and try again.");
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
    const video = videoRef.current;
    const stream = video?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((track) => track.stop());
    if (video) {
      video.srcObject = null;
    }
    setCameraState("idle");
  }, []);

  const captureAndRecognize = useCallback(async () => {
    if (inFlight.current || cameraState !== "running") {
      return;
    }
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!video || !canvas || video.readyState < 2) {
      return;
    }
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    if (overlay) {
      overlay.width = canvas.width;
      overlay.height = canvas.height;
    }
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
    if (!blob) {
      return;
    }
    inFlight.current = true;
    try {
      const recognition = await api.recognize(blob);
      setNetworkError("");
      setResult(recognition);
      if (overlay) {
        drawFaceOverlay(
          overlay,
          (recognition.faces || []).map((face) => ({
            index: face.index,
            bbox: face.bbox,
            recognized: face.recognized,
            label: `#${face.index} ${face.person ? `${face.person.first_name} ${face.person.last_name}` : "Unknown"} · ${face.action}`,
          })),
          recognition.recognized_face_index,
        );
      }
      if (!recognition.face_detected) {
        setUiState("no-face");
      } else if (recognition.recognized) {
        setUiState("recognized");
      } else {
        setUiState("unknown");
      }
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Backend unavailable";
      setNetworkError(message);
      setUiState("error");
    } finally {
      inFlight.current = false;
    }
  }, [cameraState]);

  useEffect(() => {
    if (!enabled) {
      stopCamera();
      return;
    }
    void startCamera();
    return () => stopCamera();
  }, [enabled, startCamera, stopCamera]);

  useEffect(() => {
    if (!enabled || cameraState !== "running") {
      return;
    }
    const timer = window.setInterval(() => {
      void captureAndRecognize();
    }, Math.max(intervalMs, 250));
    return () => window.clearInterval(timer);
  }, [enabled, cameraState, intervalMs, captureAndRecognize]);

  return {
    videoRef,
    canvasRef,
    overlayRef,
    cameraState,
    cameraError,
    uiState,
    result,
    networkError,
    retry: startCamera,
  };
}
