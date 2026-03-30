import { describe, expect, it, mock } from "bun:test";
import {
  extractApexDomain,
  discoverAccountId,
  ensureProject,
  ensureDomain,
  ensureDnsRecord,
} from "../../src/pipeline/cloudflare";
import Cloudflare from "cloudflare";

describe("extractApexDomain", () => {
  it("extracts apex from subdomain", () => {
    expect(extractApexDomain("newsletter.example.com")).toBe("example.com");
  });

  it("returns apex domain as-is", () => {
    expect(extractApexDomain("example.com")).toBe("example.com");
  });

  it("handles deeply nested subdomain", () => {
    expect(extractApexDomain("a.b.c.example.com")).toBe("example.com");
  });
});

describe("discoverAccountId", () => {
  it("returns account ID when exactly one account exists", async () => {
    const mockClient = {
      accounts: { list: mockPageResult([{ id: "acc_123", name: "My Account" }]) },
    } as unknown as Cloudflare;

    const result = await discoverAccountId(mockClient);
    expect(result).toBe("acc_123");
  });

  it("throws when no accounts found", async () => {
    const mockClient = {
      accounts: { list: mockPageResult([]) },
    } as unknown as Cloudflare;

    await expect(discoverAccountId(mockClient)).rejects.toThrow(
      /No Cloudflare accounts found/,
    );
  });

  it("throws when multiple accounts found", async () => {
    const mockClient = {
      accounts: {
        list: mockPageResult([
          { id: "acc_1", name: "Account One" },
          { id: "acc_2", name: "Account Two" },
        ]),
      },
    } as unknown as Cloudflare;

    await expect(discoverAccountId(mockClient)).rejects.toThrow(
      /Multiple Cloudflare accounts found/,
    );
  });
});

// Helper: mock an async iterable (simulates SDK paginated list response)
function mockPageResult<T>(items: T[]) {
  const iterable = {
    [Symbol.asyncIterator]: async function* () {
      for (const item of items) yield item;
    },
  };
  return mock(() => iterable);
}

describe("ensureProject", () => {
  it("skips creation when project exists", async () => {
    const mockClient = {
      pages: {
        projects: {
          get: mock(() => Promise.resolve({ name: "my-project" })),
          create: mock(() => Promise.resolve({ name: "my-project" })),
        },
      },
    } as unknown as Cloudflare;

    const result = await ensureProject(mockClient, "acc_123", "my-project");
    expect(result.created).toBe(false);
    expect(mockClient.pages.projects.create).not.toHaveBeenCalled();
  });

  it("creates project when it does not exist", async () => {
    const notFound = new Cloudflare.APIError(404, undefined, "Not found", undefined);

    const mockClient = {
      pages: {
        projects: {
          get: mock(() => Promise.reject(notFound)),
          create: mock(() => Promise.resolve({ name: "my-project" })),
        },
      },
    } as unknown as Cloudflare;

    const result = await ensureProject(mockClient, "acc_123", "my-project");
    expect(result.created).toBe(true);
    expect(mockClient.pages.projects.create).toHaveBeenCalledWith({
      account_id: "acc_123",
      name: "my-project",
      production_branch: "main",
    });
  });
});

describe("ensureDomain", () => {
  it("skips when domain already exists", async () => {
    const mockClient = {
      pages: {
        projects: {
          domains: {
            list: mockPageResult([
              {
                name: "newsletter.example.com",
                zone_tag: "zone_1",
                status: "active",
              },
            ]),
            create: mock(() => Promise.resolve(null)),
          },
        },
      },
    } as unknown as Cloudflare;

    const result = await ensureDomain(
      mockClient,
      "acc_123",
      "my-project",
      "newsletter.example.com",
    );
    expect(result.created).toBe(false);
    expect(result.zoneTag).toBe("zone_1");
    expect(result.status).toBe("active");
    expect(mockClient.pages.projects.domains.create).not.toHaveBeenCalled();
  });

  it("creates domain when not present", async () => {
    const mockClient = {
      pages: {
        projects: {
          domains: {
            list: mockPageResult([]),
            create: mock(() =>
              Promise.resolve({
                name: "newsletter.example.com",
                zone_tag: "zone_1",
                status: "pending",
              }),
            ),
          },
        },
      },
    } as unknown as Cloudflare;

    const result = await ensureDomain(
      mockClient,
      "acc_123",
      "my-project",
      "newsletter.example.com",
    );
    expect(result.created).toBe(true);
    expect(result.zoneTag).toBe("zone_1");
    expect(result.status).toBe("pending");
    expect(mockClient.pages.projects.domains.create).toHaveBeenCalledWith(
      "my-project",
      { account_id: "acc_123", name: "newsletter.example.com" },
    );
  });
});

describe("ensureDnsRecord", () => {
  it("uses the Pages domain zone tag before falling back to zone lookup", async () => {
    const mockClient = {
      zones: {
        list: mockPageResult([]),
      },
      dns: {
        records: {
          list: mockPageResult([
            {
              type: "CNAME",
              name: "newsletter.example.com",
              content: "my-project.pages.dev",
            },
          ]),
          create: mock(() => Promise.resolve({})),
        },
      },
    } as unknown as Cloudflare;

    const result = await ensureDnsRecord(
      mockClient,
      "newsletter.example.com",
      "my-project.pages.dev",
      "zone_1",
    );
    expect(result.status).toBe("exists");
    expect(mockClient.zones.list).not.toHaveBeenCalled();
    expect(mockClient.dns.records.create).not.toHaveBeenCalled();
  });

  it("returns external when zone not found", async () => {
    const mockClient = {
      zones: { list: mockPageResult([]) },
    } as unknown as Cloudflare;

    const result = await ensureDnsRecord(
      mockClient,
      "newsletter.example.com",
      "my-project.pages.dev",
    );
    expect(result.status).toBe("external");
    if (result.status === "external") {
      expect(result.domain).toBe("newsletter.example.com");
      expect(result.target).toBe("my-project.pages.dev");
    }
  });

  it("skips when CNAME record already exists", async () => {
    const mockClient = {
      zones: {
        list: mockPageResult([{ id: "zone_1", name: "example.com" }]),
      },
      dns: {
        records: {
          list: mockPageResult([
            {
              type: "CNAME",
              name: "newsletter.example.com",
              content: "my-project.pages.dev",
            },
          ]),
          create: mock(() => Promise.resolve({})),
        },
      },
    } as unknown as Cloudflare;

    const result = await ensureDnsRecord(
      mockClient,
      "newsletter.example.com",
      "my-project.pages.dev",
    );
    expect(result.status).toBe("exists");
    expect(mockClient.dns.records.create).not.toHaveBeenCalled();
  });

  it("creates CNAME record when zone exists but record does not", async () => {
    const mockClient = {
      zones: {
        list: mockPageResult([{ id: "zone_1", name: "example.com" }]),
      },
      dns: {
        records: {
          list: mockPageResult([]),
          create: mock(() => Promise.resolve({})),
        },
      },
    } as unknown as Cloudflare;

    const result = await ensureDnsRecord(
      mockClient,
      "newsletter.example.com",
      "my-project.pages.dev",
    );
    expect(result.status).toBe("created");
    expect(mockClient.dns.records.create).toHaveBeenCalledWith({
      zone_id: "zone_1",
      type: "CNAME",
      name: "newsletter.example.com",
      content: "my-project.pages.dev",
      ttl: 1,
      proxied: true,
    });
  });
});
