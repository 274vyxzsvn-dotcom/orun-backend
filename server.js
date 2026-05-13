
const express = require("express");
const OpenAI = require("openai");

const app = express();
app.use(express.json());

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
    const { message, systemPrompt } = req.body;
    
    const systemMessage = systemPrompt || "You are a professional stress wellness assistant.";
    
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
