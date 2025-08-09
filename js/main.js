import { connectWallet, getProvider, getSigner, getUserAddress, initWallet } from "./wallet.js";

const contractAddress = "<0x23164e2993792d635e679f06b53cb881461f8e78>"; // Replace with deployed contract address
const contractABI = [
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "title",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "description",
        "type": "string"
      }
    ],
    "name": "addAchievement",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      }
    ],
    "name": "getAchievements",
    "outputs": [
      {
        "components": [
          {
            "internalType": "string",
            "name": "title",
            "type": "string"
          },
          {
            "internalType": "string",
            "name": "description",
            "type": "string"
          },
          {
            "internalType": "uint256",
            "name": "timestamp",
            "type": "uint256"
          }
        ],
        "internalType": "struct OnChainPortfolio.Achievement[]",
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      }
    ],
    "name": "getAchievementCount",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalUsers",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalAchievements",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalTxns",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

const achievementsList = document.getElementById("achievementsList");
const addAchievementBtn = document.getElementById("addAchievementBtn");
const modalAddAchievement = document.getElementById("modalAddAchievement");
const achievementForm = document.getElementById("achievementForm");
const closeModalBtn = document.getElementById("closeModalBtn");
const totalUsersSpan = document.getElementById("totalUsers");
const totalAchievementsSpan = document.getElementById("totalAchievements");
const totalTxnsSpan = document.getElementById("totalTxns");
const sharePortfolioBtn = document.getElementById("sharePortfolioBtn");

let contract;
let currentUserAddress;
let achievementsCache = [];

async function init() {
  await initWallet();
  const provider = getProvider();
  const signer = getSigner();

  if (!provider) {
    showNotification("Ethereum provider not found", "error");
    return;
  }

  contract = new ethers.Contract(contractAddress, contractABI, signer || provider);

  // Check URL for ?user=0x... param for read-only mode
  const urlParams = new URLSearchParams(window.location.search);
  const queryUser = urlParams.get("user");

  if (queryUser && ethers.isAddress(queryUser)) {
    currentUserAddress = queryUser.toLowerCase();
    addAchievementBtn.disabled = true; // Read-only mode disables adding
    addAchievementBtn.title = "Adding achievements disabled in read-only mode";
  } else {
    currentUserAddress = getUserAddress();
  }

  if (!currentUserAddress) {
    showNotification("Connect your wallet to view achievements", "warning");
  }

  await fetchAndRenderAchievements();
  await fetchGlobalStats();

  // Event listeners
  addAchievementBtn.addEventListener("click", openModal);
  closeModalBtn.addEventListener("click", closeModal);
  achievementForm.addEventListener("submit", onAddAchievement);
  sharePortfolioBtn.addEventListener("click", onSharePortfolio);

  // Listen to wallet/account/network changes
  window.addEventListener("accountChanged", async (e) => {
    currentUserAddress = e.detail;
    await fetchAndRenderAchievements();
  });

  window.addEventListener("networkChanged", async () => {
    await fetchGlobalStats();
  });

  // Keyboard accessibility for modal close ESC
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modalAddAchievement.hasAttribute("hidden")) {
      closeModal();
    }
  });
}

function openModal() {
  modalAddAchievement.removeAttribute("hidden");
  modalAddAchievement.querySelector("input, textarea").focus();
}

function closeModal() {
  modalAddAchievement.setAttribute("hidden", "");
  achievementForm.reset();
}

async function onAddAchievement(e) {
  e.preventDefault();
  if (!currentUserAddress) {
    showNotification("Connect your wallet to add achievements", "error");
    closeModal();
    return;
  }
  const title = achievementForm.title.value.trim();
  const description = achievementForm.description.value.trim();

  if (!title || !description) {
    showNotification("Please fill all fields", "warning");
    return;
  }

  try {
    showNotification("Sending transaction...", "info");
    const tx = await contract.addAchievement(title, description);
    await tx.wait();

    showNotification("Achievement added!", "success");
    closeModal();
    await fetchAndRenderAchievements();
    await fetchGlobalStats();
  } catch (error) {
    console.error("Add achievement error:", error);
    showNotification("Transaction failed or rejected", "error");
  }
}

async function fetchAndRenderAchievements() {
  if (!currentUserAddress) {
    achievementsList.innerHTML = "<p>Please connect your wallet or provide a user address in URL.</p>";
    return;
  }

  achievementsList.innerHTML = "<p>Loading achievements...</p>";

  try {
    achievementsCache = await contract.getAchievements(currentUserAddress);
    if (achievementsCache.length === 0) {
      achievementsList.innerHTML = "<p>No achievements found.</p>";
      return;
    }

    achievementsList.innerHTML = "";
    achievementsCache.forEach((ach) => {
      const card = createAchievementCard(ach);
      achievementsList.appendChild(card);
    });
  } catch (error) {
    console.error("Fetch achievements failed:", error);
    achievementsList.innerHTML = "<p>Error loading achievements.</p>";
  }
}

function createAchievementCard(achievement) {
  const card = document.createElement("article");
  card.className = "achievement-card";
  card.tabIndex = 0;
  card.setAttribute("role", "group");
  card.setAttribute("aria-label", `Achievement titled ${achievement.title}`);

  const title = document.createElement("h3");
  title.className = "achievement-title";
  title.textContent = achievement.title;

  const desc = document.createElement("p");
  desc.className = "achievement-description";
  desc.textContent = achievement.description;

  const ts = document.createElement("time");
  ts.className = "achievement-timestamp";
  ts.dateTime = new Date(achievement.timestamp * 1000).toISOString();
  ts.textContent = new Date(achievement.timestamp * 1000).toLocaleString();

  card.append(title, desc, ts);

  return card;
}

async function fetchGlobalStats() {
  try {
    const [users, achs, txns] = await Promise.all([
      contract.totalUsers(),
      contract.totalAchievements(),
      contract.totalTxns(),
    ]);
    totalUsersSpan.textContent = users.toString();
    totalAchievementsSpan.textContent = achs.toString();
    totalTxnsSpan.textContent = txns.toString();
  } catch (error) {
    console.error("Fetch global stats failed:", error);
    totalUsersSpan.textContent = "?";
    totalAchievementsSpan.textContent = "?";
    totalTxnsSpan.textContent = "?";
  }
}

function showNotification(message, type = "info") {
  const notif = document.getElementById("notification");
  notif.textContent = message;
  notif.style.backgroundColor = {
    success: "var(--color-primary)",
    error: "crimson",
    warning: "orange",
    info: "gray",
  }[type] || "gray";

  notif.classList.add("show");
  notif.hidden = false;
  clearTimeout(window.notificationTimeout);
  window.notificationTimeout = setTimeout(() => {
    notif.classList.remove("show");
    notif.hidden = true;
  }, 4000);
}

function onSharePortfolio() {
  const baseURL = window.location.origin + window.location.pathname;
  let shareURL;

  if (currentUserAddress) {
    shareURL = `${baseURL}?user=${currentUserAddress}`;
  } else {
    shareURL = baseURL;
  }

  navigator.clipboard.writeText(shareURL).then(() => {
    showNotification("Portfolio URL copied to clipboard!", "success");
  }).catch(() => {
    showNotification("Failed to copy URL", "error");
  });
}

// Initialize app
init();
