import { describe, expect, it, mock } from "bun:test";
import { handleSubscribe, onRequestPost } from "../../functions/api/subscribe";

describe("handleSubscribe", () => {
  const mockEnv = {
    RESEND_API_KEY: "re_test_key",
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
      const mockFetch = mock(async (url: string) => {
        if (url === "https://api.resend.com/segments") {
          return new Response(JSON.stringify({ data: [{ id: "seg_1", name: "General" }] }), { status: 200 });
        }
        return new Response(JSON.stringify({ id: "contact_123" }), { status: 200 });
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const res = await handleSubscribe({ email: "test@example.com" }, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.ok).toBe(true);

      // First call: list segments
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.resend.com/segments",
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: "Bearer re_test_key" }),
        })
      );

      // Second call: create contact with segment
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.resend.com/contacts",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ email: "test@example.com", segments: [{ id: "seg_1" }] }),
        })
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("returns 500 if segments API fails", async () => {
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

  it("returns 500 if contacts API fails", async () => {
    const originalFetch = globalThis.fetch;
    try {
      const mockFetch = mock(async (url: string) => {
        if (url === "https://api.resend.com/segments") {
          return new Response(JSON.stringify({ data: [{ id: "seg_1" }] }), { status: 200 });
        }
        return new Response(JSON.stringify({ message: "Bad request" }), { status: 400 });
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;

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
  function makeContext(body: unknown, env = { RESEND_API_KEY: "re_test" }) {
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
