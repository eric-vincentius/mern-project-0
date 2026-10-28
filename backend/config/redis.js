
const { createClient } = require("redis");

const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
});

redisClient.on("error", (error) => {
  console.error("[Redis] Client error:", error.message);
});

redisClient.on("connect", () => {
  console.log("[Redis] Connecting...");
});

redisClient.on("ready", () => {
  console.log("[Redis] Ready to accept commands");
});

async function connectRedis() {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
}

module.exports = {
  redisClient,
  connectRedis,
};
