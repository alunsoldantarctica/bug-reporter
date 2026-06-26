# Claude Code Routine: Enrich Linear Bug Reports

Use this routine when a Linear issue was created by the bug reporter and needs
developer-ready context before implementation.

## Inputs

- Linear issue identifier, for example `EXP-1234`
- Repository root
- Optional PostHog replay URL from the issue body
- Optional picked-element selectors and screenshots from Linear comments

## Routine

```md
You are reviewing a Linear bug report created by @alunsoldantarctica/bug-reporter.

Goal:
Add enough codebase context to the Linear issue that a developer or coding agent
can start implementation without re-triaging from scratch.

Steps:
1. Fetch the Linear issue title, body, comments, labels, attachments, and URL.
2. Extract:
   - reported URL/surface
   - selected DOM selectors
   - visible text snippets
   - PostHog replay URL/session id
   - voice transcript, if present
   - screenshots/attachment names
3. Search the codebase for likely owning files:
   - routes/pages matching the reported URL
   - React/Astro components containing matching visible text
   - testids, selectors, labels, and button text
   - analytics/PostHog events related to the flow
4. Identify likely failure boundaries:
   - UI component
   - API route/action
   - backend mutation/action/job
   - analytics/session instrumentation
5. Write a Linear comment with:
   - suspected owning files
   - likely reproduction path
   - missing logs or data needed
   - first implementation hypothesis
   - suggested tests
   - confidence level

Rules:
- Do not claim a root cause unless the code proves it.
- Link concrete files and functions.
- Keep the Linear comment under 500 words.
- If the ticket is too vague, ask for exactly the missing artifact.
```

## Example Linear Comment

```md
Triage context from codebase review:

Likely owning surface:
- `src/pages/quote.astro`
- `src/components/react/QuoteWizard.tsx`
- `src/components/react/quote-wizard/Step3Operator.tsx`

Why:
- Reported surface is `/quote`.
- Picked selector points to the operator card grid.
- Visible text in the report matches the operator selection step.
- The replay link should confirm whether state is lost after date changes.

First hypothesis:
Changing dates resets wizard state and clears the selected operator before submit.
Check state transitions around `setTripDates` and operator persistence.

Suggested tests:
- Unit test for date change preserving selected operator.
- Playwright path: select destination, dates, operator, go back, change dates, submit.

Confidence: medium. Need replay check before implementation.
```
