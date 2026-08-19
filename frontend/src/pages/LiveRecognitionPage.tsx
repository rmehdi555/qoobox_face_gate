import { useEffect, useState } from "react";
import clsx from "clsx";
import { AlertTriangle, ScanFace, Smile, UserRoundX, VideoOff } from "lucide-react";

import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { usePageTitle } from "../components/ui/Toast";
import { useLiveRecognition } from "../hooks/useLiveRecognition";
import { api } from "../services/api";
import type { DetectedFace, RecognitionResult } from "../types";

export function LiveRecognitionPage() {
  usePageTitle("Live Recognition");
  const [intervalMs, setIntervalMs] = useState(500);
  const live = useLiveRecognition({ intervalMs, enabled: true });

  useEffect(() => {
    api
      .recognitionStatus()
      .then((status) => setIntervalMs(status.recognition_interval_ms || 500))
      .catch(() => undefined);
  }, []);

  const cameraBlocked = live.cameraState === "denied" || live.cameraState === "unavailable";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Live Recognition</h1>
        <p className="mt-1 text-sm text-slate-500">
          Each detected face is numbered left to right. The recognized person is highlighted on the video, along with
          their expression.
        </p>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 shadow-card">
        <div className="relative aspect-video bg-black">
          <video ref={live.videoRef} className="absolute inset-0 h-full w-full object-contain" playsInline muted autoPlay />
          <canvas ref={live.overlayRef} className="pointer-events-none absolute inset-0 h-full w-full object-contain" />
          <canvas ref={live.canvasRef} className="hidden" />
          {cameraBlocked ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950 px-6 text-center text-white">
              <VideoOff className="h-10 w-10 text-slate-400" />
              <p className="text-lg font-semibold">Camera Unavailable</p>
              <p className="max-w-md text-sm text-slate-300">{live.cameraError || "Please allow camera access and try again."}</p>
              <Button type="button" onClick={() => void live.retry()}>
                Try again
              </Button>
            </div>
          ) : null}
          {live.cameraState === "starting" ? (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 text-sm text-white">
              Requesting camera permission...
            </div>
          ) : null}
        </div>
      </div>

      <StatusCard
        blocked={cameraBlocked}
        cameraError={live.cameraError}
        uiState={live.uiState}
        result={live.result}
        networkError={live.networkError}
      />

      {live.result?.faces && live.result.faces.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {live.result.faces.map((face) => (
            <FaceCard key={face.index} face={face} primary={live.result?.recognized_face_index === face.index} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FaceCard({ face, primary }: { face: DetectedFace; primary: boolean }) {
  const name = face.person ? `${face.person.first_name} ${face.person.last_name}` : "Unknown person";
  return (
    <Card className={clsx("p-4", primary && "border-emerald-300 bg-emerald-50", face.recognized && !primary && "border-emerald-200")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Face {face.index}</p>
          <p className="mt-1 text-base font-semibold text-slate-900">{name}</p>
          <p className="mt-1 text-sm text-slate-700">
            {face.emotion_label} · {face.action}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Expression confidence {Math.round(face.emotion_confidence * 100)}%
            {face.recognized ? ` · Match ${Math.round(face.confidence * 100)}%` : ""}
          </p>
        </div>
            {face.recognized ? (
              <span className="rounded-full bg-emerald-600 px-2 py-1 text-xs font-semibold text-white">
                {primary ? "Identified" : "Matched"}
              </span>
            ) : (
              <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-600">Unknown</span>
            )}
      </div>
    </Card>
  );
}

function StatusCard({
  blocked,
  cameraError,
  uiState,
  result,
  networkError,
}: {
  blocked: boolean;
  cameraError: string;
  uiState: ReturnType<typeof useLiveRecognition>["uiState"];
  result: RecognitionResult | null;
  networkError: string;
}) {
  let title = "Waiting for camera";
  let message = "Recognition results will appear here.";
  let tone: "neutral" | "success" | "warning" | "danger" = "neutral";
  let Icon = ScanFace;

  if (blocked) {
    title = "Camera Unavailable";
    message = cameraError || "Please allow camera access and try again.";
    tone = "danger";
    Icon = VideoOff;
  } else if (uiState === "error") {
    title = "Recognition Error";
    message = networkError || "The recognition service is currently unavailable.";
    tone = "danger";
    Icon = AlertTriangle;
  } else if (uiState === "no-face") {
    title = "No Face Detected";
    message = "Please look at the camera.";
    tone = "warning";
    Icon = ScanFace;
  } else if (uiState === "unknown") {
    title = result?.face_count && result.face_count > 1 ? `${result.face_count} Faces Detected` : "Unknown Person";
    message = result?.message || "No registered person matched this face.";
    tone = "warning";
    Icon = UserRoundX;
  } else if (uiState === "recognized" && result?.person) {
    title = "Person Recognized";
    const action = result.faces.find((face) => face.index === result.recognized_face_index)?.action;
    message =
      result.face_count > 1
        ? `${result.person.first_name} ${result.person.last_name} is Face ${result.recognized_face_index} of ${result.face_count}${action ? ` · ${action}` : ""}`
        : `${result.person.first_name} ${result.person.last_name}${action ? ` · ${action}` : ""}`;
    tone = "success";
    Icon = Smile;
  }

  return (
    <Card
      className={clsx(
        "p-6",
        tone === "success" && "border-emerald-200 bg-emerald-50",
        tone === "warning" && "border-amber-200 bg-amber-50",
        tone === "danger" && "border-rose-200 bg-rose-50",
      )}
    >
      <div className="flex items-start gap-4">
        <div
          className={clsx(
            "rounded-2xl p-3",
            tone === "success" && "bg-emerald-100 text-emerald-700",
            tone === "warning" && "bg-amber-100 text-amber-700",
            tone === "danger" && "bg-rose-100 text-rose-700",
            tone === "neutral" && "bg-slate-100 text-slate-600",
          )}
        >
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-lg font-semibold text-slate-900">{title}</p>
          <p className="mt-1 text-sm text-slate-700">{message}</p>
          {uiState === "recognized" && result?.person ? (
            <p className="mt-2 text-sm font-medium text-emerald-800">
              Match confidence: {Math.round(result.confidence * 100)}%
            </p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
