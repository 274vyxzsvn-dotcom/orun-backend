
const express = require("express");
const OpenAI = require("openai");

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  express.text({ type: '*/*' })(req, res, (err) => {
    if (!err && typeof req.body === 'string') {
      try { req.body = JSON.parse(req.body); } catch(e) {}
    }
    next();
  });
});
app.use(express.urlencoded({ extended: true }));
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const PORT = 3000;

app.get("/", (req, res) => {
  res.send("Orun Backend is Running 🚀");
});

app.post("/test", (req, res) => {
  console.log("Received:", req.body);
  res.json({
    message: "Data received successfully",
    data: req.body,
  });
});

app.post("/ai/test", async (req, res) => {
  try {
    let body = req.body;
if (typeof body === 'string') {
  body = JSON.parse(body);
}
const { message, systemPrompt } = body;    console.log("Body received:", JSON.stringify(req.body));    const systemMessage = systemPrompt || "You are a professional stress wellness assistant.";
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: message },
      ]
    });
    res.json({ reply: response.choices[0].message.content });
  } catch (error) {
    console.error("AI Error:", error);
    res.status(500).json({ error: "Something went wrong" });
  }
});
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
