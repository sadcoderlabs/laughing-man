/// <reference types="@cloudflare/workers-types" />

interface Env {
  RESEND_API_KEY: string;
}

interface SubscribeBody {
  email?: string;
}

type SubscribeResult = "subscribed" | "already_subscribed" | "resubscribed";

interface ContactRecord {
  id: string;
  email: string;
  unsubscribed?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function resendHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}` };
}

async function getContactByEmail(email: string, apiKey: string): Promise<ContactRecord | null> {
  const res = await fetch(`https://api.resend.com/contacts/${encodeURIComponent(email)}`, {
    headers: resendHeaders(apiKey),
  });

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to retrieve contact (${res.status}): ${body}`);
  }

  return (await res.json()) as ContactRecord;
}

async function getDefaultSegmentId(apiKey: string): Promise<string | undefined> {
  const segRes = await fetch("https://api.resend.com/segments", {
    headers: resendHeaders(apiKey),
  });

  if (!segRes.ok) {
    const segBody = await segRes.text();
    throw new Error(`Failed to list segments (${segRes.status}): ${segBody}`);
  }

  const segData = (await segRes.json()) as { data?: { id: string }[] };
  return segData.data?.[0]?.id;
}

function successResponse(result: SubscribeResult): Response {
  return Response.json({ ok: true, result });
}

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

  try {
    const existing = await getContactByEmail(email, env.RESEND_API_KEY);

    if (existing && existing.unsubscribed === false) {
      console.log("[subscribe] already subscribed", { email, contactId: existing.id });
      return successResponse("already_subscribed");
    }

    if (existing && existing.unsubscribed !== false) {
      const res = await fetch(
        `https://api.resend.com/contacts/${encodeURIComponent(email)}`,
        {
          method: "PATCH",
          headers: {
            ...resendHeaders(env.RESEND_API_KEY),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ unsubscribed: false }),
        }
      );

      if (!res.ok) {
        const resBody = await res.text();
        console.error("[subscribe] failed to re-subscribe contact", {
          status: res.status,
          body: resBody,
          email,
        });
        return Response.json(
          { error: "Failed to subscribe. Please try again." },
          { status: 500 }
        );
      }

      console.log("[subscribe] re-subscribed", { email, contactId: existing.id });
      return successResponse("resubscribed");
    }

    const segmentId = await getDefaultSegmentId(env.RESEND_API_KEY);
    const contactBody: Record<string, unknown> = { email, unsubscribed: false };
    if (segmentId) {
      contactBody.segments = [{ id: segmentId }];
    }

    const res = await fetch(
      "https://api.resend.com/contacts",
      {
        method: "POST",
        headers: {
          ...resendHeaders(env.RESEND_API_KEY),
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
    return successResponse("subscribed");
  } catch (err) {
    console.error("[subscribe] unexpected error", err);
    return Response.json(
      { error: "Failed to subscribe. Please try again." },
      { status: 500 }
    );
  }
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
