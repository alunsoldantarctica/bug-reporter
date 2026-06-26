# @alunsoldgroup/bug-reporter

[![npm version](https://img.shields.io/npm/v/@alunsoldgroup/bug-reporter?logo=npm&color=cb3837)](https://www.npmjs.com/package/@alunsoldgroup/bug-reporter)
[![npm downloads](https://img.shields.io/npm/dm/@alunsoldgroup/bug-reporter?logo=npm&color=cb3837)](https://www.npmjs.com/package/@alunsoldgroup/bug-reporter)
[![GitHub stars](https://img.shields.io/github/stars/alunsoldantarctica/bug-reporter?logo=github)](https://github.com/alunsoldantarctica/bug-reporter/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/alunsoldantarctica/bug-reporter?logo=github)](https://github.com/alunsoldantarctica/bug-reporter/network/members)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![TypeScript](https://img.shields.io/badge/TypeScript-ready-3178c6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-peer-61dafb?logo=react&logoColor=111827)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare%20Workers-adapter-f38020?logo=cloudflare&logoColor=white)

Bug reporting UI and adapters that turn vague product feedback into
developer-ready tickets.

Use it when you want staff, QA, or trusted beta users to report bugs with useful
developer context: the page URL, selected UI elements, optional screenshots,
optional voice narration, and optional PostHog replay links.

Most in-app bug reporters stop at a text box. This package captures the context
developers actually need: the page, the selected UI element, browser details,
screenshots, optional voice narration, and optional replay links. The server
adapter turns that into a Linear issue that is ready for triage, automation, or
direct implementation.

The package is adapter-first. You can use the provided Astro on Cloudflare
Workers adapter, or plug the browser payload into your own backend, issue
tracker, storage, and auth stack.

## Why Integrate It

- **Fewer low-signal tickets**: every report can include URL, selector, visible
  text, viewport, user agent, screenshots, replay id, and voice transcript.
- **Works with your stack**: browser collection is separate from server filing.
  Bring your own auth, database, storage, queue, issue tracker, and redaction.
- **Safe secret boundary**: Linear, PostHog, and AI Gateway credentials stay on
  your server. Static demos can use mock submitters.
- **Agent-ready output**: tickets include structured context that a developer,
  Claude Code routine, or coding agent can map back to owning files.
- **Optional integrations**: voice, PostHog, and transcription degrade
  independently. Text-only reporting still works.
- **Small surface area**: core package exports typed payloads, browser helpers,
  an HTTP adapter, and an Astro/Cloudflare route helper.

## Integration Model

```txt
Browser reporter
  -> captures page + element + optional files + optional replay id
  -> POST /api/bug-report
  -> your server checks auth and redacts
  -> Linear issue + attachments + optional transcript
  -> optional Claude Code enrichment comment
```

## Demo

Try the static GitHub Pages demo:

https://alunsoldantarctica.github.io/bug-reporter/

The demo uses a mock submitter. It is safe to run on GitHub Pages because it does
not contain Linear, PostHog, or AI Gateway credentials.

## AI Agent Docs

For LLM crawlers and coding agents:

- [`llms.txt`](./llms.txt) — compact package summary and integration guidance
- [`AGENTS.md`](./AGENTS.md) — step-by-step agent install instructions

## What It Supports

- Floating bug reporter for public pages
- Header/admin report button flows
- Visual element picking
- Optional screenshot and element metadata capture
- Optional microphone narration
- WAV conversion for broader browser/tool compatibility
- Optional PostHog session replay links
- Linear issue creation through a server adapter
- Astro + Cloudflare Workers route helper
- Claude Code routine example for enriching tickets with codebase context

## What Your Team Gets

Instead of this:

```txt
"Checkout is weird on mobile"
```

You get this:

```txt
Title: [site] /checkout: Submit button disabled after changing dates
URL: https://app.example.com/checkout
Selector: button[data-testid="checkout-submit"]
Visible text: Complete booking
Viewport: 390x844
Replay: https://us.posthog.com/project/123/replay/...
Transcript: "I changed the departure date, then the button stayed disabled."
Attachments: element screenshot, optional voice clip
```

That is enough for an engineer or agent to search the codebase, identify likely
owning components, reproduce the flow, and propose tests.

## Feature Walkthrough

The GIFs use a fictional expedition-insurance site so behavior is clear without
depending on any production app.

### Floating Reporter

![Floating reporter flow](./docs/assets/floating-reporter.gif)

### Element Picker

![Element picker flow](./docs/assets/element-picker.gif)

### Optional Integrations

![Integration setup flow](./docs/assets/integrations.gif)

## Install

```sh
npm install @alunsoldgroup/bug-reporter
```

Peer dependencies:

```sh
npm install react react-dom
```

## Quick Start

Send reports to your own server endpoint:

```ts
import { createHttpBugReportAdapter } from "@alunsoldgroup/bug-reporter";

const bugReporter = createHttpBugReportAdapter("/api/bug-report");

await bugReporter.submit({
  source: "site",
  surface: window.location.pathname,
  url: window.location.href,
  message: "The quote button is disabled after changing dates.",
  severity: "medium",
  userAgent: navigator.userAgent,
  replaySessionId: window.posthog?.get_session_id?.(),
});
```

When files are present, the HTTP adapter sends `multipart/form-data`.
Otherwise it sends JSON.

## Astro on Cloudflare Workers

Create an API route:

```ts
// src/pages/api/bug-report.ts
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

Full example:

`examples/astro-cloudflare/src/pages/api/bug-report.ts`

## Cloudflare Bindings

Required for Linear filing:

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

`AI_GATEWAY_URL` and `AI_GATEWAY_TOKEN` enable best-effort audio transcription
through Groq Whisper via Cloudflare AI Gateway. Provider keys stay server-side.

## Public Demo vs Production

GitHub Pages can host the floating-button demo because it is static browser
code. It cannot safely create real Linear tickets or transcribe audio because
those require secrets.

Recommended split:

- GitHub Pages: static demo, mock submitter
- Production app: authenticated UI
- Cloudflare Worker/Astro route: Linear, PostHog, AI Gateway, redaction, auth

## Suggested Bug Workflow

1. Render the reporter only for trusted users.
2. Reporter selects the broken UI element.
3. Reporter adds text, severity, optional voice, optional replay.
4. Server creates the Linear issue and attaches screenshots/audio.
5. Automation enriches the ticket with codebase context.

The value is in the metadata. A vague report like "button broken" becomes:

```txt
URL: /quote
Selector: .operator-card[data-slug="quark"]
Visible text: Quark Expeditions
Viewport: 390x844
PostHog replay: https://...
Voice transcript: "I changed dates and the operator disappeared."
```

## Claude Code Ticket Enrichment

This repo includes an example routine:

`examples/claude-code/linear-bug-context-routine.md`

The intended automation:

1. Linear webhook fires for new bug-reporter tickets.
2. A Worker, CI job, or local script starts Claude Code in your repo.
3. The routine reads the Linear issue, comments, screenshots, transcript, and
   replay URL.
4. It searches for matching routes, visible text, selectors, test ids, and
   analytics events.
5. It posts a concise Linear comment with likely owning files, reproduction
   path, first hypothesis, confidence, and suggested tests.

Example enrichment:

```md
Likely owning surface:
- `src/pages/quote.astro`
- `src/components/QuoteWizard.tsx`
- `src/components/quote-wizard/Step3Operator.tsx`

Why:
- Reported URL is `/quote`.
- Picked selector points to the operator card grid.
- Visible text matches the operator selection step.
- Replay should confirm whether state resets after date changes.

First hypothesis:
Changing dates resets wizard state and clears selected operator before submit.

Suggested tests:
- Unit test for date changes preserving selected operator.
- Playwright path covering destination, dates, operator, back, date edit, submit.

Confidence: medium. Need replay check before implementation.
```

## Security Model

Do not expose ticketing, analytics, or transcription keys to the browser.

Recommended production rules:

- Gate the reporting route with staff/admin auth.
- Redact sensitive fields before ticket creation.
- Store `LINEAR_API_TOKEN` and `AI_GATEWAY_TOKEN` in platform secrets.
- Treat PostHog replay links as internal-only.
- Make microphone recording opt-in.
- Disclose recording and retention behavior in your UI.

The package handles plumbing. Your app remains responsible for consent,
authorization, retention, and PII handling.

## Public API

```ts
createHttpBugReportAdapter(endpoint?: string)
createAstroCloudflareBugReportHandler(options)
pickAudioMime()
blobToWav(blob)
formatRecordingTime(seconds)
```

Core types:

```ts
BugReportPayload
BugReportResult
BugReportAdapter
BugReportFile
CapturedElement
PostHogLike
```

## Publish

```sh
pnpm run build
npm publish --access public
```
