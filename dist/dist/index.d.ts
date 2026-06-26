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
    rect: {
        x: number;
        y: number;
        w: number;
        h: number;
    };
    viewport: {
        w: number;
        h: number;
    };
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
export declare function pickAudioMime(): string | undefined;
export declare function createHttpBugReportAdapter(endpoint?: string): BugReportAdapter;
export declare function formatRecordingTime(seconds: number): string;
export declare function blobToWav(blob: Blob): Promise<Blob | null>;
export { createAstroCloudflareBugReportHandler, type AstroCloudflareBugReportEnv, type AstroCloudflareBugReportOptions, } from "./adapters/astro-cloudflare";
