import type { DashboardStats, FaceImage, Person, RecognitionResult, RecognitionStatus, SessionDetail, SessionEvent, SessionStartResult, SpeechStatus, TokenResponse, TranscriptionResult, User } from "../types";

const TOKEN_KEY = "facegate_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function apiBase(): string {
  return import.meta.env.VITE_API_URL || "/api";
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}, expectJson = true): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${apiBase()}${path}`, { ...init, headers });
  } catch {
    throw new ApiError("Unable to reach the FaceGate server. Please try again.", 0);
  }

  if (response.status === 401) {
    clearToken();
    if (!window.location.pathname.startsWith("/login")) {
      window.location.assign("/login");
    }
    throw new ApiError("Your session has expired. Please sign in again.", 401);
  }

  if (!response.ok) {
    let detail = "Request failed";
    try {
      const body = await response.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      detail = response.statusText || detail;
    }
    throw new ApiError(detail, response.status);
  }

  if (!expectJson || response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export const api = {
  login(email: string, password: string) {
    return request<TokenResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },
  me() {
    return request<User>("/auth/me");
  },
  stats() {
    return request<DashboardStats>("/stats");
  },
  listPeople(search?: string) {
    const query = search ? `?search=${encodeURIComponent(search)}` : "";
    return request<Person[]>(`/persons${query}`);
  },
  getPerson(id: string) {
    return request<Person>(`/persons/${id}`);
  },
  createPerson(firstName: string, lastName: string) {
    return request<Person>("/persons", {
      method: "POST",
      body: JSON.stringify({ first_name: firstName, last_name: lastName }),
    });
  },
  updatePerson(id: string, firstName: string, lastName: string) {
    return request<Person>(`/persons/${id}`, {
      method: "PUT",
      body: JSON.stringify({ first_name: firstName, last_name: lastName }),
    });
  },
  deletePerson(id: string) {
    return request<{ message: string }>(`/persons/${id}`, { method: "DELETE" });
  },
  uploadFace(personId: string, file: File) {
    const data = new FormData();
    data.append("file", file);
    return request<FaceImage>(`/persons/${personId}/faces`, { method: "POST", body: data });
  },
  deleteFace(imageId: string) {
    return request<{ message: string }>(`/faces/${imageId}`, { method: "DELETE" });
  },
  async faceFileUrl(imageId: string): Promise<string> {
    const token = getToken();
    const response = await fetch(`${apiBase()}/faces/${imageId}/file`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!response.ok) {
      throw new ApiError("Unable to load image", response.status);
    }
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  },
  recognitionStatus() {
    return request<RecognitionStatus>("/recognition/status");
  },
  recognize(file: Blob) {
    const data = new FormData();
    data.append("file", file, "frame.jpg");
    return request<RecognitionResult>("/recognition/recognize", { method: "POST", body: data });
  },
  speechStatus() {
    return request<SpeechStatus>("/speech/status");
  },
  transcribe(file: Blob, filename: string, language: string) {
    const data = new FormData();
    data.append("file", file, filename);
    data.append("language", language);
    return request<TranscriptionResult>("/speech/transcribe", { method: "POST", body: data });
  },
  startSession(language: string) {
    return request<SessionStartResult>("/sessions/start", {
      method: "POST",
      body: JSON.stringify({ language }),
    });
  },
  stopSession(
    sessionId: string,
    payload: {
      events: SessionEvent[];
      durationSeconds?: number;
      language?: string;
      file?: Blob | null;
      filename?: string;
    },
  ) {
    const data = new FormData();
    data.append(
      "events",
      JSON.stringify(
        payload.events.map((event) => ({
          id: event.id,
          at_ms: event.atMs,
          kind: event.kind,
          speaker: event.speaker,
          speaker_key: event.speakerKey,
          text: event.text,
          action: event.action ?? null,
          emotion: event.emotion ?? null,
        })),
      ),
    );
    if (payload.durationSeconds != null) {
      data.append("duration_seconds", String(payload.durationSeconds));
    }
    if (payload.language) {
      data.append("language", payload.language);
    }
    if (payload.file) {
      data.append("file", payload.file, payload.filename || "session.webm");
    }
    return request<SessionDetail>(`/sessions/${sessionId}/stop`, { method: "POST", body: data });
  },
  getSession(sessionId: string) {
    return request<SessionDetail>(`/sessions/${sessionId}`);
  },
  async sessionRecordingUrl(sessionId: string): Promise<string> {
    const token = getToken();
    const response = await fetch(`${apiBase()}/sessions/${sessionId}/recording`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!response.ok) {
      throw new ApiError("Unable to load session recording", response.status);
    }
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  },
};
