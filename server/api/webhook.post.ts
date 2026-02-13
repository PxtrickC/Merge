import { createHmac } from "crypto";

export default defineEventHandler(async (event) => {
  const signingKey = process.env.ALCHEMY_WEBHOOK_SIGNING_KEY;
  const githubPat = process.env.GITHUB_PAT;

  if (!signingKey || !githubPat) {
    throw createError({ statusCode: 500, statusMessage: "Missing environment variables" });
  }

  // Read raw body for signature verification
  const rawBody = await readRawBody(event);
  if (!rawBody) {
    throw createError({ statusCode: 400, statusMessage: "Empty body" });
  }

  // Verify Alchemy signature
  const signature = getHeader(event, "x-alchemy-signature");
  if (!signature) {
    throw createError({ statusCode: 401, statusMessage: "Missing signature" });
  }

  const expectedSig = createHmac("sha256", signingKey).update(rawBody).digest("hex");
  if (signature !== expectedSig) {
    throw createError({ statusCode: 401, statusMessage: "Invalid signature" });
  }

  // Trigger GitHub Actions via repository_dispatch
  const res = await fetch(
    "https://api.github.com/repos/PxtrickC/Merge/dispatches",
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${githubPat}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        event_type: "merge-event",
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    console.error("GitHub dispatch failed:", res.status, text);
    throw createError({ statusCode: 502, statusMessage: "GitHub dispatch failed" });
  }

  return { ok: true };
});
