# Agent Install Instructions

Use this file when an AI coding agent is asked to install or adapt
`@alunsoldgroup/bug-reporter`.

## Goal

Integrate a staff/QA bug reporter that creates developer-ready tickets with page
context, selected UI elements, optional screenshots, optional voice, optional
PostHog replay links, and optional Linear filing.

## Install

```sh
npm install @alunsoldgroup/bug-reporter
```

If the repo uses pnpm:

```sh
pnpm add @alunsoldgroup/bug-reporter
```

## Required Decisions

Before coding, identify:

- frontend framework
- server runtime
- auth mechanism for staff/admin users
- issue tracker target
- whether PostHog replay is available
- whether voice recording is allowed
- where secrets live

If the stack is Astro on Cloudflare Workers, prefer the provided adapter.

## Astro on Cloudflare Workers

Create `src/pages/api/bug-report.ts`:

```ts
import type { APIRoute } from "astro";
import { createAstroCloudflareBugReportHandler } from "@alunsoldgroup/bug-reporter";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const handle = createAstroCloudflareBugReportHandler({
    env: locals.runtime.env,
    requireAuth: (req) => Boolean(req.headers.get("cookie")?.includes("staff_session=")),
  });

  return handle(request);
};
```

Replace `requireAuth` with the host app's real staff/admin auth check.

## Cloudflare Secrets

Minimum:

```txt
LINEAR_API_TOKEN
```

Optional:

```txt
LINEAR_TEAM_KEY=ENG
LINEAR_LABELS=bug,reported-from-app
POSTHOG_PROJECT_ID=12345
POSTHOG_HOST=https://us.posthog.com
AI_GATEWAY_URL=https://gateway.ai.cloudflare.com/v1/<account>/<gateway>
AI_GATEWAY_TOKEN=<cloudflare-ai-gateway-token>
```

## Client Submitter

```ts
import { createHttpBugReportAdapter } from "@alunsoldgroup/bug-reporter";

const adapter = createHttpBugReportAdapter("/api/bug-report");

await adapter.submit({
  source: "site",
  surface: window.location.pathname,
  url: window.location.href,
  message,
  severity: "medium",
  userAgent: navigator.userAgent,
  replaySessionId: window.posthog?.get_session_id?.(),
});
```

## Visibility Rules

Recommended:

- render the launcher only for staff/admin users
- avoid loading the reporter bundle for anonymous public traffic
- server-side auth remains mandatory even if UI is hidden

## Privacy Rules

- Do not expose `LINEAR_API_TOKEN`, `AI_GATEWAY_TOKEN`, or PostHog personal API keys in browser code.
- Make voice recording opt-in.
- Redact sensitive DOM text before sending if the page may contain PII.
- Treat replay links as internal-only.

## Ticket Enrichment

After Linear issue creation, use:

`examples/claude-code/linear-bug-context-routine.md`

The routine should read the Linear issue, search the codebase for matching
routes/selectors/text/testids, and post likely owning files, reproduction path,
first hypothesis, and suggested tests.

## Verification

Run:

```sh
npm run build
```

Then manually verify:

1. anonymous users cannot see or call the reporter
2. staff users can open the reporter
3. selected element metadata reaches the server
4. Linear issue is created
5. optional replay link is correct
6. optional voice upload/transcription degrades safely
