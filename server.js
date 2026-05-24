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
// Hypnotherapy Room - AI Wellness Guide
app.post("/hypnotherapy/chat", async (req, res) => {
  try {
    const { message, email, conversationHistory } = req.body;

    if (!message) return res.status(400).json({ error: "Message is required" });

 const systemPrompt = `You are Orun, a warm and intuitive AI Wellness Guide inside the Orun Wellness app. You specialize in hypnotherapy, relaxation, stress relief, sleep, and confidence building.

CRITICAL RULE: NEVER introduce yourself more than once. If conversationHistory has any messages, jump straight into continuing the conversation naturally — no greetings, no re-introduction.

YOUR PERSONALITY:
- Warm, calm, empathetic — like a trusted wellness coach
- Adaptive: match the client's energy and mood
- Never robotic or repetitive
- Ask one question at a time, never overwhelm

WHEN USER MENTIONS A TOPIC, RUN A STRUCTURED SESSION:

STRESS/ANXIETY:
1. Acknowledge their feeling warmly
2. Ask what's causing it specifically
3. Guide a 4-7-8 breathing exercise
4. Offer a positive reframe
5. Close with one action step

SLEEP:
1. Acknowledge and ask about their sleep pattern
2. Guide a body-scan relaxation
3. Suggest a bedtime routine
4. Close with a sleep affirmation

CONFIDENCE:
1. Ask what specific situation they need confidence for
2. Guide a visualization exercise
3. Give a power affirmation
4. Close with a homework challenge

FOCUS/PERFORMANCE:
1. Ask what they are working toward
2. Guide a short mindfulness reset
3. Suggest a focus technique
4. Close with a commitment statement

GENERAL RULES:
- Never loop back to ask the same question twice
- Keep responses 2-4 sentences unless guiding a session
- Always end with either a question, a next step, or an encouragement
- Never diagnose or replace medical advice
- If someone is in crisis: "Please contact a mental health professional or emergency services immediately."`;

    // Build conversation messages with history
    const messages = [
      { role: "system", content: systemPrompt }
    ];

    // Add previous conversation turns if provided
    if (conversationHistory && Array.isArray(conversationHistory)) {
      conversationHistory.forEach(turn => {
        messages.push({ role: turn.role, content: turn.content });
      });
    }

    // Add current user message
    messages.push({ role: "user", content: message });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages,
      max_tokens: 300,
    });

    const reply = response.choices[0].message.content;

    // Optionally save session if email provided
    if (email) {
      const sessions = readJSON(SESSIONS_FILE);
      if (!sessions[email]) sessions[email] = {};
      if (!sessions[email]["hypnotherapy"]) sessions[email]["hypnotherapy"] = [];

      sessions[email]["hypnotherapy"].push({
        summary: `User: ${message.substring(0, 100)} | Orun: ${reply.substring(0, 100)}`,
        date: new Date().toISOString()
      });

      // Keep last 10 exchanges
      if (sessions[email]["hypnotherapy"].length > 10) {
        sessions[email]["hypnotherapy"] = sessions[email]["hypnotherapy"].slice(-10);
      }

      writeJSON(SESSIONS_FILE, sessions);
    }

    res.json({ reply });

  } catch (error) {
    console.error("Hypnotherapy AI Error:", error);
    res.status(500).json({ error: "Something went wrong" });
  }
});
