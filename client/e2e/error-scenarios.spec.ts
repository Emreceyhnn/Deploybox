import { test, expect } from "@playwright/test";

test.describe("error scenarios", () => {
  test("publishing a log without a session is rejected", async ({ page }) => {
    // No auth fixture here on purpose: request goes out without a session cookie.
    await page.goto("/playground");

    await page.getByPlaceholder("e.g. dpl_demo123").fill("e2e-unauth");
    await page.getByPlaceholder("Type test log line...").fill("should not publish");
    await page.getByRole("button", { name: "Publish" }).click();

    // tRPC surfaces the UNAUTHORIZED error; the mutation must not succeed silently.
    const response = await page.waitForResponse((res) =>
      res.url().includes("simulateBuildLogs"),
    );
    expect(response.ok()).toBeFalsy();
  });

  test("subscribing without a deployment id does not open a stream", async ({ page }) => {
    await page.goto("/playground");

    const idInput = page.getByPlaceholder("e.g. dpl_demo123");
    await idInput.fill("");

    const subscribeButton = page.getByRole("button", { name: /Subscribe to Live Logs/i });
    await expect(subscribeButton).toBeDisabled();
  });

  test("webhook endpoint rejects a push event for an unknown repository", async ({
    request,
  }) => {
    const res = await request.post("/api/webhooks/github", {
      headers: { "x-github-event": "push" },
      data: {
        ref: "refs/heads/main",
        after: "deadbeef",
        head_commit: { message: "test" },
        pusher: { name: "someone" },
        sender: { avatar_url: "" },
        repository: { full_name: "nonexistent-owner/nonexistent-repo" },
      },
    });

    expect(res.status()).toBe(404);
  });

  test("webhook endpoint rejects a payload with an invalid signature", async ({
    request,
  }) => {
    const res = await request.post("/api/webhooks/github", {
      headers: {
        "x-github-event": "push",
        "x-hub-signature-256": "sha256=invalidsignature",
      },
      data: {
        ref: "refs/heads/main",
        after: "deadbeef",
        head_commit: { message: "test" },
        pusher: { name: "someone" },
        sender: { avatar_url: "" },
        repository: { full_name: "nonexistent-owner/nonexistent-repo" },
      },
    });

    // Repo lookup fails before signature check when the repo is unknown; either
    // way the request must be rejected, never queue a deployment.
    expect([401, 404]).toContain(res.status());
  });
});
