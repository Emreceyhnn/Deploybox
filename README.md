# DeployBox

Push to a GitHub repo, get a live URL. DeployBox watches a repo's default branch,
builds a Docker image from its `Dockerfile`, runs the container, and points
`<subdomain>.<domain>` at it via Nginx — with live build/deploy logs streamed to
the browser as it happens.

## Architecture

```
                                   ┌─────────────────────────┐
                                   │        GitHub           │
                                   │  (push webhook / OAuth)  │
                                   └────────────┬─────────────┘
                                                │ POST /api/webhooks/github
                                                ▼
┌───────────────────────────────────────────────────────────────────────┐
│                     deploy-box-client (Next.js)                       │
│                                                                       │
│   Browser (React/MUI) ── tRPC ──▶  routers/{projects,deployments}    │
│         ▲                                    │                       │
│         │ GET /api/log/[id]                  │ RPUSH deploy:queue    │
│         │ (SSE, text/event-stream)           ▼                       │
│   ┌─────┴──────┐                     ┌───────────────┐               │
│   │  Log panel │◀── SUBSCRIBE ───────│     Redis      │               │
│   └────────────┘    logs:<id>        │ queue + pubsub │               │
│                                       │ + log buffer   │               │
│                                       └───────┬────────┘               │
└───────────────────────────────────────────────┼─────────────────────┘
                                                 │ BLPOP deploy:queue
                                                 ▼
                              ┌──────────────────────────────────┐
                              │   DeployBox.Orchestrator (.NET)   │
                              │                                    │
                              │  Worker ─▶ DeploymentProcessor     │
                              │    1. GitService      (git clone)  │
                              │    2. DockerBuildService (build)   │
                              │    3. DockerContainerService (run) │
                              │    4. NginxConfigService (routing) │
                              │                                    │
                              │  every step → DeploymentLogService │
                              │  → PUBLISH logs:<id> + buffer list │
                              └──────────────────┬─────────────────┘
                                                 │ docker.sock
                                                 ▼
                                        ┌──────────────────┐
                                        │  Docker Engine    │
                                        │  (build + run     │
                                        │   containers)      │
                                        └──────────────────┘
```

**Request/data flow for a deploy:**

1. A `git push` to the repo's default branch hits `POST /api/webhooks/github`
   (or a user clicks "Deploy" in the dashboard / adds a new project).
2. The Next.js app validates the webhook signature, writes a `deployments` row
   in Postgres, and pushes a JSON job onto the Redis list `deploy:queue`.
3. The .NET Orchestrator's `Worker` (a `BackgroundService`) blocks on that
   queue, pops the job, and runs `DeploymentProcessor`: clone → build image →
   run container → write Nginx vhost config.
4. Every step calls `DeploymentLogService.SendLogAsync`, which both publishes
   to the Redis Pub/Sub channel `logs:<deploymentId>` **and** appends to a
   capped Redis list (`logs:<deploymentId>:buffer`, last 200 lines / 1h TTL)
   so a client that connects late (or reconnects) still sees recent history.
5. The browser opens an `EventSource` to `GET /api/log/[id]`, a Next.js Route
   Handler that replays the buffer and then subscribes live to the Pub/Sub
   channel, streaming each line down as Server-Sent Events.
6. Once the container is running, the Orchestrator also tails
   `docker logs -f` for a bounded window and forwards those lines through the
   same pipeline, so runtime (not just build-time) output shows up live.
7. On success, Nginx is configured to reverse-proxy
   `<subdomain>.<domain>` to the container's published port.

## Getting started

### Prerequisites

- Node.js 20+
- .NET 10 SDK
- Docker (the Orchestrator builds/runs images via the Docker Engine API, so
  Docker must be running — either natively or via Docker Desktop)
- A GitHub OAuth App (for sign-in) and, if you want real webhooks, a publicly
  reachable `NEXTAUTH_URL`

### 1. Start infrastructure (Postgres + Redis + Orchestrator)

```bash
docker compose up -d
```

This starts `deploybox-db` (Postgres), `deploybox-redis`, and the
`deploybox-orchestrator` worker (built from `DeployBox.Orchestrator/`, mounted
against the host's `docker.sock` so it can build/run containers itself).

### 2. Configure environment variables

Create `deploy-box-client/.env`:

```env
NODE_ENV=development
DATABASE_URL=postgres://postgres:<password>@localhost:5432/deploybox
GITHUB_CLIENT_ID=<your GitHub OAuth app client id>
GITHUB_SECRET_KEY=<your GitHub OAuth app client secret>
JWT_SECRET=<random 32+ byte secret>
# Separate from JWT_SECRET on purpose — this one protects data at rest
# (GitHub tokens, webhook secrets) and must be independently rotatable.
ENCRYPTION_KEY=<random 32+ byte secret, different from JWT_SECRET>
REDIS_URL=redis://:<password>@localhost:6379
NEXTAUTH_URL=http://localhost:3000
ORCHESTRATOR_API_TOKEN=<random secret shared with the orchestrator>
```

### 3. Install dependencies and set up the database

```bash
cd deploy-box-client
npm install
npm run db:push
```

### 4. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in with GitHub, and
connect a repository — or use `/playground` (dev-only) to drive the Redis
pub/sub + SSE log pipeline directly without needing a real repo or GitHub
OAuth.

### Running the Orchestrator outside Docker (optional, for development)

```bash
cd DeployBox.Orchestrator
dotnet run
```

It reads `ConnectionStrings:Redis` from configuration/user-secrets and falls
back to `localhost:6379`.

### Tests

```bash
# .NET unit/integration tests
cd DeployBox.Orchestrator.Tests && dotnet test

# Next.js E2E (Playwright) — needs Postgres + Redis running (docker compose up -d)
cd deploy-box-client
npm run test:e2e          # headless
npm run test:e2e:ui       # interactive UI mode
```

The E2E main-flow tests drive the `/playground` page rather than the real
GitHub OAuth flow, since there's no credentials-based login to automate — a
minted NextAuth session cookie (see `e2e/fixtures/auth.ts`) is used to reach
protected tRPC procedures instead.

## Tech stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | Next.js 16 (App Router, Turbopack), React 19 | Server components + one deploy target for UI and API routes |
| UI | MUI (Material UI), Emotion | Fast to build a consistent dashboard with |
| API | tRPC v11 | End-to-end typed client↔server calls without a separate REST/OpenAPI layer |
| Auth | NextAuth v4 (GitHub OAuth, JWT sessions) | Repo access + identity from the same GitHub login |
| Database | PostgreSQL + Drizzle ORM | Typed schema/migrations, lightweight compared to a full ORM like Prisma |
| Queue / Pub-Sub | Redis (`ioredis` client-side, `StackExchange.Redis` on the worker) | One store for the deploy job queue, log fan-out, and the reconnect log buffer |
| Log streaming | Server-Sent Events (`EventSource` + Route Handler streaming a Redis subscription) | Simpler and more proxy-friendly than WebSockets for one-way log tailing |
| Worker/orchestrator | .NET 10 Worker Service | Long-running background service well suited to sequential build/deploy pipelines |
| Container builds | `Docker.DotNet` against the Docker Engine API | Builds images and runs containers without shelling out to the `docker` CLI |
| Git operations | LibGit2Sharp | In-process clone without depending on a system `git` binary |
| Reverse proxy | Nginx (vhost config generated per subdomain) | Battle-tested static + reverse-proxy routing for `<subdomain>.<domain>` |
| E2E testing | Playwright | Drives the real browser against the real Redis/Postgres-backed app |

## Known limitations / notes

See [NOTES.md](./NOTES.md) for design decisions, where AI tooling was used,
and known gaps.
