import type { BoundingBox, DetectedFace } from "../types";

export type TrackedSpeaker = {
  key: string;
  label: string;
  personId: string | null;
  unknownIndex: number | null;
};

export type LabeledFace = DetectedFace & {
  speaker: TrackedSpeaker;
};

type IdentityTrack = TrackedSpeaker & {
  embedding: number[];
  lastBbox: BoundingBox;
  lastSeenAt: number;
};

const EMBEDDING_MATCH = 0.48;
const IOU_MATCH = 0.28;
const TRACK_TTL_MS = 20_000;

function cosine(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) {
    return 0;
  }
  let dot = 0;
  let left = 0;
  let right = 0;
  for (let i = 0; i < n; i += 1) {
    dot += a[i] * b[i];
    left += a[i] * a[i];
    right += b[i] * b[i];
  }
  const denom = Math.sqrt(left) * Math.sqrt(right);
  return denom === 0 ? 0 : dot / denom;
}

function iou(a: BoundingBox, b: BoundingBox): number {
  const ax2 = a.x + a.width;
  const ay2 = a.y + a.height;
  const bx2 = b.x + b.width;
  const by2 = b.y + b.height;
  const ix1 = Math.max(a.x, b.x);
  const iy1 = Math.max(a.y, b.y);
  const ix2 = Math.min(ax2, bx2);
  const iy2 = Math.min(ay2, by2);
  const inter = Math.max(0, ix2 - ix1) * Math.max(0, iy2 - iy1);
  const union = a.width * a.height + b.width * b.height - inter;
  return union <= 0 ? 0 : inter / union;
}

function personLabel(face: DetectedFace): string {
  if (!face.person) {
    return "Unknown";
  }
  return `${face.person.first_name} ${face.person.last_name}`.trim();
}

export class IdentityTracker {
  private tracks: IdentityTrack[] = [];
  private nextUnknown = 1;

  reset() {
    this.tracks = [];
    this.nextUnknown = 1;
  }

  labelFaces(faces: DetectedFace[], now = Date.now()): LabeledFace[] {
    this.tracks = this.tracks.filter((track) => now - track.lastSeenAt < TRACK_TTL_MS);
    const used = new Set<string>();
    return faces.map((face) => {
      const speaker = this.assign(face, now, used);
      used.add(speaker.key);
      return { ...face, speaker };
    });
  }

  fallbackSpeaker(): TrackedSpeaker {
    const recent = [...this.tracks].sort((a, b) => b.lastSeenAt - a.lastSeenAt)[0];
    if (recent) {
      return { key: recent.key, label: recent.label, personId: recent.personId, unknownIndex: recent.unknownIndex };
    }
    return this.ensureUnknown();
  }

  private ensureUnknown(): TrackedSpeaker {
    const existing = this.tracks.find((track) => track.unknownIndex === 1);
    if (existing) {
      return existing;
    }
    const created = this.createUnknown([], { x: 0, y: 0, width: 0, height: 0 }, Date.now());
    return created;
  }

  private assign(face: DetectedFace, now: number, used: Set<string>): TrackedSpeaker {
    if (face.recognized && face.person) {
      const key = `person:${face.person.id}`;
      const label = personLabel(face);
      let track = this.tracks.find((item) => item.key === key);
      if (!track) {
        track = {
          key,
          label,
          personId: face.person.id,
          unknownIndex: null,
          embedding: face.embedding || [],
          lastBbox: face.bbox,
          lastSeenAt: now,
        };
        this.tracks.push(track);
      } else {
        track.label = label;
        track.lastBbox = face.bbox;
        track.lastSeenAt = now;
        if (face.embedding?.length) {
          track.embedding = face.embedding;
        }
      }
      return track;
    }

    let best: IdentityTrack | null = null;
    let bestScore = 0;
    for (const track of this.tracks) {
      if (used.has(track.key) || track.personId) {
        continue;
      }
      let score = 0;
      if (face.embedding?.length && track.embedding.length) {
        const similarity = cosine(face.embedding, track.embedding);
        if (similarity >= EMBEDDING_MATCH) {
          score = similarity;
        }
      }
      if (score === 0) {
        const overlap = iou(face.bbox, track.lastBbox);
        if (overlap >= IOU_MATCH) {
          score = overlap;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        best = track;
      }
    }

    if (best) {
      best.lastBbox = face.bbox;
      best.lastSeenAt = now;
      if (face.embedding?.length) {
        best.embedding = face.embedding;
      }
      return best;
    }

    return this.createUnknown(face.embedding || [], face.bbox, now);
  }

  private createUnknown(embedding: number[], bbox: BoundingBox, now: number): IdentityTrack {
    const index = this.nextUnknown;
    this.nextUnknown += 1;
    const track: IdentityTrack = {
      key: `unknown:${index}`,
      label: `Unknown ${index}`,
      personId: null,
      unknownIndex: index,
      embedding,
      lastBbox: bbox,
      lastSeenAt: now,
    };
    this.tracks.push(track);
    return track;
  }
}

export function pickSpeaker(faces: LabeledFace[], lastKey: string | null): LabeledFace | null {
  if (faces.length === 1) {
    return faces[0];
  }
  if (faces.length === 0) {
    return null;
  }
  const expressive = faces.filter((face) => face.emotion !== "neutral");
  if (expressive.length === 1) {
    return expressive[0];
  }
  if (lastKey) {
    const previous = faces.find((face) => face.speaker.key === lastKey);
    if (previous) {
      return previous;
    }
  }
  return faces.reduce((best, face) => {
    const bestArea = best.bbox.width * best.bbox.height;
    const area = face.bbox.width * face.bbox.height;
    return area > bestArea ? face : best;
  });
}
