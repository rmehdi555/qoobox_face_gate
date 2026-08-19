import { useEffect, useState } from "react";
import clsx from "clsx";
import { AlertTriangle, ScanFace, UserRoundX, VideoOff } from "lucide-react";

import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { usePageTitle } from "../components/ui/Toast";
import { useLiveRecognition } from "../hooks/useLiveRecognition";
import { api } from "../services/api";

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
          The webcam stream is analyzed on the server. Recognition updates automatically while the camera is running.
        </p>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 shadow-card">
        <div className="relative aspect-video bg-black">
          <video ref={live.videoRef} className="h-full w-full object-cover" playsInline muted autoPlay />
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
    </div>
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
  result: ReturnType<typeof useLiveRecognition>["result"];
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
    title = "Unknown Person";
    message = "No registered person matched this face.";
    tone = "warning";
    Icon = UserRoundX;
  } else if (uiState === "recognized" && result?.person) {
    title = "Person Recognized";
    message = `${result.person.first_name} ${result.person.last_name}`;
    tone = "success";
    Icon = ScanFace;
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
              Confidence: {Math.round(result.confidence * 100)}%
            </p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
