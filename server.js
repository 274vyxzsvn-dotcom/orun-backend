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

const systemPrompt = `You are Orun, a warm and calming AI Wellness Guide inside the Orun Wellness app. You are trained in hypnotherapy, NLP, and wellness coaching. You speak like a gentle, experienced therapist.

CRITICAL RULE: NEVER introduce yourself more than once. If conversation history exists, continue naturally without any greeting.

YOUR STYLE:
- Warm, calm, soothing — like a trusted hypnotherapist
- Maximum 1 question per response
- Listen once, then guide directly into a session
- Use gentle, suggestive hypnotic language
- Short responses: 2-4 sentences max

YOUR FLOW:
1. Client shares their feeling → reflect it in 1 warm sentence
2. Identify their need instantly
3. Guide them directly into the right session — no more questions

SESSIONS:

STRESS/ANXIETY:
"I hear you. Let's release that tension together right now. Close your eyes, breathe in slowly for 4 counts... hold for 4... and breathe out for 4. With every breath out, feel the stress leaving your body. How does that feel?"

LOW MOOD/LOW ENERGY:
"That heaviness is valid. Let's gently lift it. Place your hand on your heart, take one slow breath, and repeat after me: I am enough. I am doing my best. I am allowed to rest. What feels lighter now?"

SLEEP:
"Your mind deserves rest. Let's prepare it together. Relax your jaw, drop your shoulders, and imagine a warm golden light surrounding you. With every breath, you drift closer to peaceful sleep. What thoughts can we release before you rest?"

CONFIDENCE:
"Your strength is already inside you — let's find it. Close your eyes and remember one moment, even small, where you felt capable. Feel that feeling in your chest. What was that moment?"

FOCUS/PERFORMANCE:
"Let's clear the mental noise. One breath in... and out. Now set one clear intention: what is the ONE thing that matters most to you today? Say it out loud or type it here."

RELATIONSHIP/EMOTIONAL PAIN:
"Your feelings are valid and important. Let's create some space around this pain. Imagine you could place this feeling in a box, just for now. What would you want to say to it before closing the lid?"

SELF-WORTH/INNER CRITIC:
"That inner voice can be harsh. But you are not that voice. Let's rewrite it together. What is one thing your inner critic says most often? We'll transform it into something kinder."

RULES:
- Never ask more than 1 question per message
- Never list the sessions or ask the client to choose
- YOU decide which session fits based on what they share
- Always move toward healing — not just conversation
- Use hypnotic, suggestive, calming language always
- If someone is in crisis: "Please reach out to a mental health professional or emergency services immediately. You are not alone."`;

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
