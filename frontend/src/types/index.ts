export type User = {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
};

export type FaceImage = {
  id: string;
  person_id: string;
  original_filename: string;
  created_at: string;
};

export type Person = {
  id: string;
  first_name: string;
  last_name: string;
  created_at: string;
  updated_at: string;
  face_count: number;
  thumbnail_id: string | null;
  faces?: FaceImage[];
};

export type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DetectedFace = {
  index: number;
  bbox: BoundingBox;
  recognized: boolean;
  person: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
  confidence: number;
  emotion: string;
  emotion_label: string;
  action: string;
  emotion_confidence: number;
  embedding?: number[];
};

export type RecognitionResult = {
  recognized: boolean;
  person: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
  confidence: number;
  face_detected: boolean;
  face_count: number;
  recognized_face_index: number | null;
  message: string | null;
  faces: DetectedFace[];
};

export type RecognitionStatus = {
  status: string;
  model_loaded: boolean;
  registered_embeddings: number;
  threshold: number;
  recognition_interval_ms: number;
  model_name: string;
  execution_device?: string;
};

export type DashboardStats = {
  total_people: number;
  total_face_images: number;
  recognition_status: string;
  model_loaded: boolean;
  registered_embeddings: number;
  threshold: number;
  execution_device?: string;
};

export type CameraState = "idle" | "starting" | "running" | "denied" | "unavailable";
export type RecognitionUiState = "idle" | "recognized" | "unknown" | "no-face" | "error";

export type TranscriptSegment = {
  start: number;
  end: number;
  text: string;
};

export type TranscriptionResult = {
  text: string;
  language: string | null;
  language_probability: number;
  duration_seconds: number;
  model: string;
  segments?: TranscriptSegment[];
};

export type SessionEvent = {
  id: string;
  atMs: number;
  kind: "presence" | "speech";
  speaker: string;
  speakerKey: string;
  text: string;
  action?: string;
  emotion?: string;
};

export type SpeechStatus = {
  status: string;
  model_loaded: boolean;
  model_name: string;
  device: string;
  error?: string | null;
};

export type SessionStartResult = {
  id: string;
  status: string;
  language: string | null;
  started_at: string;
};

export type SessionTranscriptLine = {
  at_ms: number;
  speaker: string;
  text: string;
};

export type SessionFacialState = {
  at_ms: number;
  speaker: string;
  action: string | null;
  emotion: string | null;
};

export type SessionDetail = {
  id: string;
  status: string;
  language: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  recording_url: string | null;
  recording_filename: string | null;
  transcript: SessionTranscriptLine[];
  facial_states: SessionFacialState[];
  events: Array<{
    id: string | null;
    at_ms: number;
    kind: string;
    speaker: string;
    speaker_key: string;
    text: string;
    action?: string | null;
    emotion?: string | null;
  }>;
  created_at: string;
  updated_at: string;
};
