export type BugReportSeverity = "low" | "medium" | "high";
export type BugReportSource = "admin" | "site";

export interface BugReportFile {
  blob: Blob;
  kind: "audio" | "image";
  contentType: string;
  label?: string;
}

export interface CapturedElement {
  selector: string;
  text: string;
  html: string;
  rect: { x: number; y: number; w: number; h: number };
  viewport: { w: number; h: number };
  screenshot?: BugReportFile;
}

export interface BugReportPayload {
  source: BugReportSource;
  surface: string;
  url?: string;
  message: string;
  severity: BugReportSeverity;
  userAgent?: string;
  replaySessionId?: string;
  recordingStartedAt?: number;
  recordingDurationMs?: number;
  files?: BugReportFile[];
  capturedElements?: CapturedElement[];
}

export interface BugReportResult {
  id?: string;
  issueUrl?: string | null;
  issueIdentifier?: string | null;
  error?: string;
}

export interface BugReportAdapter {
  submit(payload: BugReportPayload): Promise<BugReportResult>;
}

export interface PostHogLike {
  startSessionRecording?: (opts?: Record<string, unknown>) => void;
  stopSessionRecording?: () => void;
  sessionRecordingStarted?: () => boolean;
  capture?: (event: string, props?: Record<string, unknown>) => void;
  get_session_id?: () => string | undefined;
}

export function pickAudioMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const candidate of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]) {
    try {
      if (MediaRecorder.isTypeSupported(candidate)) return candidate;
    } catch {
      // Ignore browser-specific MIME probing failures.
    }
  }
  return undefined;
}

export function createHttpBugReportAdapter(endpoint = "/api/bug-report"): BugReportAdapter {
  return {
    async submit(payload) {
      const files = collectFiles(payload);
      const body =
        files.length > 0
          ? multipartBody(payload, files)
          : JSON.stringify(payload);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: files.length > 0 ? undefined : { "content-type": "application/json" },
        body,
      });
      const json = (await res.json().catch(() => ({}))) as BugReportResult;
      if (!res.ok) {
        return {
          error: json.error ?? `Bug report failed with HTTP ${res.status}`,
          issueUrl: null,
          issueIdentifier: null,
        };
      }
      return json;
    },
  };
}

function collectFiles(payload: BugReportPayload): BugReportFile[] {
  const files = [...(payload.files ?? [])];
  for (const el of payload.capturedElements ?? []) {
    if (el.screenshot) files.push(el.screenshot);
  }
  return files;
}

function multipartBody(payload: BugReportPayload, files: BugReportFile[]): FormData {
  const form = new FormData();
  const withoutBlobs: BugReportPayload = {
    ...payload,
    files: undefined,
    capturedElements: payload.capturedElements?.map((el) => ({ ...el, screenshot: undefined })),
  };
  form.append("payload", JSON.stringify(withoutBlobs));
  files.forEach((file, index) => {
    form.append(
      "files",
      file.blob,
      file.label ?? `bug-report-${index}.${file.contentType.includes("audio") ? "wav" : "png"}`,
    );
    form.append("fileKinds", file.kind);
  });
  return form;
}

export function formatRecordingTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export async function blobToWav(blob: Blob): Promise<Blob | null> {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const tmp = new AudioCtx();
    const decoded = await tmp.decodeAudioData(await blob.arrayBuffer());
    void tmp.close();

    const rate = 16000;
    const offline = new OfflineAudioContext(
      1,
      Math.max(1, Math.ceil(decoded.duration * rate)),
      rate,
    );
    const src = offline.createBufferSource();
    src.buffer = decoded;
    src.connect(offline.destination);
    src.start();
    const rendered = await offline.startRendering();
    return pcmToWav(rendered);
  } catch {
    return null;
  }
}

function pcmToWav(buffer: AudioBuffer): Blob {
  const samples = buffer.getChannelData(0);
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const out = new ArrayBuffer(44 + dataSize);
  const view = new DataView(out);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 8 * bytesPerSample, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }

  return new Blob([out], { type: "audio/wav" });
}

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}

export {
  createAstroCloudflareBugReportHandler,
  type AstroCloudflareBugReportEnv,
  type AstroCloudflareBugReportOptions,
} from "./adapters/astro-cloudflare";
