import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/app/lib/redis", () => ({
  redis: {
    set: vi.fn().mockResolvedValue("OK"),
    get: vi.fn().mockResolvedValue(null),
    exists: vi.fn().mockResolvedValue(0),
    ttl: vi.fn().mockResolvedValue(-2),
  },
}));

import { DENYLIST_PREFIXES, DenylistService } from "@/app/lib/denylist";
import { redis } from "@/app/lib/redis";

const redisMock = redis as {
  set: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  exists: ReturnType<typeof vi.fn>;
  ttl: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DENYLIST_PREFIXES", () => {
  it("TOKEN prefix is 'denylist:token:'", () => {
    expect(DENYLIST_PREFIXES.TOKEN).toBe("denylist:token:");
  });

  it("USER prefix is 'denylist:user:'", () => {
    expect(DENYLIST_PREFIXES.USER).toBe("denylist:user:");
  });
});

describe("DenylistService.getTokenKey", () => {
  it("builds correct key for a token", () => {
    expect(DenylistService.getTokenKey("abc123")).toBe("denylist:token:abc123");
  });
});

describe("DenylistService.getUserKey", () => {
  it("builds correct key for a user", () => {
    expect(DenylistService.getUserKey("user-42")).toBe("denylist:user:user-42");
  });
});

describe("DenylistService.revokeToken", () => {
  it("calls redis.set with the correct key and EX", async () => {
    const result = await DenylistService.revokeToken({ jtiOrToken: "tok1", expiresInSeconds: 300, reason: "logout" });
    expect(result).toBe(true);
    expect(redisMock.set).toHaveBeenCalledWith("denylist:token:tok1", expect.any(String), "EX", 300);
  });

  it("stores revokedAt and reason in the value JSON", async () => {
    await DenylistService.revokeToken({ jtiOrToken: "tok2", reason: "password-change" });
    const setCall = redisMock.set.mock.calls[0];
    const value = JSON.parse(setCall[1]);
    expect(value).toHaveProperty("revokedAt");
    expect(value.reason).toBe("password-change");
  });

  it("returns false for empty jtiOrToken", async () => {
    const result = await DenylistService.revokeToken({ jtiOrToken: "" });
    expect(result).toBe(false);
    expect(redisMock.set).not.toHaveBeenCalled();
  });

  it("returns false for non-positive expiresInSeconds", async () => {
    const result = await DenylistService.revokeToken({ jtiOrToken: "tok3", expiresInSeconds: 0 });
    expect(result).toBe(false);
  });
});

describe("DenylistService.isTokenRevoked", () => {
  it("returns false when redis.exists returns 0", async () => {
    redisMock.exists.mockResolvedValueOnce(0);
    expect(await DenylistService.isTokenRevoked("tok1")).toBe(false);
  });

  it("returns true when redis.exists returns 1", async () => {
    redisMock.exists.mockResolvedValueOnce(1);
    expect(await DenylistService.isTokenRevoked("tok1")).toBe(true);
  });

  it("returns false for empty string without hitting redis", async () => {
    expect(await DenylistService.isTokenRevoked("")).toBe(false);
    expect(redisMock.exists).not.toHaveBeenCalled();
  });
});

describe("DenylistService.revokeUserSessions", () => {
  it("calls redis.set with user key and EX", async () => {
    const result = await DenylistService.revokeUserSessions("user-1", 86400);
    expect(result).toBe(true);
    expect(redisMock.set).toHaveBeenCalledWith("denylist:user:user-1", expect.any(String), "EX", 86400);
  });

  it("returns false for empty userId", async () => {
    const result = await DenylistService.revokeUserSessions("");
    expect(result).toBe(false);
  });
});

describe("DenylistService.isUserSessionRevoked", () => {
  it("returns false when no revocation record in redis", async () => {
    redisMock.get.mockResolvedValueOnce(null);
    expect(await DenylistService.isUserSessionRevoked("user-1")).toBe(false);
  });

  it("returns true when token was issued before revocation timestamp", async () => {
    const revokedAt = Date.now();
    redisMock.get.mockResolvedValueOnce(revokedAt.toString());
    const tokenIssuedBefore = revokedAt - 1000;
    expect(await DenylistService.isUserSessionRevoked("user-1", tokenIssuedBefore)).toBe(true);
  });

  it("returns false when token was issued after revocation timestamp", async () => {
    const revokedAt = Date.now();
    redisMock.get.mockResolvedValueOnce(revokedAt.toString());
    const tokenIssuedAfter = revokedAt + 1000;
    expect(await DenylistService.isUserSessionRevoked("user-1", tokenIssuedAfter)).toBe(false);
  });

  it("returns false for empty userId without hitting redis", async () => {
    expect(await DenylistService.isUserSessionRevoked("")).toBe(false);
    expect(redisMock.get).not.toHaveBeenCalled();
  });
});
