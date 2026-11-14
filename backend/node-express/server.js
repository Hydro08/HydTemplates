/**
 * Node + Express backend: sign up, sign in, the school portal PROFILE and the CHAT of the quiz app (student <-> teacher messages).
 *
 * Run (Node 22.13 or newer):
 *   npm install
 *   npm start            ->  http://localhost:3000
 *
 * Endpoints (JSON). The chat ones are described in ../CHAT-API.md.
 *   POST /api/register   POST /api/login   GET /api/me   POST /api/logout
 *   GET  /api/profile    POST /api/profile
 *   GET  /api/chats      GET  /api/messages?with=username&after=id      POST /api/messages
 *   POST /api/markread   GET  /api/unread
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");
const session = require("express-session");
const { openDatabase } = require("./db");
const auth = require("./routes/auth");
const profile = require("./routes/profile");
const chat = require("./routes/chat");
const admin = require("./routes/admin");

// The folder that has frontend/ and shared/. In a downloaded project they are next to server.js;
// inside the Hyd Templates repo they are two folders up.
const ZIPPED = fs.existsSync(path.join(__dirname, "frontend"));
const PROJECT_ROOT = ZIPPED ? __dirname : path.join(__dirname, "..", "..");

function createApp(db = openDatabase()) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "64kb" }));

  let secret = process.env.SESSION_SECRET;
  if (!secret) {
    secret = crypto.randomBytes(32).toString("hex");
    console.warn("SESSION_SECRET is not set: a random one is used, so everybody signs in again when the server restarts.");
  }
  app.use(session({
    name: "sid",
    secret,
    resave: false,
    saveUninitialized: false,                 // no cookie until somebody signs in
    cookie: { httpOnly: true, sameSite: "lax", secure: process.env.COOKIE_SECURE === "1" },   // COOKIE_SECURE=1 with https
  }));

  const api = express.Router();
  api.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    res.set("X-Content-Type-Options", "nosniff");
    next();
  });
  auth.register(api, db);
  profile.register(api, db);
  chat.register(api, db);
  admin.register(api, db);
  api.use((req, res) => res.status(404).json({ message: "Not found." }));
  app.use("/api", api);

  // The website itself. Only frontend/ and shared/ are public, never this folder or data/.
  // Downloaded project: its own index.html. Inside the repo (the gallery is there): the quiz app.
  app.get("/", (req, res) => ZIPPED
    ? res.sendFile(path.join(PROJECT_ROOT, "index.html"))
    : res.redirect("/frontend/quiz-app/index.html"));
  app.use("/frontend", express.static(path.join(PROJECT_ROOT, "frontend"), { dotfiles: "ignore" }));
  app.use("/shared", express.static(path.join(PROJECT_ROOT, "shared"), { dotfiles: "ignore" }));

  // Broken JSON, a request that is too big...
  app.use((error, req, res, next) => {
    if (error && error.status && error.status < 500) {
      return res.status(error.status).json({ message: error.status === 413 ? "The request is too big." : "Bad request." });
    }
    console.error(error);
    res.status(500).json({ message: "Server error." });
  });

  return app;
}

module.exports = { createApp };

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  createApp().listen(port, "127.0.0.1", () => console.log(`http://localhost:${port}`));
}
