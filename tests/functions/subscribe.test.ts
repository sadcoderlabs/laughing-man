import { describe, expect, it, mock } from "bun:test";
import { handleSubscribe, onRequestPost } from "../../functions/api/subscribe";

describe("handleSubscribe", () => {
  const mockEnv = {
    RESEND_API_KEY: "re_test_key",
    RESEND_AUDIENCE_ID: "aud_test_id",
  };

  it("returns 400 if email is missing", async () => {
    const res = await handleSubscribe({ email: "" }, mockEnv);
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, string>;
    expect(body.error).toContain("email");
  });

  it("returns 400 if email is invalid", async () => {
    const res = await handleSubscribe({ email: "not-an-email" }, mockEnv);
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, string>;
    expect(body.error).toContain("email");
  });

  it("returns 200 on successful subscribe", async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = mock(async () =>
        new Response(JSON.stringify({ id: "contact_123" }), { status: 200 })
      ) as unknown as typeof fetch;

      const res = await handleSubscribe({ email: "test@example.com" }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.ok).toBe(true);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://api.resend.com/audiences/aud_test_id/contacts",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer re_test_key",
          }),
        })
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("returns 500 if Resend API returns an error", async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = mock(async () =>
        new Response(JSON.stringify({ message: "Invalid API key" }), { status: 403 })
      ) as unknown as typeof fetch;

      const res = await handleSubscribe({ email: "test@example.com" }, mockEnv);
      expect(res.status).toBe(500);
      const body = (await res.json()) as Record<string, string>;
      expect(body.error).toBeDefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("returns 400 if request body is not JSON", async () => {
    const res = await handleSubscribe(null as unknown as { email: string }, mockEnv);
    expect(res.status).toBe(400);
  });
});

describe("onRequestPost", () => {
  function makeContext(body: unknown, env = { RESEND_API_KEY: "re_test", RESEND_AUDIENCE_ID: "aud_test" }) {
    return {
      request: new Request("https://example.com/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      env,
    } as unknown as Parameters<typeof onRequestPost>[0];
  }

  it("returns JSON error when fetch throws a network error", async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = mock(async () => {
        throw new Error("Network failure");
      }) as unknown as typeof fetch;

      const res = await onRequestPost(makeContext({ email: "test@example.com" }));
      expect(res.status).toBe(400);
      const body = (await res.json()) as Record<string, string>;
      expect(body.error).toBeDefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
