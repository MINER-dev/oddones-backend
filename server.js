const BACKEND_URL = "https://oddones-backend.onrender.com"; // replace with your actual Render URL

const messagesContainer = document.getElementById("messages");
const chatForm = document.getElementById("chat-form");
const input = document.getElementById("message-input");

let awaitingWallet = false;
let lastValidCode = null;

// Welcome message
appendMessage("ai", "👾 Welcome to Oddones Portal! Do you have a secret code for me to decipher? Enter code or ask me anything about Oddones");

function appendMessage(sender, text) {
  const div = document.createElement("div");
  div.className = `msg ${sender}`;
  div.textContent = text;
  messagesContainer.appendChild(div);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const userMessage = input.value.trim();
  if (!userMessage) return;

  appendMessage("user", userMessage);
  input.value = "";

  if (awaitingWallet) {
    handleWalletSubmission(userMessage);
    return;
  }

  // Always send to backend for validation
  if (userMessage.toUpperCase().startsWith("ODD-")) {
    handleWhitelistCode(userMessage.toUpperCase());
    return;
  }

  await sendToAI(userMessage);
});

// Step 1: Validate Code
async function handleWhitelistCode(code) {
  appendMessage("ai", "🔍 Deciphering your code...");

  try {
    const res = await fetch(`${BACKEND_URL}/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code })
    });

    const data = await res.json();

    if (data.success) {
      appendMessage("ai", "🎉 Code accepted! Drop your wallet address and I’ll plug you in.");
      awaitingWallet = true;
      lastValidCode = code;
    } else {
      appendMessage("ai", `❌ ${data.message}`);
    }
  } catch (err) {
    console.error(err);
    appendMessage("ai", "❌ Error verifying your code. Try again later.");
  }
}

// Step 2: Submit Wallet to Claim
async function handleWalletSubmission(wallet) {
  appendMessage("ai", "💾 Processing your wallet...");

  try {
    const res = await fetch(`${BACKEND_URL}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: lastValidCode, wallet })
    });

    const data = await res.json();

    if (data.success) {
      appendMessage("ai", "✅ Whitelist locked. You're officially one of the OddOnes!");
      awaitingWallet = false;
      lastValidCode = null;
    } else {
      appendMessage("ai", `❌ ${data.message}`);
    }
  } catch (err) {
    console.error(err);
    appendMessage("ai", "❌ Error saving wallet. Try again later.");
  }
}

// AI Chat
async function sendToAI(userMessage) {
  try {
    const resp = await fetch(`${BACKEND_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userMessage })
    });

    const data = await resp.json();
    appendMessage("ai", data.reply || "🤖 I’m lost in the void. Try again?");
  } catch (err) {
    console.error(err);
    appendMessage("ai", "❌ The AI is sleeping. Come back in a moment.");
  }
}
