import { useEffect, useRef, useState } from "react";
import { Copy, Mic, Square, Upload } from "lucide-react";

import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Spinner } from "../components/ui/Spinner";
import { usePageTitle } from "../components/ui/Toast";
import { useToast } from "../hooks/useToast";
import { ApiError, api } from "../services/api";
import type { SpeechStatus, TranscriptionResult } from "../types";

function pickRecorderMime(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return "";
}

export function SpeechPage() {
  usePageTitle("Speech to Text");
  const { notify } = useToast();
  const [status, setStatus] = useState<SpeechStatus | null>(null);
  const [language, setLanguage] = useState("auto");
  const [file, setFile] = useState<File | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [error, setError] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    api
      .speechStatus()
      .then(setStatus)
      .catch(() => undefined);
    return () => {
      stopTimer();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function stopTimer() {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function transcribeBlob(blob: Blob, filename: string) {
    setBusy(true);
    setError("");
    try {
      const transcript = await api.transcribe(blob, filename, language);
      setResult(transcript);
      if (!transcript.text) {
        notify("error", "No speech was detected in this audio.");
      } else {
        notify("success", "Transcript ready");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to transcribe audio");
    } finally {
      setBusy(false);
    }
  }

  async function onUpload() {
    if (!file) {
      setError("Choose an audio file first.");
      return;
    }
    await transcribeBlob(file, file.name);
  }

  async function startRecording() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser does not support microphone recording.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickRecorderMime();
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        const extension = type.includes("mp4") ? "m4a" : "webm";
        void transcribeBlob(blob, `recording.${extension}`);
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setSeconds(0);
      timerRef.current = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    } catch {
      setError("Microphone access was denied. Allow the microphone and try again.");
    }
  }

  function stopRecording() {
    stopTimer();
    setRecording(false);
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  }

  async function copyText() {
    if (!result?.text) {
      return;
    }
    await navigator.clipboard.writeText(result.text);
    notify("success", "Copied to clipboard");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Speech to Text</h1>
        <p className="mt-1 text-sm text-slate-500">
          Upload an audio file or record from the microphone. Whisper converts speech to text on the CPU.
        </p>
        <p className="mt-2 text-xs text-slate-400">
          Engine: {status?.model_loaded ? `Ready · ${status.model_name} · ${status.device}` : "Loading Whisper model..."}
        </p>
      </div>

      <Card className="p-6 space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Language</span>
          <select
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          >
            <option value="auto">Auto detect</option>
            <option value="en">English</option>
            <option value="fa">Persian</option>
          </select>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-800">Upload Audio</p>
            <p className="mt-1 text-xs text-slate-500">WAV, MP3, WEBM, OGG, or M4A. Max 25 MB.</p>
            <input
              type="file"
              accept="audio/*,.wav,.mp3,.webm,.ogg,.m4a"
              className="mt-3 block w-full text-sm"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <Button type="button" className="mt-3 w-full" onClick={() => void onUpload()} disabled={busy || recording}>
              <Upload className="h-4 w-4" />
              Transcribe file
            </Button>
          </div>

          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-800">Record from Microphone</p>
            <p className="mt-1 text-xs text-slate-500">
              {recording ? `Recording… ${seconds}s` : "Click start, speak, then stop to transcribe."}
            </p>
            {recording ? (
              <Button type="button" variant="danger" className="mt-6 w-full" onClick={stopRecording}>
                <Square className="h-4 w-4" />
                Stop Recording
              </Button>
            ) : (
              <Button type="button" className="mt-6 w-full" onClick={() => void startRecording()} disabled={busy}>
                <Mic className="h-4 w-4" />
                Start Recording
              </Button>
            )}
          </div>
        </div>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        {busy ? <Spinner label="Transcribing..." /> : null}
      </Card>

      {result ? (
        <Card className="p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900">Transcript</h2>
            <Button type="button" variant="secondary" size="sm" onClick={() => void copyText()} disabled={!result.text}>
              <Copy className="h-4 w-4" />
              Copy
            </Button>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-800">
            {result.text || "No speech detected."}
          </p>
          <p className="mt-3 text-xs text-slate-500">
            Language: {result.language || "unknown"}
            {result.language_probability ? ` (${Math.round(result.language_probability * 100)}%)` : ""}
            {result.duration_seconds ? ` · ${result.duration_seconds}s` : ""} · {result.model}
          </p>
        </Card>
      ) : null}
    </div>
  );
}
