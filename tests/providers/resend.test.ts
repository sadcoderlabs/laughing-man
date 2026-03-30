import { describe, expect, it, mock } from "bun:test";
import { createResendProvider } from "../../src/providers/resend";

describe("createResendProvider", () => {
  it("calls resend.broadcasts.list and returns broadcast data", async () => {
    const mockList = mock(async () => ({
      data: { data: [{ id: "b1", name: "Issue #1", status: "sent" }] },
      error: null,
    }));

    const fakeResend = { broadcasts: { list: mockList } } as any;
    const provider = createResendProvider(fakeResend);

    const broadcasts = await provider.listBroadcasts();
    expect(mockList).toHaveBeenCalledTimes(1);
    expect(broadcasts).toHaveLength(1);
    expect(broadcasts[0].name).toBe("Issue #1");
  });

  it("throws if resend.broadcasts.list returns an error", async () => {
    const mockList = mock(async () => ({
      data: null,
      error: { message: "Unauthorized" },
    }));

    const fakeResend = { broadcasts: { list: mockList } } as any;
    const provider = createResendProvider(fakeResend);

    await expect(provider.listBroadcasts()).rejects.toThrow("Unauthorized");
  });

  it("calls resend.segments.list and returns segment data", async () => {
    const mockList = mock(async () => ({
      data: { data: [{ id: "seg_1", name: "General", created_at: "2026-01-01" }] },
      error: null,
    }));

    const fakeResend = { segments: { list: mockList } } as any;
    const provider = createResendProvider(fakeResend);

    const segments = await provider.listSegments();
    expect(mockList).toHaveBeenCalledTimes(1);
    expect(segments).toHaveLength(1);
    expect(segments[0].id).toBe("seg_1");
    expect(segments[0].name).toBe("General");
  });

  it("throws if resend.segments.list returns an error", async () => {
    const mockList = mock(async () => ({
      data: null,
      error: { message: "Unauthorized" },
    }));

    const fakeResend = { segments: { list: mockList } } as any;
    const provider = createResendProvider(fakeResend);

    await expect(provider.listSegments()).rejects.toThrow("Unauthorized");
  });

  it("calls resend.broadcasts.create with correct params", async () => {
    const mockCreate = mock(async () => ({
      data: { id: "b-new" },
      error: null,
    }));

    const fakeResend = { broadcasts: { create: mockCreate } } as any;
    const provider = createResendProvider(fakeResend);

    const id = await provider.createBroadcast({
      segmentId: "seg_123",
      from: "Test <test@example.com>",
      subject: "Issue #1: My First Issue",
      html: "<h1>Hello</h1>",
      name: "Issue #1",
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        segmentId: "seg_123",
        from: "Test <test@example.com>",
        subject: "Issue #1: My First Issue",
        html: "<h1>Hello</h1>",
        name: "Issue #1",
      })
    );
    expect(id).toBe("b-new");
  });

  it("calls resend.broadcasts.send with broadcast id", async () => {
    const mockSend = mock(async () => ({
      data: { id: "b-sent" },
      error: null,
    }));

    const fakeResend = { broadcasts: { send: mockSend } } as any;
    const provider = createResendProvider(fakeResend);

    await provider.sendBroadcast("b-new");

    expect(mockSend).toHaveBeenCalledWith("b-new");
  });

  it("calls resend.emails.send with correct params", async () => {
    const mockSend = mock(async () => ({
      data: { id: "email-123" },
      error: null,
    }));

    const fakeResend = { emails: { send: mockSend } } as any;
    const provider = createResendProvider(fakeResend);

    const id = await provider.sendEmail({
      to: "user@example.com",
      from: "Test <test@example.com>",
      replyTo: "reply@example.com",
      subject: "Test Issue #1",
      html: "<h1>Hello</h1>",
    });

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith({
      to: "user@example.com",
      from: "Test <test@example.com>",
      replyTo: "reply@example.com",
      subject: "Test Issue #1",
      html: "<h1>Hello</h1>",
    });
    expect(id).toBe("email-123");
  });

  it("throws if resend.emails.send returns an error", async () => {
    const mockSend = mock(async () => ({
      data: null,
      error: { message: "Invalid email" },
    }));

    const fakeResend = { emails: { send: mockSend } } as any;
    const provider = createResendProvider(fakeResend);

    await expect(
      provider.sendEmail({
        to: "bad",
        from: "Test <test@example.com>",
        subject: "Test",
        html: "<p>hi</p>",
      })
    ).rejects.toThrow("Invalid email");
  });
});
