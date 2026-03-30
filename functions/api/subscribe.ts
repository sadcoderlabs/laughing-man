/// <reference types="@cloudflare/workers-types" />

interface Env {
  RESEND_API_KEY: string;
}

interface SubscribeBody {
  email?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function handleSubscribe(
  body: SubscribeBody | null,
  env: Env
): Promise<Response> {
  console.log("[subscribe] request received", { email: body?.email });

  if (!body || !body.email || typeof body.email !== "string") {
    console.error("[subscribe] invalid body");
    return Response.json({ error: "A valid email is required." }, { status: 400 });
  }

  const email = body.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    console.error("[subscribe] invalid email format", { email });
    return Response.json({ error: "A valid email is required." }, { status: 400 });
  }

  console.log("[subscribe] calling Resend API", {
    hasApiKey: !!env.RESEND_API_KEY,
  });

  // Discover the first segment so the contact is included in broadcasts
  const segRes = await fetch("https://api.resend.com/segments", {
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` },
  });

  if (!segRes.ok) {
    const segBody = await segRes.text();
    console.error("[subscribe] failed to list segments", { status: segRes.status, body: segBody });
    return Response.json(
      { error: "Failed to subscribe. Please try again." },
      { status: 500 }
    );
  }

  const segData = (await segRes.json()) as { data?: { id: string }[] };
  const segmentId = segData.data?.[0]?.id;

  // Create contact, attaching to segment if one exists
  const contactBody: Record<string, unknown> = { email };
  if (segmentId) {
    contactBody.segments = [{ id: segmentId }];
  }

  const res = await fetch(
    "https://api.resend.com/contacts",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(contactBody),
    }
  );

  if (!res.ok) {
    const resBody = await res.text();
    console.error("[subscribe] Resend API error", { status: res.status, body: resBody });
    return Response.json(
      { error: "Failed to subscribe. Please try again." },
      { status: 500 }
    );
  }

  console.log("[subscribe] success", { email });
  return Response.json({ ok: true });
}

// Pages Function entry point
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = (await context.request.json()) as SubscribeBody;
    return await handleSubscribe(body, context.env);
  } catch (err) {
    console.error("[subscribe] unexpected error", err);
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
};
