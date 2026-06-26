import type {
  BugReportPayload,
  BugReportResult,
  BugReportSeverity,
} from "../index";

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

export function createAstroCloudflareBugReportHandler(options: AstroCloudflareBugReportOptions) {
  return async function handleBugReport(request: Request): Promise<Response> {
    if (options.requireAuth) {
      const ok = await options.requireAuth(request);
      if (!ok) return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { payload, files } = await readPayload(request);
    if (!payload || typeof payload.message !== "string" || payload.message.trim().length === 0) {
      return Response.json({ error: "Message is required" }, { status: 400 });
    }

    const clean = options.redact ? options.redact(payload) : payload;
    const issue = await fileLinearIssue(options.env, clean);
    if (issue && files.length > 0) {
      await attachFiles(options.env, issue.id, files);
    }
    return Response.json({
      issueUrl: issue?.url ?? null,
      issueIdentifier: issue?.identifier ?? null,
      error: issue ? undefined : "Linear is not configured",
    } satisfies BugReportResult);
  };
}

async function readPayload(request: Request): Promise<{
  payload: BugReportPayload | null;
  files: Array<{ file: File; kind: "audio" | "image" }>;
}> {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const raw = form.get("payload");
    const payload = typeof raw === "string" ? JSON.parse(raw) as BugReportPayload : null;
    const kinds = form.getAll("fileKinds").map((v) => String(v));
    const files: Array<{ file: File; kind: "audio" | "image" }> = form.getAll("files").flatMap((value, index) => {
      if (!(value instanceof File)) return [];
      const kind: "audio" | "image" = kinds[index] === "audio" ? "audio" : "image";
      return [{ file: value, kind }];
    });
    return { payload, files };
  }

  return {
    payload: await request.json().catch(() => null) as BugReportPayload | null,
    files: [],
  };
}

async function fileLinearIssue(
  env: AstroCloudflareBugReportEnv,
  payload: BugReportPayload,
): Promise<{ id: string; url: string; identifier: string } | null> {
  if (!env.LINEAR_API_TOKEN) return null;
  const teamKey = env.LINEAR_TEAM_KEY || "EXP";
  const teamData = await linearQuery<{ teams: { nodes: Array<{ id: string }> } }>(
    env.LINEAR_API_TOKEN,
    `query($key: String!) { teams(filter: { key: { eq: $key } }) { nodes { id } } }`,
    { key: teamKey },
  );
  const teamId = teamData.teams.nodes[0]?.id;
  if (!teamId) throw new Error(`Linear team ${teamKey} not found`);

  const labelIds = await resolveLabels(env);
  const created = await linearQuery<{
    issueCreate: {
      success: boolean;
      issue: { id: string; url: string; identifier: string } | null;
    };
  }>(
    env.LINEAR_API_TOKEN,
    `mutation($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue { id url identifier }
      }
    }`,
    {
      input: {
        teamId,
        title: titleFor(payload),
        description: descriptionFor(env, payload),
        priority: priorityFor(payload.severity),
        labelIds,
      },
    },
  );
  return created.issueCreate.issue;
}

async function resolveLabels(env: AstroCloudflareBugReportEnv): Promise<string[] | undefined> {
  if (!env.LINEAR_API_TOKEN) return undefined;
  const labels = (env.LINEAR_LABELS || "bug")
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean);
  if (labels.length === 0) return undefined;

  const ids: string[] = [];
  for (const label of labels) {
    const data = await linearQuery<{ issueLabels: { nodes: Array<{ id: string }> } }>(
      env.LINEAR_API_TOKEN,
      `query($name: String!) {
        issueLabels(filter: { name: { eqIgnoreCase: $name } }) { nodes { id } }
      }`,
      { name: label },
    ).catch(() => null);
    const id = data?.issueLabels.nodes[0]?.id;
    if (id) ids.push(id);
  }
  return ids.length > 0 ? ids : undefined;
}

async function attachFiles(
  env: AstroCloudflareBugReportEnv,
  issueId: string,
  files: Array<{ file: File; kind: "audio" | "image" }>,
): Promise<void> {
  if (!env.LINEAR_API_TOKEN) return;
  for (const { file, kind } of files) {
    const assetUrl = await uploadLinearFile(env.LINEAR_API_TOKEN, file, kind);
    const transcript = kind === "audio" ? await transcribeAudio(env, file) : undefined;
    const body =
      kind === "audio"
        ? `Voice narration: [listen](${assetUrl})${transcript ? `\n\n> ${transcript.replace(/\n/g, "\n> ")}` : ""}`
        : `Screenshot\n\n![screenshot](${assetUrl})`;
    await linearQuery(
      env.LINEAR_API_TOKEN,
      `mutation($input: CommentCreateInput!) { commentCreate(input: $input) { success } }`,
      { input: { issueId, body } },
    );
  }
}

async function uploadLinearFile(
  token: string,
  file: File,
  kind: "audio" | "image",
): Promise<string> {
  const contentType = file.type || (kind === "audio" ? "audio/wav" : "image/png");
  const upload = await linearQuery<{
    fileUpload: {
      success: boolean;
      uploadFile: {
        uploadUrl: string;
        assetUrl: string;
        headers: Array<{ key: string; value: string }>;
      } | null;
    };
  }>(
    token,
    `mutation($contentType: String!, $filename: String!, $size: Int!) {
      fileUpload(contentType: $contentType, filename: $filename, size: $size) {
        success
        uploadFile { uploadUrl assetUrl headers { key value } }
      }
    }`,
    { contentType, filename: file.name, size: file.size },
  );
  const target = upload.fileUpload.uploadFile;
  if (!upload.fileUpload.success || !target) throw new Error("Linear fileUpload failed");

  const headers: Record<string, string> = { "content-type": contentType };
  for (const h of target.headers) headers[h.key] = h.value;
  const put = await fetch(target.uploadUrl, {
    method: "PUT",
    headers,
    body: await file.arrayBuffer(),
  });
  if (!put.ok) throw new Error(`Linear asset upload failed: ${put.status}`);
  return target.assetUrl;
}

async function transcribeAudio(
  env: AstroCloudflareBugReportEnv,
  file: File,
): Promise<string | undefined> {
  if (!env.AI_GATEWAY_URL || !env.AI_GATEWAY_TOKEN) return undefined;
  try {
    const base = env.AI_GATEWAY_URL.replace(/\/$/, "");
    const form = new FormData();
    form.append("file", file, file.name || "narration.wav");
    form.append("model", "whisper-large-v3-turbo");
    form.append("response_format", "text");
    const res = await fetch(`${base}/groq/audio/transcriptions`, {
      method: "POST",
      headers: { "cf-aig-authorization": `Bearer ${env.AI_GATEWAY_TOKEN}` },
      body: form,
    });
    if (!res.ok) return undefined;
    const text = (await res.text()).trim();
    return text || undefined;
  } catch {
    return undefined;
  }
}

async function linearQuery<T>(token: string, query: string, variables?: unknown): Promise<T> {
  const res = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: token },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join("; "));
  if (!json.data) throw new Error("Linear: empty response");
  return json.data;
}

function titleFor(payload: BugReportPayload): string {
  const surface = payload.surface || "unknown surface";
  return `[${payload.source}] ${surface}: ${payload.message.trim().slice(0, 72)}`;
}

function descriptionFor(env: AstroCloudflareBugReportEnv, payload: BugReportPayload): string {
  const lines = [
    payload.message.trim(),
    "",
    `Severity: ${payload.severity}`,
    `Source: ${payload.source}`,
    `Surface: ${payload.surface}`,
  ];
  if (payload.url) lines.push(`URL: ${payload.url}`);
  if (payload.userAgent) lines.push(`User agent: ${payload.userAgent}`);
  if (payload.replaySessionId) {
    lines.push(`PostHog session: ${posthogSessionUrl(env, payload.replaySessionId)}`);
  }
  if (payload.recordingDurationMs) {
    lines.push(`Recording duration: ${Math.round(payload.recordingDurationMs / 1000)}s`);
  }
  if (payload.capturedElements?.length) {
    lines.push("", "Picked elements:");
    payload.capturedElements.forEach((el, index) => {
      lines.push(`${index + 1}. ${el.selector}`);
      if (el.text) lines.push(`   Text: ${el.text.slice(0, 240)}`);
    });
  }
  return lines.join("\n");
}

function posthogSessionUrl(env: AstroCloudflareBugReportEnv, sessionId: string): string {
  const host = (env.POSTHOG_HOST || "https://us.posthog.com").replace(/\/$/, "");
  if (!env.POSTHOG_PROJECT_ID) return sessionId;
  return `${host}/project/${env.POSTHOG_PROJECT_ID}/replay/${sessionId}`;
}

function priorityFor(severity: BugReportSeverity): number {
  if (severity === "high") return 2;
  if (severity === "medium") return 3;
  return 4;
}
