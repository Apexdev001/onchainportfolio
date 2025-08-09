import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.8.0/dist/ethers.esm.min.js";

const connectWalletBtn = document.getElementById("connectWalletBtn");
const statusDot = document.getElementById("statusDot");

const BASE_SEPOLIA_CHAIN_ID = 84531; // Confirm this matches Base Sepolia chainId

let provider;
let signer;
let userAddress = null;

export async function connectWallet() {
  if (!window.ethereum) {
    showNotification("MetaMask not found. Please install it.", "error");
    setStatus("no-metamask");
    return null;
  }

  try {
    setStatus("connecting");
    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    userAddress = await signer.getAddress();
    sessionStorage.setItem("connectedAddress", userAddress);

    const chainId = await getChainId();
    if (chainId !== BASE_SEPOLIA_CHAIN_ID) {
      await promptNetworkSwitch();
    }

    setStatus("connected");
    updateConnectBtn(userAddress);
    setupListeners();

    return userAddress;
  } catch (err) {
    console.error("Wallet connection error:", err);
    setStatus("disconnected");
    showNotification("Connection failed or rejected", "error");
    return null;
  }
}

async function getChainId() {
  try {
    const network = await provider.getNetwork();
    return network.chainId;
  } catch {
    return null;
  }
}

async function promptNetworkSwitch() {
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x14977" }], // hex for 84531
    });
    showNotification("Switched to Base Sepolia network", "success");
  } catch (switchError) {
    showNotification("Please switch to Base Sepolia network", "error");
    setStatus("error");
  }
}

function updateConnectBtn(address) {
  if (!address) {
    connectWalletBtn.textContent = "Connect Wallet";
  } else {
    const truncated = address.slice(0, 6) + "..." + address.slice(-4);
    connectWalletBtn.textContent = truncated;
  }
}

function setStatus(status) {
  statusDot.className = "";
  switch (status) {
    case "connecting":
      statusDot.classList.add("status-connecting");
      break;
    case "connected":
      statusDot.classList.add("status-connected");
      break;
    case "disconnected":
      statusDot.classList.add("status-disconnected");
      break;
    case "error":
      statusDot.classList.add("status-error");
      break;
    case "no-metamask":
      statusDot.classList.add("status-no-metamask");
      break;
    default:
      break;
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

function setupListeners() {
  window.ethereum.on("accountsChanged", (accounts) => {
    if (accounts.length === 0) {
      userAddress = null;
      updateConnectBtn(null);
      setStatus("disconnected");
      showNotification("Wallet disconnected", "warning");
    } else {
      userAddress = accounts[0];
      sessionStorage.setItem("connectedAddress", userAddress);
      updateConnectBtn(userAddress);
      setStatus("connected");
      showNotification("Account changed", "info");
      // Reload achievements for new user
      window.dispatchEvent(new CustomEvent("accountChanged", { detail: userAddress }));
    }
  });

  window.ethereum.on("chainChanged", (chainId) => {
    if (parseInt(chainId, 16) !== BASE_SEPOLIA_CHAIN_ID) {
      promptNetworkSwitch();
      setStatus("error");
      showNotification("Please switch to Base Sepolia network", "error");
    } else {
      setStatus("connected");
      showNotification("Network changed to Base Sepolia", "success");
      // Possibly refresh data
      window.dispatchEvent(new Event("networkChanged"));
    }
  });
}

// Export helpers to get provider, signer, address
export function getProvider() {
  return provider;
}
export function getSigner() {
  return signer;
}
export function getUserAddress() {
  return userAddress;
}

// Attach connect button click
connectWalletBtn.addEventListener("click", async () => {
  if (!userAddress) {
    await connectWallet();
  } else {
    // Already connected — maybe copy address?
    navigator.clipboard.writeText(userAddress);
    showNotification("Wallet address copied!", "success");
  }
});

// Initialize on page load: try to restore session
export async function initWallet() {
  if (window.ethereum) {
    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner().catch(() => null);
    userAddress = sessionStorage.getItem("connectedAddress");
    if (userAddress) {
      updateConnectBtn(userAddress);
      setStatus("connected");
      setupListeners();
    } else {
      setStatus("disconnected");
    }
  } else {
    setStatus("no-metamask");
  }
}
