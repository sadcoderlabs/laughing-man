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

  it("calls resend.broadcasts.create with correct params", async () => {
    const mockCreate = mock(async () => ({
      data: { id: "b-new" },
      error: null,
    }));

    const fakeResend = { broadcasts: { create: mockCreate } } as any;
    const provider = createResendProvider(fakeResend);

    const id = await provider.createBroadcast({
      audienceId: "aud_123",
      from: "Test <test@example.com>",
      subject: "Issue #1: My First Issue",
      html: "<h1>Hello</h1>",
      name: "Issue #1",
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        audienceId: "aud_123",
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
});
