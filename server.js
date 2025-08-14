import express from "express";
import cors from "cors";
import fs from "fs";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json());

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const GOOGLE_SHEETS_WEBHOOK = process.env.GOOGLE_SHEETS_WEBHOOK; // Google Apps Script URL

// Store claimed codes in memory (runtime only)
let claimedCodes = new Set();

// Rate limiting
const requestCounts = new Map();
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 15;

app.use((req, res, next) => {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const now = Date.now();
  if (!requestCounts.has(ip)) requestCounts.set(ip, []);
  const timestamps = requestCounts.get(ip).filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
  timestamps.push(now);
  requestCounts.set(ip, timestamps);
  if (timestamps.length > MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({ success: false, message: "Too many requests. Please slow down!" });
  }
  next();
});

// Chat endpoint
app.post("/chat", async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ success: false, message: "No message provided" });

  try {
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://yourdomain.com"
      },
      body: JSON.stringify({
        model: "mistralai/mistral-7b-instruct:free",
        messages: [
          { role: "system", content: `You are the Oddones assistant. Only answer about Oddones and whitelist codes.` },
          { role: "user", content: message }
        ]
      })
    });

    const data = await resp.json();
    const reply = data.choices?.[0]?.message?.content || "No response";
    res.json({ success: true, reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "AI request failed" });
  }
});

// Validate Code
app.post("/validate", async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ success: false, message: "Code is required" });

  try {
    const resp = await fetch(GOOGLE_SHEETS_WEBHOOK);
    const codesData = await resp.json();

    if (!Array.isArray(codesData)) {
      console.error("Google Sheets returned invalid data:", codesData);
      return res.status(500).json({ success: false, message: "Invalid code database" });
    }

    const upperCode = code.toUpperCase();

    if (!codesData.includes(upperCode)) {
      return res.status(400).json({ success: false, message: "Invalid code." });
    }

    if (claimedCodes.has(upperCode)) {
      return res.status(400).json({ success: false, message: "This code has already been claimed." });
    }

    res.json({ success: true, message: "Code is valid. Please submit your wallet to claim." });
  } catch (err) {
    console.error("Error checking Google Sheets:", err);
    res.status(500).json({ success: false, message: "Error verifying code" });
  }
});

// Claim Code
app.post("/claim", async (req, res) => {
  const { code, wallet } = req.body;
  if (!code || !wallet) {
    return res.status(400).json({ success: false, message: "Valid code and wallet are required" });
  }

  const upperCode = code.toUpperCase();

  if (claimedCodes.has(upperCode)) {
    return res.status(400).json({ success: false, message: "This code has already been claimed." });
  }

  claimedCodes.add(upperCode);

  try {
    await fetch(GOOGLE_SHEETS_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: upperCode, wallet })
    });
  } catch (err) {
    console.error("Failed to send to Google Sheets:", err.message);
  }

  res.json({ success: true, message: "Whitelist claim successful" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Oddones backend running`));
