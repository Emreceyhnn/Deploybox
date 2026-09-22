import crypto from "crypto";

const GITHUB_API = "https://api.github.com";

export function generateWebhookSecret() {
  return crypto.randomBytes(32).toString("hex");
}

export function verifyWebhookSignature(payload: string, signature: string | null, secret: string) {
  if (!signature) return false;

  const expected = `sha256=${crypto.createHmac("sha256", secret).update(payload).digest("hex")}`;

  const expectedBuf = Buffer.from(expected);
  const signatureBuf = Buffer.from(signature);

  if (expectedBuf.length !== signatureBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, signatureBuf);
}

export async function listUserRepos(params: { accessToken: string }) {
  const { accessToken } = params;

  const repos: { fullName: string; defaultBranch: string; private: boolean }[] = [];
  let page = 1;

  while (true) {
    const res = await fetch(
      `${GITHUB_API}/user/repos?per_page=100&page=${page}&sort=pushed&affiliation=owner,collaborator`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github+json",
        },
      },
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Failed to list GitHub repos (${res.status}): ${body}`);
    }

    const data = (await res.json()) as {
      full_name: string;
      default_branch: string;
      private: boolean;
    }[];

    repos.push(
      ...data.map((repo) => ({
        fullName: repo.full_name,
        defaultBranch: repo.default_branch,
        private: repo.private,
      })),
    );

    if (data.length < 100) break;
    page += 1;
  }

  return repos;
}

export async function getRepo(params: {
  accessToken: string;
  repoOwner: string;
  repoName: string;
}) {
  const { accessToken, repoOwner, repoName } = params;

  const res = await fetch(`${GITHUB_API}/repos/${repoOwner}/${repoName}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to look up GitHub repo (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { id: number; default_branch: string };
  return { id: String(data.id), defaultBranch: data.default_branch };
}

export async function createRepoWebhook(params: {
  accessToken: string;
  repoOwner: string;
  repoName: string;
  webhookUrl: string;
  secret: string;
}) {
  const { accessToken, repoOwner, repoName, webhookUrl, secret } = params;

  const res = await fetch(`${GITHUB_API}/repos/${repoOwner}/${repoName}/hooks`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "web",
      active: true,
      events: ["push"],
      config: {
        url: webhookUrl,
        content_type: "json",
        secret,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to create GitHub webhook (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { id: number };
  return { id: String(data.id) };
}

export async function deleteRepoWebhook(params: {
  accessToken: string;
  repoOwner: string;
  repoName: string;
  webhookId: string;
}) {
  const { accessToken, repoOwner, repoName, webhookId } = params;

  const res = await fetch(
    `${GITHUB_API}/repos/${repoOwner}/${repoName}/hooks/${webhookId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
      },
    },
  );

  // 404 means it's already gone — treat as success.
  if (!res.ok && res.status !== 404) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to delete GitHub webhook (${res.status}): ${body}`);
  }
}
