# MERN Stack Todo App: Usage Guide

A learning project for building a full-stack Todo application with **MongoDB, Express.js, React (Vite), Node.js, JWT authentication, and Redis caching**.

## Features

- Register and log in with email and password.
- Authenticate requests with JSON Web Tokens (JWT).
- Create, view, update, complete, and delete Todos.
- Restrict Todo access to the authenticated user.
- Cache Todo lists in Redis (per-user cache keys, with a short TTL).
- Import and export Todo data as JSON (see the security note below).
- Test frontend services and backend APIs with Vitest; backend integration tests use MongoDB Memory Server.

## Prerequisites

Install these before starting:

| Tool | Why it is needed |
| --- | --- |
| [Git](https://git-scm.com/downloads) | Clone the repository. |
| [Node.js](https://nodejs.org/) + npm | Run the Express backend and React frontend. Node.js 22 LTS is a good choice; check the versions required by the repository's `package.json`. |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Easiest way to run Redis locally; can also run MongoDB. On Windows, start Docker Desktop before using `docker` commands. |
| MongoDB | Use MongoDB locally, in Docker, or through [MongoDB Atlas](https://www.mongodb.com/atlas). |
| Code editor | VS Code or your preferred editor. |

Check your installation in PowerShell:

```powershell
node -v
npm -v
git --version
docker --version
```

## Project structure

The application is organized approximately as follows (some filenames may vary by revision):

```text
mern-todo-app/
├── backend/
│   ├── app.js                 # Express app, middleware, routes
│   ├── server.js              # Database connections and HTTP startup
│   ├── config/
│   │   └── redis.js           # Redis client and connection helper
│   ├── middleware/
│   │   └── requireAuth.js     # JWT verification
│   ├── models/
│   │   ├── User.js
│   │   └── Todo.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   └── todoRoutes.js
│   ├── tests/
│   │   └── todo.integration.test.mjs
│   ├── .env                   # Create locally; never commit
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   ├── context/
│   │   └── services/
│   ├── .env                   # Create locally; never commit
│   └── package.json
└── README.md
```

## 1. Clone the repository

Replace the placeholder with the repository URL provided by your instructor:

```powershell
git clone https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
cd YOUR_REPOSITORY
```

For example, GitHub's **Code → HTTPS** menu provides the clone URL. Run the remaining commands from the cloned repository unless a different directory is shown.

## 2. Start Redis with Docker

Make sure Docker Desktop is running. In PowerShell, create a Redis container:

```powershell
docker run -d --name mern-todo-redis -p 127.0.0.1:6379:6379 redis:7-alpine
```

Confirm that it is running:

```powershell
docker ps
```

Verify the Redis connection:

```powershell
docker exec -it mern-todo-redis redis-cli ping
```

Expected output:

```text
PONG
```

If you already created the container, **do not run `docker run` again**. Start the existing container instead:

```powershell
docker start mern-todo-redis
```

Useful Redis commands:

```powershell
# See container logs
docker logs mern-todo-redis

# Open the Redis command-line interface
docker exec -it mern-todo-redis redis-cli

# Stop Redis when finished
docker stop mern-todo-redis

# Start it again next time
docker start mern-todo-redis
```

Redis runs on `localhost:6379` with this configuration. This is a **local development setup**, not a secured public Redis deployment. Do not expose port 6379 to the internet.

### How Redis is used in the Todo app

The Todo API caches each user's list separately, using a key like:

```text
todos:user:<USER_ID>
```

The current Todo routes use a **30-second cache TTL** and should invalidate the relevant user's cache after creating, updating, importing, or deleting Todos. This prevents a shared cache key from mixing different users' Todo lists.

## 3. Configure MongoDB

Choose **one** of the following options.

### Option A — MongoDB in Docker (easy local setup)

```powershell
docker run -d --name mern-todo-mongo -p 127.0.0.1:27017:27017 -v mern-todo-mongo-data:/data/db mongo:7
```

Use this MongoDB URI in your backend `.env`:

```dotenv
MONGO_URI=mongodb://127.0.0.1:27017/mern_todo
```

On later days, start the existing container with:

```powershell
docker start mern-todo-mongo
```

The example MongoDB container has no authentication and is intended **only for local learning**. Do not expose it publicly.

### Option B — MongoDB Atlas

1. Create an Atlas project and database cluster.
2. Create a database user.
3. Allow your current IP address under Atlas network access settings.
4. Copy the MongoDB driver connection string.
5. Replace its username, password, and database name with your own values.

Example URI format (placeholders only):

```dotenv
MONGO_URI=mongodb+srv://<USERNAME>:<PASSWORD>@<CLUSTER_HOST>/mern_todo?retryWrites=true&w=majority
```

Do not commit real credentials. Special characters in database passwords may need URL encoding.

## 4. Configure the backend environment

Go into the backend folder:

```powershell
cd backend
npm install
```

If the repository contains `backend/.env.example`, copy it:

```powershell
Copy-Item .env.example .env
```

Otherwise, create `backend/.env` manually. A typical local setup looks like:

```dotenv
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/mern_todo
JWT_SECRET=REPLACE_WITH_A_LONG_RANDOM_SECRET
REDIS_URL=redis://127.0.0.1:6379
```

Generate a secure, random JWT secret in PowerShell:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the generated value into `JWT_SECRET` in `backend/.env`. Do not share the secret or commit the `.env` file.

## 5. Configure the frontend environment

Open a **second terminal** at the repository root, then:

```powershell
cd frontend
npm install
```

Create `frontend/.env` (or copy `.env.example` if present):

```dotenv
VITE_API_URL=http://localhost:5000/api
```

**Include `/api` at the end.** The frontend services append paths such as `/auth/login` and `/todos`. Without `/api`, requests may return `404` or an HTML response instead of JSON.

Restart Vite whenever you change its `.env` file. Never put `JWT_SECRET`, MongoDB credentials, or other backend secrets in a `VITE_` variable; Vite exposes these variables to browser code.

## 6. Run the application

You should have **three services** running: MongoDB, Redis, and your Node.js backend. React runs separately through Vite.

**Terminal 1 — Backend:**

```powershell
cd backend
npm start
```

If your backend defines a development script, you can use `npm run dev` instead. Run `npm run` to see the scripts available in your version of the repository.

A successful startup should show messages indicating MongoDB and Redis are connected, followed by something like:

```text
Server running on port 5000
```

**Terminal 2 — Frontend:**

```powershell
cd frontend
npm run dev
```

Open the URL printed by Vite, usually:

**http://localhost:5173**

You can now register, log in, and create Todos.

### First login

1. Open the frontend in your browser.
2. Go to **Register** and create a test account.
3. Use a password of **at least 12 characters**; the shared backend also limits bcrypt passwords to **72 UTF-8 bytes**.
4. Go to **Login** and sign in.
5. Add a Todo, update its title or completion status, and delete it.

The backend's JWT currently expires after **15 minutes**. If you receive `401 Unauthorized` later, log in again. In the React AuthContext version discussed in class, the token is stored in memory, so refreshing the browser also logs you out.

## 7. API overview

All Todo routes require the HTTP header `Authorization: Bearer <JWT>`.

| Method | Endpoint | Purpose | JWT? |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Create an account | No |
| POST | `/api/auth/login` | Log in and receive a JWT | No |
| GET | `/api/auth/me` | Get the current user | Yes |
| GET | `/api/todos` | List your Todos | Yes |
| GET | `/api/todos/:id` | Get one of your Todos | Yes |
| POST | `/api/todos` | Create a Todo | Yes |
| PUT | `/api/todos/:id` | Update a Todo | Yes |
| PATCH | `/api/todos/:id` | Partially update a Todo | Yes |
| DELETE | `/api/todos/:id` | Delete a Todo | Yes |
| DELETE | `/api/todos` | Delete all your Todos | Yes |
| GET | `/api/todos/export` | Export Todos to JSON | Yes |
| POST | `/api/todos/import` | Import Todos from JSON | Yes |

The import/export endpoints require additional ownership review before they should be used with real data or in a public deployment.

### Example: inspect an authenticated request

In Chrome DevTools, open **Network**, log in, and inspect the response from `/api/auth/login`. The response includes a JWT. Subsequent requests to `/api/todos` should include an `Authorization: Bearer ...` request header. Treat JWTs as credentials: do not post them publicly or commit them.

## 8. Run automated tests

**Backend integration tests:**

```powershell
cd backend
npm test
```

The backend tests use **Vitest, Supertest, and MongoDB Memory Server**. They should connect to a temporary test database rather than the development/Atlas database. MongoDB Memory Server may download a MongoDB binary on its first run, so an internet connection may be required.

The test suite should import the Express application from `app.js`, not a `server.js` that starts production database connections and an HTTP listener.

**Frontend tests** (if the frontend `package.json` has a `test` script):

```powershell
cd frontend
npm test
```

To see available scripts in either directory:

```powershell
npm run
```

## 9. Troubleshooting

| Problem | What to check |
| --- | --- |
| `ECONNREFUSED 127.0.0.1:6379` | Start Docker Desktop and the Redis container. Run `docker exec -it mern-todo-redis redis-cli ping`. |
| `ClientClosedError: The client is closed` | Redis is not connected, or the route attempts cache operations while the client is closed. Check `connectRedis()` and guard optional cache operations with `redisClient.isReady`. |
| MongoDB connection failed | Check `MONGO_URI`, MongoDB container status, or Atlas network access and credentials. |
| Login returns `404` / `Unexpected token '<'` | Check that `VITE_API_URL` is `http://localhost:5000/api`, not just `http://localhost:5000`. Restart Vite. |
| Registration returns `400 Invalid registration details` | Check required fields and use a password at least 12 characters long (and no more than 72 UTF-8 bytes). |
| Todo request returns `401 Unauthorized` | Log in again and confirm the `Authorization: Bearer <JWT>` header is sent. The JWT expires after 15 minutes. |
| `mongodb-memory-server` package missing | Run `npm install` in `backend` and check that the package is installed. |
| Mongoose `openUri()` on an active connection | Ensure tests import `app.js` and do not also start the normal MongoDB connection in `server.js`. |
| Docker container name already in use | Use `docker start mern-todo-redis` or `docker start mern-todo-mongo` instead of creating a duplicate container. |
| Port 5000, 5173, 6379, or 27017 already in use | Stop the conflicting process/container or change the relevant port and configuration. |

## 10. Security and good practices

- Keep `backend/.env`, `frontend/.env`, and `node_modules/` out of Git. Add them to `.gitignore` if needed.
- Commit example configuration files such as `.env.example` **without real secrets**.
- Never put `JWT_SECRET` in the frontend or expose it to students as a real production credential.
- Always check `req.user._id` when reading, updating, deleting, importing, or exporting Todos.
- Use a separate Redis cache key for each authenticated user.
- Validate Todo titles and update fields on the backend, not just in React.
- Do not use unauthenticated local MongoDB/Redis Docker configurations in a public deployment.
- Review and fix JSON import/export ownership handling before allowing multiple users to use those features.
- For production, add HTTPS, rate limiting, stronger validation, secure secret management, and an appropriate JWT/session renewal strategy.

## Further exercises

After the app works, try these exercises:

1. Create two user accounts and verify that each user sees only their own Todos.
2. Inspect the JWT in Chrome DevTools and identify its `sub`, `iat`, and `exp` claims.
3. Run `redis-cli` and inspect the per-user cache keys during Todo list requests.
4. Change a Todo's `completed` value from `false` to `true`, and verify it is saved.
5. Run `npm test` and explain why each test is useful.

---

**Need help?** Check the terminal running the backend, the browser's DevTools **Console** and **Network** tabs, and the troubleshooting table above. When reporting a bug, include the error message, endpoint, HTTP status, and relevant code (but **never** share passwords, `.env` files, or real JWTs).
