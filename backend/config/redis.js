
const { createClient } = require("redis");

// TODO: Create a Redis client
const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
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

// TODO: Create a function called connectRedis() to connect to Redis
async function connectRedis() {
  if(!redisClient.isOpen) {
    await redisClient.connect();
  }
}

module.exports = {
  redisClient,
  connectRedis,
};
