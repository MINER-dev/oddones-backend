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

// 🔹 Load whitelist codes from file
const whitelist = new Set(
  fs.readFileSync("whitelist_codes.txt", "utf8")
    .split("\n")
    .map(c => c.trim())
    .filter(Boolean)
);

// 🔹 Load claimed codes from JSON file
const CLAIMED_CODES_FILE = "claimed_codes.json";
let claimedCodes = new Set();

if (fs.existsSync(CLAIMED_CODES_FILE)) {
  try {
    const data = JSON.parse(fs.readFileSync(CLAIMED_CODES_FILE, "utf8"));
    claimedCodes = new Set(data);
  } catch (err) {
    console.error("⚠️ Failed to load claimed codes file:", err.message);
  }
}

// 🔹 Save claimed codes to file
function saveClaimedCodes() {
  fs.writeFileSync(CLAIMED_CODES_FILE, JSON.stringify([...claimedCodes], null, 2));
}

// 🔹 Rate Limiting
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

// 🟢 Step 1: Validate Code
app.post("/validate", (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ success: false, message: "Code is required" });

  const upperCode = code.toUpperCase();

  if (!whitelist.has(upperCode)) {
    return res.status(400).json({ success: false, message: "Invalid code." });
  }

  if (claimedCodes.has(upperCode)) {
    return res.status(400).json({ success: false, message: "This code has already been claimed." });
  }

  res.json({ success: true, message: "Code is valid. Please submit your wallet to claim." });
});

// 🟢 Step 2: Claim Code with Wallet
app.post("/claim", async (req, res) => {
  const { code, wallet } = req.body;
  if (!code || !wallet || wallet === "pending") {
    return res.status(400).json({ success: false, message: "Valid code and wallet are required" });
  }

  const upperCode = code.toUpperCase();

  if (!whitelist.has(upperCode)) {
    return res.status(400).json({ success: false, message: "Invalid code." });
  }

  if (claimedCodes.has(upperCode)) {
    return res.status(400).json({ success: false, message: "This code has already been claimed." });
  }

  // ✅ Claim now
  claimedCodes.add(upperCode);
  saveClaimedCodes();

  // ✅ Forward to Google Sheets (but don’t fail if Sheets is down)
  try {
    if (GOOGLE_SHEETS_WEBHOOK) {
      await fetch(GOOGLE_SHEETS_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: upperCode, wallet, timestamp: new Date().toISOString() })
      });
    }
  } catch (err) {
    console.error("⚠️ Failed to send to Google Sheets:", err.message);
  }

  console.log("✅ New claim:", { code: upperCode, wallet });
  res.json({ success: true, message: "Whitelist claim successful" });
});

// Render Port Handling
const PORT = process.env.PORT || 3000;
// 🟢 Debug: Check claimed codes
app.get("/debug/claimed", (req, res) => {
  res.json([...claimedCodes]);
});

app.listen(PORT, () =>
  console.log(`✅ Oddones backend running with ${whitelist.size} whitelist codes and ${claimedCodes.size} claimed codes`)
);
