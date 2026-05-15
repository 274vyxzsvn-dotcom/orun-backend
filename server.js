const express = require("express");
const OpenAI = require("openai");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const PORT = 3000;

// File paths for storage
const USERS_FILE = path.join(__dirname, "users.json");
const SESSIONS_FILE = path.join(__dirname, "sessions.json");

// Initialize storage files if they don't exist
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, "{}");
if (!fs.existsSync(SESSIONS_FILE)) fs.writeFileSync(SESSIONS_FILE, "{}");

const readJSON = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const writeJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

// Health check
app.get("/", (req, res) => { res.send("Orun Backend is Running 🚀"); });

// Register / Login user
app.post("/auth/register", (req, res) => {
  const { email, name } = req.body;
  if (!email || !name) return res.status(400).json({ error: "Email and name required" });
  
  const users = readJSON(USERS_FILE);
  if (!users[email]) {
    users[email] = { name, email, createdAt: new Date().toISOString() };
    writeJSON(USERS_FILE, users);
    return res.json({ status: "created", user: users[email] });
  }
  res.json({ status: "existing", user: users[email] });
});

// Save session summary
app.post("/session/save", (req, res) => {
  const { email, room, summary } = req.body;
  if (!email || !room || !summary) return res.status(400).json({ error: "Missing fields" });

  const sessions = readJSON(SESSIONS_FILE);
  if (!sessions[email]) sessions[email] = {};
  if (!sessions[email][room]) sessions[email][room] = [];

  sessions[email][room].push({
    summary,
    date: new Date().toISOString()
  });

  // Keep only last 5 sessions per room
  if (sessions[email][room].length > 5) {
    sessions[email][room] = sessions[email][room].slice(-5);
  }

  writeJSON(SESSIONS_FILE, sessions);
  res.json({ status: "saved" });
});

// Load session history
app.get("/session/load", (req, res) => {
  const { email, room } = req.query;
  if (!email || !room) return res.status(400).json({ error: "Missing fields" });

  const sessions = readJSON(SESSIONS_FILE);
  const history = sessions?.[email]?.[room] || [];
  res.json({ history });
});

// AI chat with memory
app.post("/ai/test", async (req, res) => {
  try {
    const message = req.query.message;
    const systemPrompt = req.query.systemPrompt || "You are a professional wellness assistant.";
    const email = req.query.email;
    const room = req.query.room;

    console.log("Query received:", { message, email, room });

    // Load memory if user is logged in
    let memoryContext = "";
    if (email && room) {
      const sessions = readJSON(SESSIONS_FILE);
      const history = sessions?.[email]?.[room] || [];
      if (history.length > 0) {
        memoryContext = "\n\nPrevious sessions with this user:\n" +
          history.map((s, i) => `Session ${i + 1} (${s.date.split("T")[0]}): ${s.summary}`).join("\n");
      }
    }

    const fullSystemPrompt = systemPrompt + memoryContext;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: fullSystemPrompt },
        { role: "user", content: message },
      ]
    });

    res.json({ reply: response.choices[0].message.content });
  } catch (error) {
    console.error("AI Error:", error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
