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
