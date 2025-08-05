const express = require("express");
const cors = require("cors");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Temporary in-memory whitelist claims
let wlClaimed = [];

// POST endpoint to claim whitelist
app.post("/claim", (req, res) => {
  const { code, wallet } = req.body;

  if (!code || !wallet) {
    return res.status(400).json({ success: false, message: "Missing code or wallet" });
  }

  // Check if already claimed
  const exists = wlClaimed.find(entry => entry.code === code.toUpperCase());
  if (exists) {
    return res.json({ success: false, message: "Code already claimed" });
  }

  // Save claim
  wlClaimed.push({ code: code.toUpperCase(), wallet });
  console.log("New claim:", wlClaimed);

  res.json({ success: true, message: "Whitelist claim successful" });
});

// GET endpoint to check server
app.get("/", (req, res) => res.send("Oddones backend is running!"));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
