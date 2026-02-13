const logBox = document.getElementById("logBox");
const bootScreen = document.getElementById("bootScreen");
const bootMessage = document.getElementById("bootMessage");
const setupScreen = document.getElementById("setupScreen");
const clientScreen = document.getElementById("clientScreen");
const setupError = document.getElementById("setupError");
const langButtons = Array.from(document.querySelectorAll(".lang-btn"));
const themeToggleButton = document.getElementById("themeToggle");
const LANG_STORAGE_KEY = "octra_webui_lang";
const THEME_STORAGE_KEY = "octra_webui_theme";
let autoRefreshTimer = null;
let currentLang = "ru";
let currentTheme = "dark";
let langAnimationTimer = null;

const translations = {
  ru: {
    "boot.title": "Подключение клиента",
    "boot.init": "Инициализация...",
    "boot.check_config": "Проверка конфигурации...",
    "boot.connect_loading": "Подключение к сети и загрузка данных...",
    "boot.create_connect": "Подключение...",
    "setup.title": "Первичная настройка кошелька",
    "setup.subtitle": "Введите private token и address.",
    "setup.private_token": "Private token",
    "setup.private_token_ph": "base64 private token",
    "setup.address": "Address",
    "setup.address_ph": "oct...",
    "setup.rpc_optional": "RPC (опционально)",
    "setup.rpc_ph": "https://octra.network",
    "setup.submit": "Войти",
    "hero.subtitle": "Приватный localhost‑интерфейс для удобной работы с кошельком",
    "actions.refresh": "Обновить",
    "actions.send": "Отправить",
    "actions.encrypt": "Encrypt",
    "actions.decrypt": "Decrypt",
    "actions.private_send": "Отправить приватно",
    "actions.claim": "Claim",
    "stats.public_balance": "Public Balance",
    "stats.encrypted_balance": "Encrypted Balance",
    "stats.nonce": "Nonce",
    "stats.pending_private": "Pending Private",
    "wallet.title": "Кошелёк",
    "wallet.address": "Адрес",
    "log.title": "Системный лог",
    "send.title": "Send Transaction",
    "send.to": "Кому",
    "send.to_ph": "oct...",
    "send.amount": "Сумма (OCT)",
    "send.message": "Сообщение (опционально)",
    "enc.title": "Encrypted Balance",
    "enc.encrypt_amount": "Сумма для Encrypt",
    "enc.decrypt_amount": "Сумма для Decrypt",
    "private.title": "Private Transfer",
    "private.to": "Кому",
    "private.to_ph": "oct...",
    "private.amount": "Сумма (OCT)",
    "claim.title": "Claim Transfers",
    "claim.none": "Нет доступных private transfer для claim",
    "claim.id": "ID",
    "claim.from": "From",
    "claim.amount": "Amount",
    "history.title": "История транзакций",
    "history.time": "Time",
    "history.type": "Type",
    "history.amount": "Amount",
    "history.from": "From",
    "history.to": "To",
    "history.epoch": "Epoch",
    "history.hash": "Hash",
    "history.empty": "Нет транзакций",
    "common.none": "—",
    "log.ui_ready": "UI готов",
    "log.state_updated": "Состояние обновлено",
    "log.update_error": "Ошибка обновления",
    "log.claim_ok": "Claim выполнен",
    "log.claim_error": "Claim ошибка",
    "log.send_ok": "Tx отправлена",
    "log.send_error": "Send ошибка",
    "log.encrypt_ok": "Encrypt выполнен на",
    "log.encrypt_error": "Encrypt ошибка",
    "log.decrypt_ok": "Decrypt выполнен на",
    "log.decrypt_error": "Decrypt ошибка",
    "log.private_ok": "Private transfer отправлен",
    "log.private_error": "Private transfer ошибка",
  },
  en: {
    "boot.title": "Connecting client",
    "boot.init": "Initialization...",
    "boot.check_config": "Checking configuration...",
    "boot.connect_loading": "Connecting to network and loading data...",
    "boot.create_connect": "Сonnecting...",
    "setup.title": "Initial wallet setup",
    "setup.subtitle": "Enter private token and address.",
    "setup.private_token": "Private token",
    "setup.private_token_ph": "base64 private token",
    "setup.address": "Address",
    "setup.address_ph": "oct...",
    "setup.rpc_optional": "RPC (optional)",
    "setup.rpc_ph": "https://octra.network",
    "setup.submit": "Enter",
    "hero.subtitle": "Private localhost interface for convenient wallet usage",
    "actions.refresh": "Refresh",
    "actions.send": "Send",
    "actions.encrypt": "Encrypt",
    "actions.decrypt": "Decrypt",
    "actions.private_send": "Send privately",
    "actions.claim": "Claim",
    "stats.public_balance": "Public Balance",
    "stats.encrypted_balance": "Encrypted Balance",
    "stats.nonce": "Nonce",
    "stats.pending_private": "Pending Private",
    "wallet.title": "Wallet",
    "wallet.address": "Address",
    "log.title": "System log",
    "send.title": "Send Transaction",
    "send.to": "Recipient",
    "send.to_ph": "oct...",
    "send.amount": "Amount (OCT)",
    "send.message": "Message (optional)",
    "enc.title": "Encrypted Balance",
    "enc.encrypt_amount": "Amount to Encrypt",
    "enc.decrypt_amount": "Amount to Decrypt",
    "private.title": "Private Transfer",
    "private.to": "Recipient",
    "private.to_ph": "oct...",
    "private.amount": "Amount (OCT)",
    "claim.title": "Claim Transfers",
    "claim.none": "No private transfers available for claim",
    "claim.id": "ID",
    "claim.from": "From",
    "claim.amount": "Amount",
    "history.title": "Transaction History",
    "history.time": "Time",
    "history.type": "Type",
    "history.amount": "Amount",
    "history.from": "From",
    "history.to": "To",
    "history.epoch": "Epoch",
    "history.hash": "Hash",
    "history.empty": "No transactions",
    "common.none": "—",
    "log.ui_ready": "UI is ready",
    "log.state_updated": "State updated",
    "log.update_error": "Update error",
    "log.claim_ok": "Claim completed",
    "log.claim_error": "Claim error",
    "log.send_ok": "Transaction sent",
    "log.send_error": "Send error",
    "log.encrypt_ok": "Encrypt completed for",
    "log.encrypt_error": "Encrypt error",
    "log.decrypt_ok": "Decrypt completed for",
    "log.decrypt_error": "Decrypt error",
    "log.private_ok": "Private transfer sent",
    "log.private_error": "Private transfer error",
  },
};

function t(key) {
  return translations[currentLang]?.[key] ?? translations.ru[key] ?? key;
}

function shortHash(value) {
  if (!value) return t("common.none");
  const text = String(value);
  if (text.length <= 20) return text;
  return `${text.slice(0, 10)}…${text.slice(-8)}`;
}

function log(message, type = "info") {
  if (!logBox) return;
  const timestamp = new Date().toLocaleTimeString();
  const prefix = type === "ok" ? "[OK]" : type === "err" ? "[ERR]" : "[INFO]";
  logBox.textContent += `${timestamp} ${prefix} ${message}\n`;
  logBox.scrollTop = logBox.scrollHeight;
}

function updateLanguageButtons() {
  langButtons.forEach((btn) => {
    const active = btn.dataset.lang === currentLang;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function updateThemeToggleButton() {
  if (!themeToggleButton) return;
  const text = currentTheme === "dark" ? "Light theme" : "Dark theme";
  themeToggleButton.textContent = text;
  themeToggleButton.setAttribute("aria-label", text);
}

function applyTheme() {
  document.documentElement.setAttribute("data-theme", currentTheme);
  document.documentElement.classList.toggle("theme-light", currentTheme === "light");
  document.documentElement.classList.toggle("theme-dark", currentTheme === "dark");
  if (document.body) {
    document.body.setAttribute("data-theme", currentTheme);
    document.body.classList.toggle("theme-light", currentTheme === "light");
    document.body.classList.toggle("theme-dark", currentTheme === "dark");
  }
  updateThemeToggleButton();
}

function setTheme(theme) {
  currentTheme = theme === "light" ? "light" : "dark";
  try {
    localStorage.setItem(THEME_STORAGE_KEY, currentTheme);
  } catch {
  }
  applyTheme();
}

function getInitialTheme() {
  let saved = null;
  try {
    saved = localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
  }
  if (saved === "dark" || saved === "light") return saved;
  return "dark";
}

function applyTranslations() {
  document.documentElement.lang = currentLang;
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    node.placeholder = t(node.dataset.i18nPlaceholder);
  });
  updateLanguageButtons();
  updateThemeToggleButton();
}

function setLanguage(lang) {
  currentLang = lang === "en" ? "en" : "ru";
  localStorage.setItem(LANG_STORAGE_KEY, currentLang);
  applyTranslations();
  animateLanguageChange();
}

function getInitialLanguage() {
  const saved = localStorage.getItem(LANG_STORAGE_KEY);
  if (saved === "ru" || saved === "en") return saved;
  return navigator.language?.toLowerCase().startsWith("ru") ? "ru" : "en";
}

function animateLanguageChange() {
  if (!document.body) return;
  document.body.classList.remove("lang-transition");
  void document.body.offsetWidth;
  document.body.classList.add("lang-transition");
  if (langAnimationTimer) {
    clearTimeout(langAnimationTimer);
  }
  langAnimationTimer = setTimeout(() => {
    document.body.classList.remove("lang-transition");
    langAnimationTimer = null;
  }, 260);
}

function animateScreen(element) {
  if (!element) return;
  element.classList.remove("screen-enter");
  void element.offsetWidth;
  element.classList.add("screen-enter");
}

function showSetupMode(enabled) {
  if (bootScreen) bootScreen.hidden = true;
  setupScreen.hidden = !enabled;
  clientScreen.hidden = enabled;
  if (enabled) animateScreen(setupScreen);
  if (!enabled) animateScreen(clientScreen);
}

function showBootMode(message) {
  if (bootScreen) bootScreen.hidden = false;
  if (bootMessage && message) bootMessage.textContent = message;
  setupScreen.hidden = true;
  clientScreen.hidden = true;
  animateScreen(bootScreen);
}

async function api(path, method = "GET", body) {
  const response = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({ ok: false, error: "invalid JSON response" }));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return data;
}

function formatAmount(value) {
  if (value === undefined || value === null) return t("common.none");
  return Number(value).toFixed(6) + " OCT";
}

function formatTs(ts) {
  if (!ts) return t("common.none");
  return new Date(ts * 1000).toLocaleString();
}

async function refreshState() {
  const [wallet, state] = await Promise.all([api("/api/wallet"), api("/api/state")]);

  document.getElementById("walletAddress").textContent = wallet.address || t("common.none");
  document.getElementById("walletRpc").textContent = wallet.rpc || t("common.none");

  const balance = state.balance || {};
  const encrypted = state.encrypted || {};
  const pending = state.pending_private || {};

  document.getElementById("publicBalance").textContent = balance.ok ? formatAmount(balance.balance) : t("common.none");
  document.getElementById("walletNonce").textContent = balance.ok ? String(balance.nonce ?? t("common.none")) : t("common.none");
  document.getElementById("encryptedBalance").textContent = encrypted.ok ? formatAmount(encrypted.encrypted) : t("common.none");
  document.getElementById("pendingCount").textContent = pending.ok ? String((pending.pending_transfers || []).length) : "0";

  renderHistory(state.history?.items || []);
  renderClaims(pending.pending_transfers || []);
}

function renderHistory(items) {
  const tbody = document.getElementById("historyBody");
  tbody.innerHTML = "";

  if (!items.length) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="7">${t("history.empty")}</td>`;
    tbody.appendChild(row);
    return;
  }

  for (const tx of items) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${formatTs(tx.timestamp)}</td>
      <td>${tx.type || t("common.none")}</td>
      <td>${formatAmount(tx.amount)}</td>
      <td><code title="${tx.from || t("common.none")}">${shortHash(tx.from)}</code></td>
      <td><code title="${tx.to || t("common.none")}">${shortHash(tx.to)}</code></td>
      <td>${tx.epoch || 0}</td>
      <td><code title="${tx.hash || t("common.none")}">${shortHash(tx.hash)}</code></td>
    `;
    tbody.appendChild(row);
  }
}

function renderClaims(items) {
  const claimList = document.getElementById("claimList");
  claimList.innerHTML = "";
  if (!items.length) {
    claimList.textContent = t("claim.none");
    return;
  }

  for (const transfer of items) {
    const box = document.createElement("div");
    box.className = "claim-item";
    const transferId = transfer.transfer_id || transfer.id || "";
    const amountRaw = Number(transfer.amount || 0);
    const amount = Number.isFinite(amountRaw) ? amountRaw / 1_000_000 : 0;
    box.innerHTML = `
      <div><strong>${t("claim.id")}:</strong> <code title="${transferId}">${shortHash(transferId)}</code></div>
      <div><strong>${t("claim.from")}:</strong> <code title="${transfer.from || t("common.none")}">${shortHash(transfer.from)}</code></div>
      <div><strong>${t("claim.amount")}:</strong> ${formatAmount(amount)}</div>
      <button class="btn">${t("actions.claim")}</button>
    `;
    const btn = box.querySelector("button");
    btn.addEventListener("click", async () => {
      try {
        await api("/api/claim", "POST", { transfer_id: transferId });
        log(`${t("log.claim_ok")}: ${shortHash(transferId)}`, "ok");
        await refreshState();
      } catch (error) {
        log(`${t("log.claim_error")}: ${error.message}`, "err");
      }
    });
    claimList.appendChild(box);
  }
}

async function doSend() {
  const to = document.getElementById("sendTo").value.trim();
  const amount = document.getElementById("sendAmount").value;
  const message = document.getElementById("sendMessage").value;
  const data = await api("/api/send", "POST", { to, amount, message });
  log(`${t("log.send_ok")}: ${shortHash(data.tx_hash || "hash unavailable")}`, "ok");
}

async function doEncrypt() {
  const amount = document.getElementById("encryptAmount").value;
  await api("/api/encrypt", "POST", { amount });
  log(`${t("log.encrypt_ok")} ${amount} OCT`, "ok");
}

async function doDecrypt() {
  const amount = document.getElementById("decryptAmount").value;
  await api("/api/decrypt", "POST", { amount });
  log(`${t("log.decrypt_ok")} ${amount} OCT`, "ok");
}

async function doPrivateTransfer() {
  const to = document.getElementById("privateTo").value.trim();
  const amount = document.getElementById("privateAmount").value;
  await api("/api/private-transfer", "POST", { to, amount });
  log(`${t("log.private_ok")}: ${amount} OCT -> ${shortHash(to)}`, "ok");
}

function startAutoRefresh() {
  if (autoRefreshTimer) return;
  autoRefreshTimer = setInterval(async () => {
    try {
      await refreshState();
    } catch {
    }
  }, 15000);
}

async function initializeUi() {
  showBootMode(t("boot.check_config"));
  const status = await api("/api/setup-status");
  if (!status.configured) {
    showSetupMode(true);
    return;
  }

  showBootMode(t("boot.connect_loading"));
  await refreshState();
  if (bootScreen) bootScreen.hidden = true;
  clientScreen.hidden = false;
  animateScreen(clientScreen);
  log(t("log.ui_ready"), "ok");
  startAutoRefresh();
}

document.getElementById("setupBtn").addEventListener("click", async () => {
  setupError.textContent = "";
  const setupBtn = document.getElementById("setupBtn");
  const priv = document.getElementById("setupPriv").value.trim();
  const addr = document.getElementById("setupAddr").value.trim();
  const rpc = document.getElementById("setupRpc").value.trim();

  try {
    setupBtn.disabled = true;
    showBootMode(t("boot.create_connect"));
    await api("/api/setup-wallet", "POST", { priv, addr, rpc });
    await initializeUi();
  } catch (error) {
    setupBtn.disabled = false;
    showSetupMode(true);
    setupError.textContent = error.message;
  }
});

document.getElementById("refreshBtn").addEventListener("click", async () => {
  try {
    await refreshState();
    log(t("log.state_updated"), "ok");
  } catch (error) {
    log(`${t("log.update_error")}: ${error.message}`, "err");
  }
});

document.getElementById("sendBtn").addEventListener("click", async () => {
  try {
    await doSend();
    await refreshState();
  } catch (error) {
    log(`${t("log.send_error")}: ${error.message}`, "err");
  }
});

document.getElementById("encryptBtn").addEventListener("click", async () => {
  try {
    await doEncrypt();
    await refreshState();
  } catch (error) {
    log(`${t("log.encrypt_error")}: ${error.message}`, "err");
  }
});

document.getElementById("decryptBtn").addEventListener("click", async () => {
  try {
    await doDecrypt();
    await refreshState();
  } catch (error) {
    log(`${t("log.decrypt_error")}: ${error.message}`, "err");
  }
});

document.getElementById("privateBtn").addEventListener("click", async () => {
  try {
    await doPrivateTransfer();
    await refreshState();
  } catch (error) {
    log(`${t("log.private_error")}: ${error.message}`, "err");
  }
});

if (themeToggleButton) {
  themeToggleButton.addEventListener("click", () => {
    setTheme(currentTheme === "dark" ? "light" : "dark");
  });
}

langButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    setLanguage(btn.dataset.lang);
    if (!clientScreen.hidden) {
      renderHistory([]);
      renderClaims([]);
      refreshState().catch(() => {
      });
    }
  });
});

(async () => {
  currentTheme = getInitialTheme();
  applyTheme();
  currentLang = getInitialLanguage();
  applyTranslations();
  try {
    await initializeUi();
  } catch (error) {
    showSetupMode(true);
    setupError.textContent = error.message;
  }
})();
