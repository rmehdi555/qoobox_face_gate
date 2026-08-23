import { useCallback, useEffect, useRef, useState } from "react";

import { drawFaceOverlay } from "../lib/drawFaces";
import { IdentityTracker, pickSpeaker, type LabeledFace, type TrackedSpeaker } from "../lib/identityTracker";
import { downloadBlob, extensionForMime, formatClock, pickAudioMime, pickVideoMime, stampFilename } from "../lib/media";
import { ApiError, api } from "../services/api";
import type { CameraState, SessionEvent } from "../types";

const AUDIO_CHUNK_MS = 5000;
const STORAGE_KEY = "facegate_last_session";

type SessionStatus = "idle" | "starting" | "recording" | "stopping";

type Options = {
  intervalMs: number;
  language: string;
};

function presenceSignature(faces: LabeledFace[]): string {
  return faces
    .map((face) => `${face.speaker.key}:${face.action}`)
    .sort()
    .join("|");
}

function loadSavedEvents(): SessionEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as { events?: SessionEvent[] };
    return Array.isArray(parsed.events) ? parsed.events : [];
  } catch {
    return [];
  }
}

function persistEvents(events: SessionEvent[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ events, savedAt: new Date().toISOString() }));
  } catch {
    // Ignore quota errors; downloads still work.
  }
}

export function useLiveSession({ intervalMs, language }: Options) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRecorderRef = useRef<MediaRecorder | null>(null);
  const sessionChunksRef = useRef<Blob[]>([]);
  const chunkRecorderRef = useRef<MediaRecorder | null>(null);
  const chunkTimerRef = useRef<number | null>(null);
  const clockTimerRef = useRef<number | null>(null);
  const recognizeTimerRef = useRef<number | null>(null);
  const inFlight = useRef(false);
  const transcribing = useRef(false);
  const trackerRef = useRef(new IdentityTracker());
  const lastFacesRef = useRef<LabeledFace[]>([]);
  const lastSpeakerKeyRef = useRef<string | null>(null);
  const lastPresenceRef = useRef("");
  const sessionActiveRef = useRef(false);
  const startedAtRef = useRef(0);
  const videoUrlRef = useRef<string | null>(null);

  const [status, setStatus] = useState<SessionStatus>("idle");
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [cameraError, setCameraError] = useState("");
  const [networkError, setNetworkError] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [currentFaces, setCurrentFaces] = useState<LabeledFace[]>([]);
  const [events, setEvents] = useState<SessionEvent[]>(() => loadSavedEvents());
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoMime, setVideoMime] = useState("video/webm");
  const [speechBusy, setSpeechBusy] = useState(false);

  const pushEvent = useCallback((event: SessionEvent) => {
    setEvents((current) => {
      const next = [...current, event];
      persistEvents(next);
      return next;
    });
  }, []);

  const stopTimer = useCallback((ref: { current: number | null }) => {
    if (ref.current) {
      window.clearInterval(ref.current);
      ref.current = null;
    }
  }, []);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) {
      video.srcObject = null;
    }
  }, []);

  const transcribeChunk = useCallback(
    async (blob: Blob, filename: string) => {
      if (blob.size < 800) {
        return;
      }
      transcribing.current = true;
      setSpeechBusy(true);
      try {
        const result = await api.transcribe(blob, filename, language);
        const pieces = result.segments?.length
          ? result.segments.map((segment) => segment.text.trim()).filter(Boolean)
          : result.text
            ? [result.text.trim()]
            : [];
        if (!pieces.length) {
          return;
        }
        const faces = lastFacesRef.current;
        const chosen = pickSpeaker(faces, lastSpeakerKeyRef.current);
        const speaker: TrackedSpeaker = chosen?.speaker ?? trackerRef.current.fallbackSpeaker();
        lastSpeakerKeyRef.current = speaker.key;
        const elapsed = Date.now() - startedAtRef.current;
        pieces.forEach((text, index) => {
          pushEvent({
            id: `${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
            atMs: elapsed,
            kind: "speech",
            speaker: speaker.label,
            speakerKey: speaker.key,
            text,
          });
        });
      } catch (error) {
        const message = error instanceof ApiError ? error.message : "Unable to transcribe audio";
        setNetworkError(message);
      } finally {
        transcribing.current = false;
        setSpeechBusy(false);
      }
    },
    [language, pushEvent],
  );

  const stopChunkRecorder = useCallback(async () => {
    if (chunkTimerRef.current) {
      window.clearTimeout(chunkTimerRef.current);
      chunkTimerRef.current = null;
    }
    const recorder = chunkRecorderRef.current;
    chunkRecorderRef.current = null;
    if (!recorder || recorder.state === "inactive") {
      return;
    }
    await new Promise<void>((resolve) => {
      recorder.addEventListener("stop", () => resolve(), { once: true });
      recorder.stop();
    });
  }, []);

  const startAudioChunk = useCallback(
    (audioStream: MediaStream) => {
      if (!sessionActiveRef.current) {
        return;
      }
      const mime = pickAudioMime();
      const recorder = mime ? new MediaRecorder(audioStream, { mimeType: mime }) : new MediaRecorder(audioStream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunks, { type });
        const extension = extensionForMime(type, "m4a");
        void transcribeChunk(blob, `session-chunk.${extension}`);
        if (sessionActiveRef.current) {
          startAudioChunk(audioStream);
        }
      };
      chunkRecorderRef.current = recorder;
      recorder.start();
      chunkTimerRef.current = window.setTimeout(() => {
        if (recorder.state !== "inactive") {
          recorder.stop();
        }
      }, AUDIO_CHUNK_MS);
    },
    [transcribeChunk],
  );

  const captureAndRecognize = useCallback(async () => {
    if (inFlight.current || !sessionActiveRef.current) {
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
      const labeled = trackerRef.current.labelFaces(recognition.faces || []);
      lastFacesRef.current = labeled;
      setCurrentFaces(labeled);
      if (overlay) {
        drawFaceOverlay(
          overlay,
          labeled.map((face) => ({
            index: face.index,
            bbox: face.bbox,
            recognized: face.recognized,
            label: `${face.speaker.label} · ${face.action}`,
          })),
          recognition.recognized_face_index,
        );
      }
      const signature = presenceSignature(labeled);
      if (signature && signature !== lastPresenceRef.current) {
        lastPresenceRef.current = signature;
        const elapsed = Date.now() - startedAtRef.current;
        labeled.forEach((face, index) => {
          pushEvent({
            id: `${Date.now()}-p-${index}-${Math.random().toString(16).slice(2)}`,
            atMs: elapsed,
            kind: "presence",
            speaker: face.speaker.label,
            speakerKey: face.speaker.key,
            text: `${face.speaker.label} · ${face.action}`,
            action: face.action,
            emotion: face.emotion_label,
          });
        });
      }
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Recognition service unavailable";
      setNetworkError(message);
    } finally {
      inFlight.current = false;
    }
  }, [pushEvent]);

  const stop = useCallback(async () => {
    if (!sessionActiveRef.current && status === "idle") {
      return;
    }
    sessionActiveRef.current = false;
    setStatus("stopping");
    stopTimer(clockTimerRef);
    stopTimer(recognizeTimerRef);
    await stopChunkRecorder();
    const sessionRecorder = sessionRecorderRef.current;
    sessionRecorderRef.current = null;
    let recorded: Blob | null = null;
    if (sessionRecorder && sessionRecorder.state !== "inactive") {
      recorded = await new Promise<Blob>((resolve) => {
        sessionRecorder.addEventListener(
          "stop",
          () => {
            const type = sessionRecorder.mimeType || "video/webm";
            resolve(new Blob(sessionChunksRef.current, { type }));
          },
          { once: true },
        );
        sessionRecorder.stop();
      });
    } else if (sessionChunksRef.current.length) {
      recorded = new Blob(sessionChunksRef.current, { type: videoMime });
    }
    stopTracks();
    setCameraState("idle");
    setCurrentFaces([]);
    lastFacesRef.current = [];
    if (recorded && recorded.size > 0) {
      if (videoUrlRef.current) {
        URL.revokeObjectURL(videoUrlRef.current);
      }
      const url = URL.createObjectURL(recorded);
      videoUrlRef.current = url;
      setVideoUrl(url);
      setVideoMime(recorded.type || videoMime);
    }
    setStatus("idle");
  }, [status, stopChunkRecorder, stopTimer, stopTracks, videoMime]);

  const start = useCallback(async () => {
    setCameraError("");
    setNetworkError("");
    setStatus("starting");
    setCameraState("starting");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState("unavailable");
      setCameraError("This browser does not support camera or microphone access.");
      setStatus("idle");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
      trackerRef.current.reset();
      lastFacesRef.current = [];
      lastSpeakerKeyRef.current = null;
      lastPresenceRef.current = "";
      sessionChunksRef.current = [];
      startedAtRef.current = Date.now();
      setEvents([]);
      persistEvents([]);
      setCurrentFaces([]);
      if (videoUrlRef.current) {
        URL.revokeObjectURL(videoUrlRef.current);
        videoUrlRef.current = null;
      }
      setVideoUrl(null);
      setSeconds(0);

      const videoMimeType = pickVideoMime();
      const sessionRecorder = videoMimeType
        ? new MediaRecorder(stream, { mimeType: videoMimeType })
        : new MediaRecorder(stream);
      sessionRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          sessionChunksRef.current.push(event.data);
        }
      };
      sessionRecorderRef.current = sessionRecorder;
      setVideoMime(sessionRecorder.mimeType || "video/webm");
      sessionRecorder.start(1000);

      sessionActiveRef.current = true;
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length) {
        startAudioChunk(new MediaStream(audioTracks));
      }
      clockTimerRef.current = window.setInterval(() => setSeconds((value) => value + 1), 1000);
      recognizeTimerRef.current = window.setInterval(() => {
        void captureAndRecognize();
      }, Math.max(intervalMs, 250));
      setCameraState("running");
      setStatus("recording");
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setCameraState("denied");
        setCameraError("Please allow camera and microphone access, then try again.");
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setCameraState("unavailable");
        setCameraError("No camera or microphone was detected on this device.");
      } else {
        setCameraState("unavailable");
        setCameraError("Camera or microphone unavailable. Allow access and try again.");
      }
      stopTracks();
      setStatus("idle");
    }
  }, [captureAndRecognize, intervalMs, startAudioChunk, stopTracks]);

  const downloadVideo = useCallback(() => {
    if (!videoUrl) {
      return;
    }
    const extension = extensionForMime(videoMime, "mp4");
    const link = document.createElement("a");
    link.href = videoUrl;
    link.download = stampFilename("live-session", extension);
    link.click();
  }, [videoMime, videoUrl]);

  const downloadLog = useCallback(() => {
    const payload = {
      started_at: startedAtRef.current ? new Date(startedAtRef.current).toISOString() : null,
      duration_seconds: seconds,
      events,
    };
    downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), stampFilename("live-session-log", "json"));
  }, [events, seconds]);

  const downloadTranscript = useCallback(() => {
    const lines = events
      .filter((event) => event.kind === "speech")
      .map((event) => `[${formatClock(Math.floor(event.atMs / 1000))}] ${event.speaker}: ${event.text}`);
    const body = lines.length ? lines.join("\n") : "No speech was recorded.";
    downloadBlob(new Blob([body], { type: "text/plain;charset=utf-8" }), stampFilename("live-session-transcript", "txt"));
  }, [events]);

  const clearLog = useCallback(() => {
    setEvents([]);
    persistEvents([]);
    if (videoUrlRef.current) {
      URL.revokeObjectURL(videoUrlRef.current);
      videoUrlRef.current = null;
    }
    setVideoUrl(null);
  }, []);

  useEffect(() => {
    return () => {
      sessionActiveRef.current = false;
      stopTimer(clockTimerRef);
      stopTimer(recognizeTimerRef);
      if (chunkTimerRef.current) {
        window.clearTimeout(chunkTimerRef.current);
      }
      if (chunkRecorderRef.current && chunkRecorderRef.current.state !== "inactive") {
        chunkRecorderRef.current.stop();
      }
      if (sessionRecorderRef.current && sessionRecorderRef.current.state !== "inactive") {
        sessionRecorderRef.current.stop();
      }
      stopTracks();
      if (videoUrlRef.current) {
        URL.revokeObjectURL(videoUrlRef.current);
      }
    };
  }, [stopTimer, stopTracks]);

  return {
    videoRef,
    canvasRef,
    overlayRef,
    status,
    cameraState,
    cameraError,
    networkError,
    seconds,
    currentFaces,
    events,
    videoUrl,
    speechBusy,
    start,
    stop,
    downloadVideo,
    downloadLog,
    downloadTranscript,
    clearLog,
  };
}
