import { useEffect, useState } from "react";
import clsx from "clsx";
import { Download, Play, Square, Trash2, Video, VideoOff } from "lucide-react";

import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { usePageTitle } from "../components/ui/Toast";
import { useLiveSession } from "../hooks/useLiveSession";
import { formatClock } from "../lib/media";
import { api } from "../services/api";
import type { SessionEvent } from "../types";

export function LiveSessionPage() {
  usePageTitle("Live Session");
  const [intervalMs, setIntervalMs] = useState(500);
  const [language, setLanguage] = useState("en");
  const session = useLiveSession({ intervalMs, language });

  useEffect(() => {
    api
      .recognitionStatus()
      .then((status) => setIntervalMs(status.recognition_interval_ms || 500))
      .catch(() => undefined);
  }, []);

  const recording = session.status === "recording";
  const busy = session.status === "starting" || session.status === "stopping";
  const cameraBlocked = session.cameraState === "denied" || session.cameraState === "unavailable";
  const speechEvents = session.events.filter((event) => event.kind === "speech");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Live Session</h1>
        <p className="mt-1 text-sm text-slate-500">
          Press Start to record video and audio together. Faces are identified in real time, expressions are logged, and
          speech is transcribed with a speaker label. Unregistered people are saved as Unknown 1, Unknown 2, and so on.
        </p>
      </div>

      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <label className="block w-full space-y-1.5 sm:max-w-xs">
            <span className="text-sm font-medium text-slate-700">Transcription language</span>
            <select
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
              value={language}
              disabled={recording || busy}
              onChange={(event) => setLanguage(event.target.value)}
            >
              <option value="auto">Auto detect</option>
              <option value="en">English</option>
            </select>
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <span className={clsx("rounded-full px-3 py-1 text-xs font-semibold", recording ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600")}>
              {recording ? `Recording ${formatClock(session.seconds)}` : busy ? "Please wait..." : "Idle"}
            </span>
            {recording ? (
              <Button type="button" variant="danger" onClick={() => void session.stop()} disabled={busy}>
                <Square className="h-4 w-4" />
                Stop
              </Button>
            ) : (
              <Button type="button" onClick={() => void session.start()} disabled={busy}>
                <Play className="h-4 w-4" />
                Start
              </Button>
            )}
          </div>
        </div>
      </Card>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 shadow-card">
        <div className="relative aspect-video bg-black">
          <video
            ref={session.videoRef}
            className={clsx("absolute inset-0 h-full w-full object-contain", !recording && session.videoUrl && "hidden")}
            playsInline
            muted
            autoPlay
          />
          <canvas
            ref={session.overlayRef}
            className={clsx(
              "pointer-events-none absolute inset-0 h-full w-full object-contain",
              !recording && session.videoUrl && "hidden",
            )}
          />
          {!recording && session.videoUrl ? (
            <video className="absolute inset-0 h-full w-full object-contain" src={session.videoUrl} controls playsInline />
          ) : null}
          <canvas ref={session.canvasRef} className="hidden" />
          {cameraBlocked ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950 px-6 text-center text-white">
              <VideoOff className="h-10 w-10 text-slate-400" />
              <p className="text-lg font-semibold">Camera Unavailable</p>
              <p className="max-w-md text-sm text-slate-300">{session.cameraError || "Please allow camera and microphone access."}</p>
              <Button type="button" onClick={() => void session.start()}>
                Try again
              </Button>
            </div>
          ) : null}
          {!recording && !busy && !cameraBlocked && !session.videoUrl ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/80 px-6 text-center text-white">
              <Video className="h-10 w-10 text-slate-400" />
              <p className="text-lg font-semibold">Ready to record</p>
              <p className="max-w-md text-sm text-slate-300">Start a session to capture video, audio, identities, and speech.</p>
            </div>
          ) : null}
          {session.status === "starting" ? (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 text-sm text-white">
              Requesting camera and microphone permission...
            </div>
          ) : null}
        </div>
      </div>

      {session.networkError ? <p className="text-sm text-rose-600">{session.networkError}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900">Live announcement</h2>
            {session.speechBusy ? <span className="text-xs font-medium text-slate-500">Transcribing speech...</span> : null}
          </div>
          {session.currentFaces.length ? (
            <ul className="mt-4 space-y-3">
              {session.currentFaces.map((face) => (
                <li
                  key={face.speaker.key}
                  className={clsx(
                    "rounded-xl border px-4 py-3",
                    face.recognized ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50",
                  )}
                >
                  <p className="text-sm font-semibold text-slate-900">{face.speaker.label}</p>
                  <p className="mt-1 text-sm text-slate-700">
                    {face.emotion_label} · {face.action}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              {recording ? "Looking for faces..." : "Identities and facial actions will appear here while recording."}
            </p>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900">Saved session</h2>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={session.downloadVideo} disabled={!session.videoUrl}>
                <Download className="h-4 w-4" />
                Video
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={session.downloadTranscript} disabled={!speechEvents.length}>
                <Download className="h-4 w-4" />
                Transcript
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={session.downloadLog} disabled={!session.events.length}>
                <Download className="h-4 w-4" />
                Log
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={session.clearLog} disabled={!session.events.length && !session.videoUrl}>
                <Trash2 className="h-4 w-4" />
                Clear
              </Button>
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-500">
            {session.videoUrl
              ? "Recording saved. Download the video, speaker transcript, or full event log."
              : "After you press Stop, the video, transcript, and event log can be downloaded here."}
          </p>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="text-base font-semibold text-slate-900">Event log</h2>
        <p className="mt-1 text-sm text-slate-500">
          Identity, facial action, and attributed speech are stored as they happen.
        </p>
        {session.events.length ? (
          <ol className="mt-4 max-h-[28rem] space-y-2 overflow-auto pr-1">
            {session.events.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </ol>
        ) : (
          <p className="mt-4 text-sm text-slate-500">No events saved yet.</p>
        )}
      </Card>
    </div>
  );
}

function EventRow({ event }: { event: SessionEvent }) {
  return (
    <li className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
      <span className="shrink-0 font-mono text-xs text-slate-500">{formatClock(Math.floor(event.atMs / 1000))}</span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {event.kind === "speech" ? "Speech" : "Presence"}
        </p>
        {event.kind === "speech" ? (
          <p className="mt-0.5 text-sm text-slate-800">
            <span className="font-semibold">{event.speaker}:</span> {event.text}
          </p>
        ) : (
          <p className="mt-0.5 text-sm text-slate-800">
            {event.speaker}
            {event.action ? ` · ${event.action}` : ""}
          </p>
        )}
      </div>
    </li>
  );
}
