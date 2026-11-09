// Slides 15-17: complete API tests replacing the ownership pseudocode.
// Uses an isolated, disposable MongoDB. Never uses MONGODB_URI from .env.
import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { MongoMemoryServer } from "mongodb-memory-server";
import app from "../app.js";
import User from "../models/User.js";
import Todo from "../models/Todo.js";

let mongod;

const userA = {
  name: "Alice",
  email: "alice@example.com",
  password: "VeryLongAlicePassword123!",
};
const userB = {
  name: "Bob",
  email: "bob@example.com",
  password: "VeryLongBobPassword123!",
};

async function registerAndLogin(user) {
  const registered = await request(app)
    .post("/api/auth/register")
    .send(user);
  expect(registered.status).toBe(201);

  const login = await request(app)
    .post("/api/auth/login")
    .send({ email: user.email, password: user.password });
  expect(login.status).toBe(200);
  expect(typeof login.body.token).toBe("string");
  return { token: login.body.token, id: registered.body.user.id };
}

function withToken(req, token) {
  return req.set("Authorization", `Bearer ${token}`);
}

beforeAll(async () => {
  // This variable is used only in testing, never copied from production.
  process.env.JWT_SECRET = "unit-test-secret-not-for-real-users-123456789";
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await User.init();
}, 120000);

beforeEach(async () => {
  await Promise.all([
    Todo.deleteMany({}),
    User.deleteMany({}),
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

describe("Registration and login API", () => {
  it("registers a user and stores a password hash (not plaintext)", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send(userA);
    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe(userA.email);
    expect(response.body.user).not.toHaveProperty("passwordHash");

    const user = await User.findOne({ email: userA.email })
      .select("+passwordHash");
    expect(user.passwordHash).not.toBe(userA.password);
    expect(await bcrypt.compare(userA.password, user.passwordHash)).toBe(true);
  });

  it("rejects missing registration data", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({ name: "Alice" });
    expect(response.status).toBe(400);
  });

  it("rejects invalid login credentials", async () => {
    await request(app).post("/api/auth/register").send(userA);
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: userA.email, password: "wrong-password" });
    expect(response.status).toBe(401);
  });
});

describe("Protected Todo API", () => {
  it("returns 401 when JWT is missing", async () => {
    const response = await request(app).get("/api/todos");
    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Authentication required");
  });

  it("returns 401 when JWT is invalid", async () => {
    const response = await withToken(
      request(app).get("/api/todos"),
      "not-a-valid-token"
    );
    expect(response.status).toBe(401);
  });

  it("returns 401 when JWT is expired", async () => {
    const authA = await registerAndLogin(userA);
    const expired = jwt.sign(
      { sub: authA.id },
      process.env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: -1 }
    );
    const response = await withToken(
      request(app).get("/api/todos"), expired
    );
    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Token expired");
  });

  it("returns 400 for blank Todo title", async () => {
    const authA = await registerAndLogin(userA);
    const response = await withToken(
      request(app).post("/api/todos"), authA.token
    ).send({ title: "   " });
    expect(response.status).toBe(400);
  });

  it("creates a Todo and returns it only to its owner", async () => {
    const authA = await registerAndLogin(userA);
    const authB = await registerAndLogin(userB);

    const created = await withToken(
      request(app).post("/api/todos"), authA.token
    ).send({ title: "Study Vitest" });
    expect(created.status).toBe(201);
    expect(created.body.title).toBe("Study Vitest");
    expect(created.body.user).toBe(authA.id);

    const listA = await withToken(
      request(app).get("/api/todos"), authA.token
    );
    const listB = await withToken(
      request(app).get("/api/todos"), authB.token
    );
    expect(listA.status).toBe(200);
    expect(listA.body).toHaveLength(1);
    expect(listB.status).toBe(200);
    expect(listB.body).toHaveLength(0);
  });

  it("returns 404 for an unknown valid Todo ID", async () => {
    const authA = await registerAndLogin(userA);
    const missingId = new mongoose.Types.ObjectId().toString();
    const response = await withToken(
      request(app).get(`/api/todos/${missingId}`), authA.token
    );
    expect(response.status).toBe(404);
  });

  it("prevents User B from reading User A's Todo (ownership)", async () => {
    const authA = await registerAndLogin(userA);
    const authB = await registerAndLogin(userB);

    const created = await withToken(
      request(app).post("/api/todos"), authA.token
    ).send({ title: "Alice's private todo" });
    expect(created.status).toBe(201);

    const responseB = await withToken(
      request(app).get(`/api/todos/${created.body._id}`),
      authB.token
    );
    expect(responseB.status).toBe(404);
    expect(responseB.body).not.toHaveProperty("title");

    const responseA = await withToken(
      request(app).get(`/api/todos/${created.body._id}`),
      authA.token
    );
    expect(responseA.status).toBe(200);
  });

  it("prevents User B from modifying or deleting User A's Todo", async () => {
    const authA = await registerAndLogin(userA);
    const authB = await registerAndLogin(userB);
    const created = await withToken(
      request(app).post("/api/todos"), authA.token
    ).send({ title: "Protected todo" });
    const id = created.body._id;

    const updateB = await withToken(
      request(app).patch(`/api/todos/${id}`), authB.token
    ).send({ completed: true });
    const deleteB = await withToken(
      request(app).delete(`/api/todos/${id}`), authB.token
    );
    expect(updateB.status).toBe(404);
    expect(deleteB.status).toBe(404);

    const ownerRead = await withToken(
      request(app).get(`/api/todos/${id}`), authA.token
    );
    expect(ownerRead.status).toBe(200);
    expect(ownerRead.body.completed).toBe(false);
  });

  it("lets the owner update then delete a Todo", async () => {
    const authA = await registerAndLogin(userA);
    const created = await withToken(
      request(app).post("/api/todos"), authA.token
    ).send({ title: "Initial" });
    const id = created.body._id;

    const updated = await withToken(
      request(app).patch(`/api/todos/${id}`), authA.token
    ).send({ title: "Updated", completed: true });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ title: "Updated", completed: true });

    const deleted = await withToken(
      request(app).delete(`/api/todos/${id}`), authA.token
    );
    expect(deleted.status).toBe(200);

    const gone = await withToken(
      request(app).get(`/api/todos/${id}`), authA.token
    );
    expect(gone.status).toBe(404);
  });

  it("DELETE /api/todos clears only the caller's records", async () => {
    const authA = await registerAndLogin(userA);
    const authB = await registerAndLogin(userB);
    await withToken(request(app).post("/api/todos"), authA.token)
      .send({ title: "Alice task" });
    await withToken(request(app).post("/api/todos"), authB.token)
      .send({ title: "Bob task" });

    const response = await withToken(
      request(app).delete("/api/todos"), authA.token
    );
    expect(response.status).toBe(200);
    expect(response.body.deletedCount).toBe(1);
    expect(await Todo.countDocuments({ user: authB.id })).toBe(1);
  });
});

describe("JWT /me and additional security regression tests", () => {
  it("GET /api/auth/me returns the authenticated user", async () => {
    const authA = await registerAndLogin(userA);
    const response = await withToken(
      request(app).get("/api/auth/me"), authA.token
    );
    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({
      id: authA.id,
      name: userA.name,
      email: userA.email,
    });
    expect(response.body.user).not.toHaveProperty("passwordHash");
  });

  it("GET /api/auth/me rejects a missing JWT", async () => {
    const response = await request(app).get("/api/auth/me");
    expect(response.status).toBe(401);
  });

  it("rejects a valid JWT for a user deleted from MongoDB", async () => {
    const authA = await registerAndLogin(userA);
    await User.findByIdAndDelete(authA.id);
    const response = await withToken(
      request(app).get("/api/auth/me"), authA.token
    );
    expect(response.status).toBe(401);
  });

  it("rejects a JWT signed with a different secret", async () => {
    const authA = await registerAndLogin(userA);
    const forged = jwt.sign({ sub: authA.id }, "different-secret", {
      algorithm: "HS256",
      expiresIn: "15m",
    });
    const response = await withToken(
      request(app).get("/api/todos"), forged
    );
    expect(response.status).toBe(401);
  });

  it("does not allow the client to set Todo ownership", async () => {
    const authA = await registerAndLogin(userA);
    const authB = await registerAndLogin(userB);
    const response = await withToken(
      request(app).post("/api/todos"), authA.token
    ).send({ title: "Owned by Alice", user: authB.id });
    expect(response.status).toBe(201);
    expect(response.body.user).toBe(authA.id);
  });

  it("does not allow PATCH to change Todo ownership", async () => {
    const authA = await registerAndLogin(userA);
    const authB = await registerAndLogin(userB);
    const created = await withToken(
      request(app).post("/api/todos"), authA.token
    ).send({ title: "Original" });
    const updated = await withToken(
      request(app).patch(`/api/todos/${created.body._id}`), authA.token
    ).send({ title: "Changed", user: authB.id });
    expect(updated.status).toBe(200);
    expect(updated.body.user).toBe(authA.id);
  });

  it("rejects a malformed Todo ID with 400", async () => {
    const authA = await registerAndLogin(userA);
    const response = await withToken(
      request(app).get("/api/todos/not-an-object-id"), authA.token
    );
    expect(response.status).toBe(400);
  });

  it("rejects a Todo title longer than 100 characters", async () => {
    const authA = await registerAndLogin(userA);
    const response = await withToken(
      request(app).post("/api/todos"), authA.token
    ).send({ title: "a".repeat(101) });
    expect(response.status).toBe(400);
  });
});