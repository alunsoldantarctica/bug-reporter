import type { BugReportPayload } from "../index";
export interface AstroCloudflareBugReportEnv {
    LINEAR_API_TOKEN?: string;
    LINEAR_TEAM_KEY?: string;
    LINEAR_LABELS?: string;
    POSTHOG_PROJECT_ID?: string;
    POSTHOG_HOST?: string;
    AI_GATEWAY_URL?: string;
    AI_GATEWAY_TOKEN?: string;
}
export interface AstroCloudflareBugReportOptions {
    env: AstroCloudflareBugReportEnv;
    requireAuth?: (request: Request) => Promise<boolean> | boolean;
    redact?: (payload: BugReportPayload) => BugReportPayload;
}
export declare function createAstroCloudflareBugReportHandler(options: AstroCloudflareBugReportOptions): (request: Request) => Promise<Response>;
