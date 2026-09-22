import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

declare global {
  var __redis: Redis | undefined;
  var __redisSubscriber: Redis | undefined;
}

function createClient() {
  const client = new Redis(redisUrl);
  client.on("error", (err) => {
    console.error("[redis] connection error:", err.message);
  });
  return client;
}

export const redis = globalThis.__redis ?? createClient();
export const redisSubscriber = globalThis.__redisSubscriber ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__redis = redis;
  globalThis.__redisSubscriber = redisSubscriber;
}

