import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getProjectDomain, getProjectFullUrl } from "@/app/lib/domain";

describe("getProjectDomain", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_APP_DOMAIN;
    delete process.env.APP_DOMAIN;
  });

  it("returns customDomain when provided", () => {
    expect(getProjectDomain("myapp", "myapp.com")).toBe("myapp.com");
  });

  it("uses NEXT_PUBLIC_APP_DOMAIN when set", () => {
    process.env.NEXT_PUBLIC_APP_DOMAIN = "example.com";
    expect(getProjectDomain("myapp")).toBe("myapp.example.com");
  });

  it("uses APP_DOMAIN as fallback when NEXT_PUBLIC_APP_DOMAIN not set", () => {
    process.env.APP_DOMAIN = "staging.example.com";
    expect(getProjectDomain("myapp")).toBe("myapp.staging.example.com");
  });

  it("falls back to emreceyhan.xyz when no env vars set", () => {
    expect(getProjectDomain("myapp")).toBe("myapp.emreceyhan.xyz");
  });

  it("ignores customDomain=null and uses env domain", () => {
    process.env.NEXT_PUBLIC_APP_DOMAIN = "example.com";
    expect(getProjectDomain("myapp", null)).toBe("myapp.example.com");
  });
});

describe("getProjectFullUrl", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_APP_DOMAIN;
    delete process.env.APP_DOMAIN;
    delete process.env.NODE_ENV;
  });

  it("returns customDomain as-is when it already has protocol", () => {
    expect(getProjectFullUrl("myapp", "https://myapp.com")).toBe("https://myapp.com");
    expect(getProjectFullUrl("myapp", "http://myapp.com")).toBe("http://myapp.com");
  });

  it("prepends https:// to customDomain without protocol", () => {
    expect(getProjectFullUrl("myapp", "myapp.com")).toBe("https://myapp.com");
  });

  it("uses https when APP_DOMAIN is a production domain", () => {
    process.env.NEXT_PUBLIC_APP_DOMAIN = "example.com";
    expect(getProjectFullUrl("myapp")).toBe("https://myapp.example.com");
  });

  it("uses http when APP_DOMAIN contains localhost", () => {
    process.env.NEXT_PUBLIC_APP_DOMAIN = "localhost:3000";
    expect(getProjectFullUrl("myapp")).toBe("http://myapp.localhost:3000");
  });

  it("uses http when APP_DOMAIN contains 127.0.0.1", () => {
    process.env.NEXT_PUBLIC_APP_DOMAIN = "127.0.0.1:3000";
    expect(getProjectFullUrl("myapp")).toBe("http://myapp.127.0.0.1:3000");
  });

  it("returns localhost:hostPort in development with hostPort set", () => {
    process.env.NODE_ENV = "development";
    expect(getProjectFullUrl("myapp", null, 49152)).toBe("http://localhost:49152");
  });

  it("falls back to emreceyhan.xyz in development with no hostPort", () => {
    process.env.NODE_ENV = "development";
    expect(getProjectFullUrl("myapp", null, null)).toBe("https://myapp.emreceyhan.xyz");
  });

  it("returns https fallback in production with no env vars", () => {
    expect(getProjectFullUrl("myapp")).toBe("https://myapp.emreceyhan.xyz");
  });
});
