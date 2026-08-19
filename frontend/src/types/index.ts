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

export type TranscriptionResult = {
  text: string;
  language: string | null;
  language_probability: number;
  duration_seconds: number;
  model: string;
};

export type SpeechStatus = {
  status: string;
  model_loaded: boolean;
  model_name: string;
  device: string;
  error?: string | null;
};
