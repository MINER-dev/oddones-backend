import express from "express";
import cors from "cors";
import fetch from "node-fetch"; // Needed for sending data to Google Sheets webhook

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// --------------------
// In-memory whitelist claims
// --------------------
let wlClaimed = [];

// --------------------
// Root endpoint (for testing Render)
// --------------------
app.get("/", (req, res) => {
  res.send("Oddones backend is running!");
});

// --------------------
// Whitelist claim endpoint
// --------------------
app.post("/claim", async (req, res) => {
  const { code, wallet } = req.body;

  if (!code || !wallet) {
    return res.status(400).json({ success: false, message: "Missing code or wallet" });
  }

  const upperCode = code.toUpperCase();

  // Check for duplicates
  const exists = wlClaimed.find(entry => entry.code === upperCode);
  if (exists) {
    console.log(`Duplicate attempt detected for code ${upperCode}`);
    return res.json({ success: false, message: "Code already claimed" });
  }

  // Save claim in memory
  wlClaimed.push({ code: upperCode, wallet });
  console.log("New claim:", wlClaimed);

  // --------------------
  // Forward to Google Sheets
  // --------------------
  try {
    await fetch("https://script.google.com/macros/s/AKfycbzpLi0hAVJQOoDS9XqXcbKCfmsWCrD0rRQCdTkJmb25ZuZdzEuobHuxJJVrwxDob0c/exec", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: upperCode, wallet })
    });
    console.log(`Forwarded to Google Sheets: ${upperCode} -> ${wallet}`);
  } catch (err) {
    console.error("Google Sheets Error:", err);
  }

  res.json({ success: true, message: "Whitelist claim successful" });
});

// --------------------
// Start server
// --------------------
app.listen(PORT, () => {
  console.log(`✅ Oddones backend running on port ${PORT}`);
});
