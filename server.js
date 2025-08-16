const BACKEND_URL = "https://oddones-backend.onrender.com"; // replace with your actual Render URL

const messagesContainer = document.getElementById("messages");
const chatForm = document.getElementById("chat-form");
const input = document.getElementById("message-input");

let awaitingWallet = false;
let lastValidCode = null;

// Welcome message
typeMessage("ai", "👾 Yo misfit, welcome to Oddones. Got a code, or wanna talk chaos?");

// 🟢 Append static messages
function appendMessage(sender, text) {
  const div = document.createElement("div");
  div.className = `msg ${sender}`;
  div.textContent = text;
  messagesContainer.appendChild(div);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// 🟢 Typing effect for messages
function typeMessage(sender, text, speed = 25) {
  const div = document.createElement("div");
  div.className = `msg ${sender}`;
  messagesContainer.appendChild(div);

  let i = 0;
  function typeChar() {
    if (i < text.length) {
      div.textContent += text.charAt(i);
      i++;
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      setTimeout(typeChar, speed);
    }
  }
  typeChar();
}

// 🟢 Check for whitelist code format
function isWhitelistCode(message) {
  return /^ODD-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(message.trim());
}

// 🟢 Check for valid Hyperliquid wallet (0x + 40 hex chars)
function isValidWallet(wallet) {
  return /^0x[a-fA-F0-9]{40}$/.test(wallet.trim());
}

// 🟢 Handle chat input
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

  if (isWhitelistCode(userMessage)) {
    handleWhitelistCode(userMessage.toUpperCase());
    return;
  }

  await sendToAI(userMessage);
});

// 🟢 Step 1: Validate Code
async function handleWhitelistCode(code) {
  typeMessage("ai", "🔍 Checking your code...");

  try {
    const res = await fetch(`${BACKEND_URL}/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code })
    });

    const data = await res.json();

    if (data.success) {
      typeMessage("ai", "🎉 Code’s legit. Now drop your wallet, champ.");
      awaitingWallet = true;
      lastValidCode = code;
    } else {
      typeMessage("ai", `❌ Nope. ${data.message}`);
    }
  } catch (err) {
    console.error(err);
    typeMessage("ai", "❌ Server’s having a meltdown. Try later.");
  }
}

// 🟢 Step 2: Submit Wallet to Claim
async function handleWalletSubmission(wallet) {
  if (!isValidWallet(wallet)) {
    typeMessage("ai", "❌ Nah, that ain’t a real Hyperliquid wallet (needs 0x + 40 hex). Try again.");
    return;
  }

  typeMessage("ai", "💾 Plugging your wallet into the chaos...");

  try {
    const res = await fetch(`${BACKEND_URL}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: lastValidCode, wallet })
    });

    const data = await res.json();

    if (data.success) {
      typeMessage("ai", "✅ Locked in. You’re officially Odd now.");
      awaitingWallet = false;
      lastValidCode = null;
    } else {
      typeMessage("ai", `❌ ${data.message}`);
    }
  } catch (err) {
    console.error(err);
    typeMessage("ai", "❌ Glitch in the matrix. Try again later.");
  }
}

// 🟢 AI Chat
async function sendToAI(userMessage) {
  const typingIndicator = document.createElement("div");
  typingIndicator.className = "msg ai";
  typingIndicator.textContent = "OddBot AI is typing...";
  messagesContainer.appendChild(typingIndicator);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  try {
    const resp = await fetch(`${BACKEND_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userMessage })
    });

    const data = await resp.json();
    typingIndicator.remove();

    if (!data.success) {
      typeMessage("ai", "❌ Bot glitched. Ping me later.");
      return;
    }

    const reply = data.reply || "🤖 Static noise... ask again?";
    if (/bitcoin|politics|sports/i.test(userMessage)) {
      typeMessage("ai", "😂 Wrong channel, legend. We only talk Oddones here.");
    } else {
      typeMessage("ai", reply);
    }
  } catch (err) {
    typingIndicator.remove();
    console.error(err);
    typeMessage("ai", "❌ Bot’s out cold. Try again later.");
  }
}
