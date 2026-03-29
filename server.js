const express = require("express");
const Database = require("better-sqlite3");
const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");
const helmet = require("helmet");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || "./data/changelog-widget.db";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "change-me";
const TOKEN_SECRET = process.env.TOKEN_SECRET || "changelog-widget-secret";

// ©¤©¤ Security ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "16kb" }));

// ©¤©¤ Auth middleware ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤
function requireAuth(req, res, next) {
  const auth = req.headers["authorization"] || "";
  const token = auth.replace("Bearer ", "").trim();
  if (token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// ©¤©¤ Rate limiter ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤
const rateLimitCache = new Map();
const RATE_LIMIT_MS = parseInt(process.env.RATE_LIMIT_MS || "60000");

function isRateLimited(ip) {
  const last = rateLimitCache.get(ip);
  const now = Date.now();
  if (last && now - last < RATE_LIMIT_MS) return true;
  rateLimitCache.set(ip, now);
  return false;
}

setInterval(() => {
  const cutoff = Date.now() - RATE_LIMIT_MS;
  for (const [key, ts] of rateLimitCache) {
    if (ts < cutoff) rateLimitCache.delete(key);
  }
}, 5 * 60 * 1000);

// ©¤©¤ Token generator ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤
function makeToken(id) {
  return crypto
    .createHmac("sha256", TOKEN_SECRET)
    .update(id)
    .digest("base64url")
    .slice(0, 12);
}

// ©¤©¤ DB init ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id          TEXT PRIMARY KEY,
    token       TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL DEFAULT '',
    created_at  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS entries (
    id          TEXT PRIMARY KEY,
    project_id  TEXT NOT NULL,
    version     TEXT NOT NULL DEFAULT '',
    title       TEXT NOT NULL,
    content     TEXT NOT NULL,
    type        TEXT NOT NULL DEFAULT 'improvement',
    published_at INTEGER NOT NULL,
    created_at  INTEGER NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  );

  CREATE INDEX IF NOT EXISTS idx_entries_project_id ON entries(project_id);
  CREATE INDEX IF NOT EXISTS idx_entries_published_at ON entries(published_at);
  CREATE INDEX IF NOT EXISTS idx_projects_token ON projects(token);
`);

// ©¤©¤ Prepared statements ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤
const stmtInsertProject = db.prepare(
  "INSERT INTO projects (id, token, name, created_at) VALUES (?, ?, ?, ?)"
);
const stmtListProjects = db.prepare(
  "SELECT * FROM projects ORDER BY created_at DESC"
);
const stmtGetProjectById = db.prepare("SELECT * FROM projects WHERE id = ?");
const stmtGetProjectByToken = db.prepare("SELECT * FROM projects WHERE token = ?");
const stmtDeleteProject = db.prepare("DELETE FROM projects WHERE id = ?");

const stmtInsertEntry = db.prepare(
  "INSERT INTO entries (id, project_id, version, title, content, type, published_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
);
const stmtListEntries = db.prepare(
  "SELECT * FROM entries WHERE project_id = ? ORDER BY published_at DESC LIMIT 50"
);
const stmtGetEntry = db.prepare("SELECT * FROM entries WHERE id = ? AND project_id = ?");
const stmtDeleteEntry = db.prepare("DELETE FROM entries WHERE id = ? AND project_id = ?");
const stmtUpdateEntry = db.prepare(
  "UPDATE entries SET version=?, title=?, content=?, type=?, published_at=? WHERE id=? AND project_id=?"
);

// ©¤©¤ Helpers ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤
function validateEntry({ title, content, type }) {
  if (!title || title.length > 200) return "Title required (max 200 chars)";
  if (!content || content.length > 5000) return "Content required (max 5000 chars)";
  const validTypes = ["feature", "improvement", "fix", "security"];
  if (!validTypes.includes(type)) return "Invalid type";
  return null;
}

// ©¤©¤ Static files ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤
app.use(express.static(path.join(__dirname, "public"), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith("widget.js")) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Content-Type", "application/javascript");
    }
  }
}));

// ©¤©¤ Health ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// ©¤©¤ Projects API (protected) ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤
app.get("/api/projects", requireAuth, (_req, res) => {
  res.json(stmtListProjects.all());
});

app.post("/api/projects", requireAuth, (req, res) => {
  const { name = "" } = req.body || {};
  if (!name || name.length > 100) {
    return res.status(400).json({ error: "Name required (max 100 chars)" });
  }
  const id = uuidv4();
  const token = makeToken(id);
  stmtInsertProject.run(id, token, name, Date.now());
  res.status(201).json({ id, token, name });
});

app.delete("/api/projects/:id", requireAuth, (req, res) => {
  const project = stmtGetProjectById.get(req.params.id);
  if (!project) return res.status(404).json({ error: "Project not found" });
  db.prepare("DELETE FROM entries WHERE project_id = ?").run(req.params.id);
  stmtDeleteProject.run(req.params.id);
  res.json({ success: true });
});

// ©¤©¤ Entries API ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤
app.post("/api/projects/:id/entries", requireAuth, (req, res) => {
  const project = stmtGetProjectById.get(req.params.id);
  if (!project) return res.status(404).json({ error: "Project not found" });

  const { version = "", title, content, type = "improvement", published_at } = req.body || {};
  const err = validateEntry({ title, content, type });
  if (err) return res.status(400).json({ error: err });

  const id = uuidv4();
  const now = Date.now();
  stmtInsertEntry.run(id, project.id, version, title, content, type, published_at || now, now);
  res.status(201).json({ id, version, title, content, type });
});

app.put("/api/projects/:id/entries/:entryId", requireAuth, (req, res) => {
  const project = stmtGetProjectById.get(req.params.id);
  if (!project) return res.status(404).json({ error: "Project not found" });

  const { version = "", title, content, type = "improvement", published_at } = req.body || {};
  const err = validateEntry({ title, content, type });
  if (err) return res.status(400).json({ error: err });

  stmtUpdateEntry.run(version, title, content, type, published_at || Date.now(), req.params.entryId, project.id);
  res.json({ success: true });
});

app.delete("/api/projects/:id/entries/:entryId", requireAuth, (req, res) => {
  stmtDeleteEntry.run(req.params.entryId, req.params.id);
  res.json({ success: true });
});

// ©¤©¤ Public widget API ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤
app.get("/api/widget/:token", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
    req.socket.remoteAddress;

  if (isRateLimited(ip)) {
    return res.status(429).json({ error: "Too many requests" });
  }

  const project = stmtGetProjectByToken.get(req.params.token);
  if (!project) return res.status(404).json({ error: "Not found" });

  const entries = stmtListEntries.all(project.id);
  res.json({
    name: project.name,
    entries: entries.map(e => ({
      id: e.id,
      version: e.version,
      title: e.title,
      content: e.content,
      type: e.type,
      published_at: e.published_at,
    }))
  });
});

// ©¤©¤ Start ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤
app.listen(PORT, () => {
  console.log(`changelog-widget running on http://localhost:${PORT}`);
});

module.exports = app;