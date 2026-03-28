import { describe, expect, it, mock } from "bun:test";
import { handleSubscribe } from "../../functions/api/subscribe";

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
