import express from "express";
import cors from "cors";
import fs from "fs";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json());

// 🔹 Environment Variables (set in Render)
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const GOOGLE_SHEETS_WEBHOOK = process.env.GOOGLE_SHEETS_WEBHOOK;

// 🔹 Load whitelist codes from file (still here if you want it for backup)
const whitelist = new Set(
  fs.readFileSync("whitelist_codes.txt", "utf8")
    .split("\n")
    .map(c => c.trim())
    .filter(Boolean)
);

// 🔹 Rate Limiting to prevent abuse
const requestCounts = new Map();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 15;

app.use((req, res, next) => {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const now = Date.now();

  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, []);
  }

  const timestamps = requestCounts.get(ip).filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
  timestamps.push(now);
  requestCounts.set(ip, timestamps);

  if (timestamps.length > MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({ success: false, message: "Too many requests. Please slow down!" });
  }

  next();
});

// 🟢 AI Chat Proxy
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
          {
            role: "system",
            content: `You are the Oddones assistant. Only answer about Oddones and whitelist codes.
                      If asked off-topic, reply sarcastically and redirect to Oddones. Keep responses short and witty.`
          },
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

// 🟢 Step 1: Validate Code (Google Sheets)
app.post("/validate", async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ success: false, message: "Code is required" });

  const upperCode = code.toUpperCase();

  try {
    // Fetch all codes from Google Sheets
    const sheetResp = await fetch(`${GOOGLE_SHEETS_WEBHOOK}?type=fetch`);
    const codesData = await sheetResp.json(); // Expect [{code:"...", status:"UNUSED"}, ...]

    const foundCode = codesData.find(row => row.code === upperCode);

    if (!foundCode) {
      return res.status(400).json({ success: false, message: "Invalid code." });
    }

    if (foundCode.status === "USED") {
      return res.status(400).json({ success: false, message: "This code has already been claimed." });
    }

    res.json({ success: true, message: "Code is valid. Please submit your wallet to claim." });
  } catch (err) {
    console.error("Error checking Google Sheets:", err);
    res.status(500).json({ success: false, message: "Error verifying code." });
  }
});

// 🟢 Step 2: Claim Code with Wallet (Google Sheets)
app.post("/claim", async (req, res) => {
  const { code, wallet } = req.body;
  if (!code || !wallet || wallet === "pending") {
    return res.status(400).json({ success: false, message: "Valid code and wallet are required" });
  }

  const upperCode = code.toUpperCase();

  try {
    // Mark code as USED in Google Sheets
    const updateResp = await fetch(GOOGLE_SHEETS_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: upperCode, wallet, status: "USED" })
    });

    const updateData = await updateResp.json();

    if (!updateData.success) {
      return res.status(400).json({ success: false, message: updateData.message || "Failed to claim code." });
    }

    console.log("New claim:", { code: upperCode, wallet });
    res.json({ success: true, message: "Whitelist claim successful" });
  } catch (err) {
    console.error("Error updating Google Sheets:", err);
    res.status(500).json({ success: false, message: "Error saving wallet." });
  }
});

// Render Port Handling
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Oddones backend running with ${whitelist.size} whitelist codes`));
