const API_BASE = "https://ygocdb.com";
const LOCAL_DATA_URL = "./data/cards.json";
const REMOTE_CARD_ZIP_URL = `${API_BASE}/api/v0/cards.zip`;
const CARD_POOL_SOURCES = [
  REMOTE_CARD_ZIP_URL,
  "http://ygocdb.com/api/v0/cards.zip",
];
const SEARCH_HISTORY_KEY = "ygo-search-history";
const AI_BINDING_KEY = "ygo-ai-binding";
const CARD_DB_NAME = "ygo-card-pool";
const CARD_DB_VERSION = 1;
const CARD_STORE_NAME = "cardPools";
const LATEST_POOL_KEY = "latest";
const MAX_SEARCH_HISTORY = 20;
const SCRIPT_SOURCES = [
  {
    label: "ProjectIgnis/CardScripts official",
    rawBase: "https://raw.githubusercontent.com/ProjectIgnis/CardScripts/master/official",
    pageBase: "https://github.com/ProjectIgnis/CardScripts/blob/master/official",
  },
  {
    label: "ProjectIgnis/CardScripts pre-release",
    rawBase: "https://raw.githubusercontent.com/ProjectIgnis/CardScripts/master/pre-release",
    pageBase: "https://github.com/ProjectIgnis/CardScripts/blob/master/pre-release",
  },
];
const MAX_RESULTS = 40;
const AI_APPS = {
  deepseek: {
    label: "DeepSeek",
    packageName: "com.deepseek.chat",
    url: "https://chat.deepseek.com/",
  },
  chatgpt: {
    label: "ChatGPT",
    packageName: "com.openai.chatgpt",
    url: "https://chatgpt.com/",
  },
  tongyi: {
    label: "通义",
    packageName: "com.aliyun.tongyi",
    url: "https://tongyi.aliyun.com/qianwen/",
  },
  gemini: {
    label: "Gemini",
    packageName: "com.google.android.apps.bard",
    url: "https://gemini.google.com/app",
  },
};

const state = {
  localCards: [],
  localReady: false,
  selected: new Map(),
};

const els = {
  dataBadge: document.querySelector("#dataBadge"),
  status: document.querySelector("#status"),
  searchForm: document.querySelector("#searchForm"),
  query: document.querySelector("#query"),
  searchHistory: document.querySelector("#searchHistory"),
  clearHistoryBtn: document.querySelector("#clearHistoryBtn"),
  results: document.querySelector("#results"),
  cardTemplate: document.querySelector("#cardTemplate"),
  loadLocalBtn: document.querySelector("#loadLocalBtn"),
  updatePoolBtn: document.querySelector("#updatePoolBtn"),
  fetchScriptsBtn: document.querySelector("#fetchScriptsBtn"),
  clearBtn: document.querySelector("#clearBtn"),
  selectedCards: document.querySelector("#selectedCards"),
  selectedCount: document.querySelector("#selectedCount"),
  scenarioPreset: document.querySelector("#scenarioPreset"),
  question: document.querySelector("#question"),
  scenario: document.querySelector("#scenario"),
  clearQuestionBtn: document.querySelector("#clearQuestionBtn"),
  clearScenarioBtn: document.querySelector("#clearScenarioBtn"),
  includeRaw: document.querySelector("#includeRaw"),
  includeScripts: document.querySelector("#includeScripts"),
  askForCitations: document.querySelector("#askForCitations"),
  buildPromptBtn: document.querySelector("#buildPromptBtn"),
  copyPromptBtn: document.querySelector("#copyPromptBtn"),
  aiBindingBadge: document.querySelector("#aiBindingBadge"),
  aiAppSelect: document.querySelector("#aiAppSelect"),
  aiPackageInput: document.querySelector("#aiPackageInput"),
  aiUrlInput: document.querySelector("#aiUrlInput"),
  copyOpenAiBtn: document.querySelector("#copyOpenAiBtn"),
  sharePromptBtn: document.querySelector("#sharePromptBtn"),
  promptOutput: document.querySelector("#promptOutput"),
  mentionSuggest: document.querySelector("#mentionSuggest"),
};

let mentionContext = null;

const SCENARIO_PRESETS = {
  "ash-called-by-rota": {
    cardNames: ["增援", "灰流丽", "墓穴的指名者"],
    question:
      "玩家 A 发动 @《增援》。玩家 B 连锁发动 @《灰流丽》，把手卡的 @《灰流丽》丢弃去墓地作为费用，试图无效 @《增援》。玩家 A 再连锁发动 @《墓穴的指名者》，以刚刚被丢弃到玩家 B 墓地的 @《灰流丽》为对象。\n\n问题：\n1. @《墓穴的指名者》能否以这只 @《灰流丽》为对象发动？\n2. 连锁逆处理后，@《灰流丽》是否还能无效 @《增援》？\n3. 最终 @《增援》能否正常从卡组把 1 只 4 星以下战士族怪兽加入手卡？",
    scenario:
      "连锁为：\nCL1：@《增援》\nCL2：@《灰流丽》\nCL3：@《墓穴的指名者》，对象为墓地的 @《灰流丽》\n\n请按 CL3 → CL2 → CL1 的顺序解释处理。",
  },
  "generic-chain": {
    question:
      "请判断以下连锁是否合法，以及连锁逆处理后每个效果是否正常适用。若某个效果被无效、对象不合法、或处理时不适用，请说明原因。",
    scenario:
      "请把连锁写成：\nCL1：\nCL2：\nCL3：\n\n并补充：当前回合玩家、场上/墓地/手卡的关键卡、是否已经适用过一回合一次限制、各效果发动时选择的对象。",
  },
  targeting: {
    question:
      "请判断该效果是否取对象，以及效果处理时对象离场、变为里侧、控制权转移、或不再满足条件时，效果是否继续处理。",
    scenario: "",
  },
};

function normalizeCard(card) {
  const text = card.text || {};
  return {
    cid: card.cid ?? "",
    id: card.id ?? "",
    cn_name: card.cn_name || card.text?.name || card.sc_name || card.md_name || "",
    sc_name: card.sc_name || "",
    md_name: card.md_name || "",
    nwbbs_n: card.nwbbs_n || "",
    cnocg_n: card.cnocg_n || "",
    jp_name: card.jp_name || "",
    jp_ruby: card.jp_ruby || "",
    en_name: card.en_name || "",
    types: text.types || "",
    pdesc: text.pdesc || "",
    desc: text.desc || "",
    data: card.data || {},
    faqcount: card.faqcount ?? "",
    script: card.script || null,
    raw: card,
  };
}

function extractCardList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.result)) return data.result;
  if (Array.isArray(data?.cards)) return data.cards;
  if (data && typeof data === "object") return Object.values(data);
  return [];
}

function applyCardPool(data, label, savedAt = "") {
  const cards = extractCardList(data);
  state.localCards = cards.map(normalizeCard);
  state.localReady = state.localCards.length > 0;
  setBadge(`${label} ${state.localCards.length}`);
  return {
    count: state.localCards.length,
    savedAt,
  };
}

function openCardDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CARD_DB_NAME, CARD_DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(CARD_STORE_NAME)) {
        request.result.createObjectStore(CARD_STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readStoredCardPool() {
  if (!("indexedDB" in window)) return null;
  const db = await openCardDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(CARD_STORE_NAME, "readonly").objectStore(CARD_STORE_NAME).get(LATEST_POOL_KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function saveStoredCardPool(jsonText) {
  if (!("indexedDB" in window)) throw new Error("当前浏览器不支持 IndexedDB，无法缓存卡池。");
  const db = await openCardDb();
  const record = {
    key: LATEST_POOL_KEY,
    savedAt: new Date().toISOString(),
    jsonText,
  };
  await new Promise((resolve, reject) => {
    const request = db.transaction(CARD_STORE_NAME, "readwrite").objectStore(CARD_STORE_NAME).put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  return record;
}

function findZipEntry(bytes, wantedName) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocdOffset = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 0xffff - 22); i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error("无法识别 cards.zip：未找到 ZIP 目录。");

  const entryCount = view.getUint16(eocdOffset + 10, true);
  let offset = view.getUint32(eocdOffset + 16, true);
  const decoder = new TextDecoder();

  for (let i = 0; i < entryCount; i += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) throw new Error("cards.zip 中央目录格式异常。");
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(bytes.slice(offset + 46, offset + 46 + nameLength));
    if (name === wantedName || name.endsWith(`/${wantedName}`)) {
      if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error("cards.zip 本地文件头格式异常。");
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
      return {
        method,
        bytes: bytes.slice(dataOffset, dataOffset + compressedSize),
      };
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }

  throw new Error("cards.zip 中没有找到 cards.json。");
}

async function inflateZipEntry(entry) {
  if (entry.method === 0) return entry.bytes;
  if (entry.method !== 8) throw new Error(`不支持的 ZIP 压缩方式：${entry.method}`);
  if (!("DecompressionStream" in window)) {
    throw new Error("当前浏览器不支持 ZIP 解压所需的 DecompressionStream，请用 Chrome/Android WebView，或运行 scripts/sync-cards.sh。");
  }
  const stream = new Blob([entry.bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function parseCardsZip(arrayBuffer) {
  const zipBytes = new Uint8Array(arrayBuffer);
  const entry = findZipEntry(zipBytes, "cards.json");
  const jsonBytes = await inflateZipEntry(entry);
  return new TextDecoder().decode(jsonBytes);
}

function cardKey(card) {
  return String(card.cid || card.id || card.cn_name);
}

function displayName(card) {
  return card.cn_name || card.sc_name || card.nwbbs_n || card.jp_name || card.en_name || `卡片${card.id}`;
}

function mentionToken(card) {
  return `@《${displayName(card)}》`;
}

function isPromptEditor(element) {
  return element === els.question || element === els.scenario;
}

function updateViewportInsets() {
  const viewport = window.visualViewport;
  const bottomInset = viewport ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
  document.documentElement.style.setProperty("--visual-viewport-bottom", `${Math.ceil(bottomInset)}px`);
}

function defaultAiBinding() {
  return {
    appKey: "deepseek",
    packageName: AI_APPS.deepseek.packageName,
    url: AI_APPS.deepseek.url,
  };
}

function loadAiBinding() {
  try {
    return { ...defaultAiBinding(), ...JSON.parse(localStorage.getItem(AI_BINDING_KEY) || "{}") };
  } catch {
    return defaultAiBinding();
  }
}

function saveAiBinding(binding) {
  localStorage.setItem(AI_BINDING_KEY, JSON.stringify(binding));
}

function aiLabel(binding) {
  return AI_APPS[binding.appKey]?.label || "自定义";
}

function renderAiBinding() {
  const binding = loadAiBinding();
  els.aiAppSelect.value = AI_APPS[binding.appKey] ? binding.appKey : "custom";
  els.aiPackageInput.value = binding.packageName || "";
  els.aiUrlInput.value = binding.url || "";
  els.aiBindingBadge.textContent = aiLabel(binding);
}

function selectedAiBinding() {
  return {
    appKey: els.aiAppSelect.value,
    packageName: els.aiPackageInput.value.trim(),
    url: els.aiUrlInput.value.trim(),
  };
}

function syncAiPreset() {
  const preset = AI_APPS[els.aiAppSelect.value];
  if (preset) {
    els.aiPackageInput.value = preset.packageName;
    els.aiUrlInput.value = preset.url;
  }
  const binding = selectedAiBinding();
  saveAiBinding(binding);
  els.aiBindingBadge.textContent = aiLabel(binding);
}

function persistAiBinding() {
  const binding = selectedAiBinding();
  saveAiBinding(binding);
  els.aiBindingBadge.textContent = aiLabel(binding);
}

function buildIntentUrl(binding) {
  const fallback = binding.url || "https://chat.deepseek.com/";
  let target;
  try {
    target = new URL(fallback);
  } catch {
    target = new URL("https://chat.deepseek.com/");
  }
  const packagePart = binding.packageName ? `package=${binding.packageName};` : "";
  const fallbackPart = `S.browser_fallback_url=${encodeURIComponent(target.href)};`;
  return `intent://${target.host}${target.pathname}${target.search}${target.hash}#Intent;scheme=${target.protocol.replace(":", "")};${packagePart}${fallbackPart}end`;
}

async function copyPromptToClipboard() {
  const prompt = await safelyBuildPrompt();
  await navigator.clipboard.writeText(prompt);
  return prompt;
}

function editorText(editor) {
  return Array.from(editor.childNodes)
    .map(nodePlainText)
    .join("")
    .replace(/\u00a0/g, " ");
}

function clearEditor(editor) {
  editor.replaceChildren();
}

function createMentionChip(card) {
  const chip = document.createElement("span");
  chip.className = "mention-chip";
  chip.contentEditable = "false";
  chip.dataset.cardKey = cardKey(card);
  chip.dataset.cardName = displayName(card);
  chip.textContent = mentionToken(card);
  chip.title = [
    displayName(card),
    card.sc_name && `官方/简中：${card.sc_name}`,
    card.nwbbs_n && `民翻：${card.nwbbs_n}`,
    card.id && `密码：${card.id}`,
  ]
    .filter(Boolean)
    .join("\n");
  return chip;
}

function mentionChipHtml(card) {
  return createMentionChip(card).outerHTML;
}

function appendMention(editor, card) {
  editor.appendChild(createMentionChip(card));
  editor.appendChild(document.createTextNode(" "));
}

function hideMentionSuggest() {
  els.mentionSuggest.hidden = true;
  els.mentionSuggest.innerHTML = "";
  mentionContext = null;
}

function caretRect() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0).cloneRange();
  range.collapse(true);
  let rect = range.getBoundingClientRect();
  if (rect.width || rect.height) return rect;

  const marker = document.createElement("span");
  marker.textContent = "\u200b";
  range.insertNode(marker);
  rect = marker.getBoundingClientRect();
  marker.remove();
  return rect;
}

function currentMentionContext(editor) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !editor.contains(selection.anchorNode)) return null;
  if (selection.anchorNode.nodeType !== Node.TEXT_NODE) return null;

  const text = selection.anchorNode.textContent.slice(0, selection.anchorOffset);
  const match = text.match(/@\s*(?:《([^》]*)》?|([^@\s，。,.；;：:！!？?\n]*))$/);
  if (!match) return null;

  const startOffset = match.index;
  return {
    editor,
    node: selection.anchorNode,
    startOffset,
    endOffset: selection.anchorOffset,
    query: (match[1] || match[2] || "").trim(),
  };
}

function renderMentionSuggest(cards) {
  els.mentionSuggest.innerHTML = "";
  cards.forEach((card, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.classList.toggle("active", index === 0);
    button.dataset.cardKey = cardKey(card);
    const name = document.createElement("span");
    name.className = "suggest-name";
    name.textContent = mentionToken(card);
    const meta = document.createElement("span");
    meta.className = "suggest-meta";
    meta.textContent = [
      card.sc_name && `官方：${card.sc_name}`,
      card.nwbbs_n && `民翻：${card.nwbbs_n}`,
      card.id && `密码：${card.id}`,
    ]
      .filter(Boolean)
      .join(" / ");
    button.append(name, meta);
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      chooseMentionSuggestion(card);
    });
    els.mentionSuggest.appendChild(button);
  });
}

async function updateMentionSuggest(editor) {
  if (!isPromptEditor(editor)) return hideMentionSuggest();
  if (!state.localReady && !state.selected.size) {
    await loadLocalCards();
  }

  const context = currentMentionContext(editor);
  if (!context) return hideMentionSuggest();

  const cards = suggestCards(context.query);
  if (!cards.length) return hideMentionSuggest();

  mentionContext = context;
  renderMentionSuggest(cards);
  const rect = caretRect() || editor.getBoundingClientRect();
  els.mentionSuggest.style.left = `${Math.min(rect.left, window.innerWidth - 372)}px`;
  els.mentionSuggest.style.top = `${rect.bottom + 6}px`;
  els.mentionSuggest.hidden = false;
}

function chooseMentionSuggestion(card) {
  if (!mentionContext) return;
  const { node, startOffset, endOffset } = mentionContext;
  const range = document.createRange();
  range.setStart(node, startOffset);
  range.setEnd(node, endOffset);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  document.execCommand("insertHTML", false, `${mentionChipHtml(card)} `);
  state.selected.set(cardKey(card), card);
  renderSelected();
  hideMentionSuggest();
}

function activeSuggestionButtons() {
  return Array.from(els.mentionSuggest.querySelectorAll("button"));
}

function moveMentionSuggest(delta) {
  const buttons = activeSuggestionButtons();
  if (!buttons.length) return;
  const current = Math.max(0, buttons.findIndex((button) => button.classList.contains("active")));
  const next = (current + delta + buttons.length) % buttons.length;
  buttons.forEach((button, index) => button.classList.toggle("active", index === next));
  buttons[next].scrollIntoView({ block: "nearest" });
}

function acceptActiveMentionSuggest() {
  const active = els.mentionSuggest.querySelector("button.active") || els.mentionSuggest.querySelector("button");
  if (!active) return false;
  const card = findCardByKey(active.dataset.cardKey);
  if (!card) return false;
  chooseMentionSuggestion(card);
  return true;
}

function deepestLastNode(node) {
  let current = node;
  while (current?.lastChild) current = current.lastChild;
  return current;
}

function deepestFirstNode(node) {
  let current = node;
  while (current?.firstChild) current = current.firstChild;
  return current;
}

function previousCaretNode(selection, editor) {
  const range = selection.getRangeAt(0);
  const container = range.startContainer;
  const offset = range.startOffset;

  if (container.nodeType === Node.TEXT_NODE) {
    if (offset > 0) return null;
    return container.previousSibling || container.parentNode?.previousSibling || null;
  }

  if (container === editor && offset > 0) return deepestLastNode(editor.childNodes[offset - 1]);
  if (container.nodeType === Node.ELEMENT_NODE && offset > 0) return deepestLastNode(container.childNodes[offset - 1]);
  return container.previousSibling || container.parentNode?.previousSibling || null;
}

function nextCaretNode(selection, editor) {
  const range = selection.getRangeAt(0);
  const container = range.startContainer;
  const offset = range.startOffset;

  if (container.nodeType === Node.TEXT_NODE) {
    if (offset < container.textContent.length) return null;
    return container.nextSibling || container.parentNode?.nextSibling || null;
  }

  if (container === editor && offset < editor.childNodes.length) return deepestFirstNode(editor.childNodes[offset]);
  if (container.nodeType === Node.ELEMENT_NODE && offset < container.childNodes.length) return deepestFirstNode(container.childNodes[offset]);
  return container.nextSibling || container.parentNode?.nextSibling || null;
}

function removeAdjacentMention(event) {
  if (event.key !== "Backspace" && event.key !== "Delete") return false;
  const editor = event.currentTarget;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !selection.isCollapsed || !editor.contains(selection.anchorNode)) return false;

  const node = event.key === "Backspace" ? previousCaretNode(selection, editor) : nextCaretNode(selection, editor);
  if (!(node instanceof HTMLElement) || !node.classList.contains("mention-chip")) return false;

  event.preventDefault();
  const range = document.createRange();
  range.selectNode(node);
  selection.removeAllRanges();
  selection.addRange(range);
  document.execCommand("delete");
  cleanupEditorWhitespace(editor);
  return true;
}

function cleanupEditorWhitespace(editor) {
  for (const node of Array.from(editor.childNodes)) {
    if (node.nodeType !== Node.TEXT_NODE) continue;
    node.textContent = node.textContent.replace(/[ \t]{2,}/g, " ");
    if (!node.textContent && editor.childNodes.length > 1) node.remove();
  }
}

function handleEditorKeydown(event) {
  if (removeAdjacentMention(event)) return;
  if (els.mentionSuggest.hidden) return;
  if (event.key === "ArrowDown") {
    event.preventDefault();
    moveMentionSuggest(1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    moveMentionSuggest(-1);
  } else if (event.key === "Enter" || event.key === "Tab") {
    event.preventDefault();
    acceptActiveMentionSuggest();
  } else if (event.key === "Escape") {
    event.preventDefault();
    hideMentionSuggest();
  }
}

function shouldSkipMentionRefresh(event) {
  return ["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(event.key);
}

function selectionPlainText() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return "";
  const fragment = selection.getRangeAt(0).cloneContents();
  return Array.from(fragment.childNodes).map(nodePlainText).join("");
}

function nodePlainText(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent;
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  if (node.classList.contains("mention-chip")) return node.textContent;
  if (node.tagName === "BR") return "\n";
  const text = Array.from(node.childNodes).map(nodePlainText).join("");
  if (["DIV", "P"].includes(node.tagName)) return `${text}\n`;
  return text;
}

function handleEditorCopy(event) {
  const text = selectionPlainText();
  if (!text) return;
  event.clipboardData.setData("text/plain", text);
  event.preventDefault();
}

function handleEditorCut(event) {
  const selection = window.getSelection();
  const text = selectionPlainText();
  if (!selection || selection.rangeCount === 0 || !text) return;
  event.clipboardData.setData("text/plain", text);
  document.execCommand("delete");
  cleanupEditorWhitespace(event.currentTarget);
  event.preventDefault();
}

function handleEditorPaste(event) {
  window.setTimeout(() => {
    hydrateMentionText(event.currentTarget);
    updateMentionSuggest(event.currentTarget);
  }, 0);
}

function searchableText(card) {
  return [
    card.cid,
    card.id,
    card.cn_name,
    card.sc_name,
    card.md_name,
    card.nwbbs_n,
    card.cnocg_n,
    card.jp_name,
    card.jp_ruby,
    card.en_name,
    card.types,
    card.pdesc,
    card.desc,
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
}

function setStatus(message, kind = "normal") {
  els.status.textContent = message;
  els.status.classList.toggle("warn", kind === "warn");
}

function setBadge(message) {
  els.dataBadge.textContent = message;
}

function loadSearchHistory() {
  try {
    const history = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || "[]");
    return Array.isArray(history) ? history.filter((item) => typeof item === "string" && item.trim()) : [];
  } catch {
    return [];
  }
}

function saveSearchHistory(history) {
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_SEARCH_HISTORY)));
}

function addSearchHistory(query) {
  const normalized = query.trim();
  if (!normalized) return;
  const history = loadSearchHistory().filter((item) => item !== normalized);
  history.unshift(normalized);
  saveSearchHistory(history);
  renderSearchHistory();
}

function deleteSearchHistoryItem(query) {
  saveSearchHistory(loadSearchHistory().filter((item) => item !== query));
  renderSearchHistory();
}

function clearSearchHistory() {
  localStorage.removeItem(SEARCH_HISTORY_KEY);
  renderSearchHistory();
}

function renderSearchHistory() {
  const history = loadSearchHistory();
  els.searchHistory.innerHTML = "";
  els.searchHistory.classList.toggle("empty", history.length === 0);
  els.clearHistoryBtn.disabled = history.length === 0;

  if (!history.length) {
    els.searchHistory.textContent = "暂无搜索历史";
    return;
  }

  for (const query of history) {
    const item = document.createElement("span");
    item.className = "history-item";

    const queryButton = document.createElement("button");
    queryButton.type = "button";
    queryButton.className = "history-query";
    queryButton.textContent = query;
    queryButton.title = query;
    queryButton.addEventListener("click", () => runSearch(query, { saveHistory: false }));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "history-delete";
    deleteButton.textContent = "×";
    deleteButton.title = `删除“${query}”`;
    deleteButton.addEventListener("click", () => deleteSearchHistoryItem(query));

    item.append(queryButton, deleteButton);
    els.searchHistory.appendChild(item);
  }
}

async function loadLocalCards(showSuccess = false) {
  try {
    const stored = await readStoredCardPool();
    if (stored?.jsonText) {
      const data = JSON.parse(stored.jsonText);
      const result = applyCardPool(data, "已更新", stored.savedAt);
      if (showSuccess) {
        const savedText = stored.savedAt ? `，更新时间 ${new Date(stored.savedAt).toLocaleString()}` : "";
        setStatus(`已读取浏览器缓存的最新卡池，共 ${result.count} 张${savedText}。`);
      }
      return true;
    }
  } catch (error) {
    setStatus(`读取缓存卡池失败：${error.message}。将改读本地 data/cards.json。`, "warn");
  }

  try {
    const response = await fetch(LOCAL_DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const result = applyCardPool(data, "本地");
    if (showSuccess) setStatus(`已读取本地卡库，共 ${result.count} 张。`);
    return true;
  } catch (error) {
    state.localReady = false;
    setBadge("在线模式");
    setStatus("未找到 data/cards.json；仍可在线搜索。运行 scripts/sync-cards.sh 可同步全量卡库。", "warn");
    return false;
  }
}

async function updateCardPool() {
  els.updatePoolBtn.disabled = true;
  setStatus("正在下载最新卡池 cards.zip。");
  try {
    let response = null;
    const errors = [];
    for (const url of CARD_POOL_SOURCES) {
      try {
        response = await fetchWithTimeout(url, 20000, { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        break;
      } catch (error) {
        response = null;
        errors.push(`${url}: ${error.message}`);
      }
    }
    if (!response) throw new Error(`所有卡池源都不可用。${errors.join("；")}`);
    setStatus("卡池下载完成，正在解压 cards.json。");
    const jsonText = await parseCardsZip(await response.arrayBuffer());
    const data = JSON.parse(jsonText);
    const record = await saveStoredCardPool(jsonText);
    const result = applyCardPool(data, "已更新", record.savedAt);
    setStatus(`卡池已更新并缓存到浏览器，共 ${result.count} 张。后续搜索会优先使用这份卡池。`);
    const query = els.query.value.trim();
    if (query) renderResults(searchLocal(query));
  } catch (error) {
    setStatus(`更新卡池失败：${error.message}`, "warn");
  } finally {
    els.updatePoolBtn.disabled = false;
  }
}

async function searchOnline(query) {
  const url = `${API_BASE}/api/v0/?search=${encodeURIComponent(query)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`百鸽 API 返回 HTTP ${response.status}`);
  const data = await response.json();
  return (data.result || []).map(normalizeCard);
}

function searchLocal(query) {
  const terms = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (!terms.length) return [];

  return state.localCards
    .map((card) => {
      const haystack = searchableText(card);
      const matched = terms.every((term) => haystack.includes(term));
      const nameHit = terms.some((term) => {
        return [card.cn_name, card.sc_name, card.md_name, card.nwbbs_n, card.cnocg_n, card.jp_name, card.en_name]
          .filter(Boolean)
          .some((name) => name.toLowerCase().includes(term));
      });
      return { card, score: matched ? (nameHit ? 2 : 1) : 0 };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS)
    .map((entry) => entry.card);
}

function selectLocalCardsByNames(names) {
  if (!state.localReady) return [];
  return names
    .map((name) => state.localCards.find((card) => {
      return [card.cn_name, card.sc_name, card.md_name, card.nwbbs_n, card.cnocg_n, card.jp_name, card.en_name]
        .filter(Boolean)
        .includes(name);
    }))
    .filter(Boolean);
}

function cardAliases(card) {
  return [
    card.cn_name,
    card.sc_name,
    card.md_name,
    card.nwbbs_n,
    card.cnocg_n,
    card.jp_name,
    card.jp_ruby,
    card.en_name,
    card.id && String(card.id),
    card.cid && String(card.cid),
  ].filter(Boolean);
}

function normalizeMentionName(name) {
  return String(name)
    .trim()
    .replace(/^[@\s]+/, "")
    .replace(/^《|》$/g, "")
    .replace(/^「|」$/g, "")
    .replace(/^“|”$/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function sameCardName(card, name) {
  return mentionMatchScore(card, name) > 0;
}

function mentionMatchScore(card, name) {
  const target = normalizeMentionName(name);
  let score = 0;
  if (!target) return 1;
  for (const alias of cardAliases(card)) {
    const normalized = normalizeMentionName(alias);
    if (normalized === target) score = Math.max(score, 100);
    else if (normalized.includes(target)) score = Math.max(score, 60);
    else if (target.includes(normalized)) score = Math.max(score, 20);
  }
  return score;
}

function mentionSearchPool() {
  const selected = Array.from(state.selected.values());
  if (selected.length) return selected;
  return state.localReady ? state.localCards : [];
}

function mentionSearchScopeLabel() {
  return state.selected.size ? "@列表" : "全卡池";
}

function findCardByMention(name) {
  return (
    mentionSearchPool()
    .map((card) => ({ card, score: mentionMatchScore(card, name) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.card || null
  );
}

function suggestCards(query, limit = 8) {
  const normalized = normalizeMentionName(query);
  if (!state.selected.size && !normalized) return [];
  return mentionSearchPool()
    .map((card) => ({ card, score: mentionMatchScore(card, query) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || displayName(a.card).localeCompare(displayName(b.card), "zh-Hans-CN"))
    .slice(0, limit)
    .map((entry) => entry.card);
}

function parseMentions(text) {
  const names = new Set();
  const bracketed = /@\s*《([^》]+)》/g;
  for (const match of text.matchAll(bracketed)) {
    names.add(match[1].trim());
  }

  const bare = /@\s*([^《\s，。,.；;：:！!？?\n]+)/g;
  for (const match of text.matchAll(bare)) {
    const name = match[1].trim();
    if (name) names.add(name);
  }

  return Array.from(names);
}

function referencedCards() {
  const names = parseMentions(`${editorText(els.question)}\n${editorText(els.scenario)}`);
  const byKey = new Map();
  for (const chip of document.querySelectorAll(".rich-editor .mention-chip[data-card-key]")) {
    const card = findCardByKey(chip.dataset.cardKey);
    if (card) byKey.set(cardKey(card), card);
  }
  for (const name of names) {
    const card = findCardByMention(name);
    if (card) {
      state.selected.set(cardKey(card), card);
      byKey.set(cardKey(card), card);
    }
  }
  return Array.from(byKey.values());
}

function findCardByKey(key) {
  const selected = state.selected.get(String(key));
  if (selected) return selected;
  return state.localCards.find((card) => cardKey(card) === String(key)) || null;
}

function hydrateMentionText(editor) {
  if (editor.querySelector(".mention-chip")) {
    renderSelected();
    return;
  }

  const text = editorText(editor);
  const pattern = /@\s*(?:《([^》]+)》|([^《\s，。,.；;：:！!？?\n]+))/g;
  if (!pattern.test(text)) return;

  clearEditor(editor);
  pattern.lastIndex = 0;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    editor.appendChild(document.createTextNode(text.slice(cursor, match.index)));
    const card = findCardByMention(match[1] || match[2]);
    if (card) {
      state.selected.set(cardKey(card), card);
      appendMention(editor, card);
    } else {
      editor.appendChild(document.createTextNode(match[0]));
    }
    cursor = match.index + match[0].length;
  }
  editor.appendChild(document.createTextNode(text.slice(cursor)));
  renderSelected();
}

function setEditorText(editor, text) {
  clearEditor(editor);
  editor.appendChild(document.createTextNode(text));
  hydrateMentionText(editor);
}

function renderCards(cards, container, actionLabel, action) {
  container.innerHTML = "";
  cards.forEach((card) => {
    const node = els.cardTemplate.content.cloneNode(true);
    node.querySelector("h3").textContent = displayName(card);
    node.querySelector(".names").textContent = [
      card.sc_name && `官方/简中：${card.sc_name}`,
      card.md_name && `MD：${card.md_name}`,
      card.nwbbs_n && `民翻：${card.nwbbs_n}`,
      card.cnocg_n && `CNOCG：${card.cnocg_n}`,
      card.jp_name && `日文：${card.jp_name}`,
      card.en_name && `英文：${card.en_name}`,
      card.id && `密码：${card.id}`,
      card.cid && `CID：${card.cid}`,
    ]
      .filter(Boolean)
      .join("\n");
    node.querySelector(".types").textContent = card.types;
    const desc = [card.pdesc, card.desc].filter(Boolean).join("\n\n") || "暂无效果文本。";
    node.querySelector(".desc").textContent = desc;
    node.querySelector(".desc").title = desc;
    if (card.script?.code) {
      node.querySelector(".desc").textContent += `\n\n[YGO脚本] ${card.script.file} 已获取`;
    } else if (card.script?.missing) {
      node.querySelector(".desc").textContent += "\n\n[YGO脚本] 未找到官方/预发布脚本";
    }
    const button = node.querySelector("button");
    button.textContent = actionLabel(card);
    button.addEventListener("click", () => action(card));
    container.appendChild(node);
  });
}

function scriptCacheKey(id) {
  return `ygo-script:${id}`;
}

async function fetchCardScript(card) {
  if (!card.id) {
    card.script = { missing: true, error: "卡片没有密码 id，无法定位 c{id}.lua。" };
    return card.script;
  }

  const cached = localStorage.getItem(scriptCacheKey(card.id));
  if (cached) {
    const parsed = JSON.parse(cached);
    if (parsed?.code) {
      card.script = parsed;
      return card.script;
    }
  }

  const file = `c${card.id}.lua`;
  for (const source of SCRIPT_SOURCES) {
    const rawUrl = `${source.rawBase}/${file}`;
    const response = await fetchWithTimeout(rawUrl, 8000);
    if (response.ok) {
      const code = await response.text();
      card.script = {
        file,
        source: source.label,
        url: `${source.pageBase}/${file}`,
        rawUrl,
        code,
      };
      localStorage.setItem(scriptCacheKey(card.id), JSON.stringify(card.script));
      return card.script;
    }
  }

  card.script = {
    missing: true,
    file,
    tried: SCRIPT_SOURCES.map((source) => `${source.pageBase}/${file}`),
  };
  return card.script;
}

async function fetchWithTimeout(url, timeoutMs, options = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

async function fetchSelectedScripts() {
  hydrateMentionText(els.question);
  hydrateMentionText(els.scenario);
  const cardsByKey = new Map();
  for (const card of Array.from(state.selected.values())) cardsByKey.set(cardKey(card), card);
  for (const card of referencedCards()) cardsByKey.set(cardKey(card), card);
  const cards = Array.from(cardsByKey.values());
  if (!cards.length) {
    setStatus("请先引用卡片，或在问题里写 @《卡名》。", "warn");
    return;
  }

  setStatus(`正在获取 ${cards.length} 张卡的 YGO Lua 脚本。`);
  const result = await fetchScriptsForCards(cards);
  renderSelected();
  await buildPrompt({ autoFetchScripts: false });
  setStatus(`YGO 脚本获取完成：${result.found} 个成功，${result.missing} 个未找到或失败。`);
}

async function fetchScriptsForCards(cards) {
  let found = 0;
  let missing = 0;

  for (const card of cards) {
    try {
      const script = await fetchCardScript(card);
      if (script.code) found += 1;
      else missing += 1;
    } catch (error) {
      card.script = { missing: true, error: error.message };
      missing += 1;
    }
  }

  return { found, missing };
}

async function applyScenarioPreset() {
  const preset = SCENARIO_PRESETS[els.scenarioPreset.value];
  if (!preset) return;

  if (preset.cardNames?.length) {
    if (!state.localReady) {
      await loadLocalCards(true);
    }
    const cards = selectLocalCardsByNames(preset.cardNames);
    cards.forEach((card) => state.selected.set(cardKey(card), card));
    setEditorText(els.question, preset.question);
    setEditorText(els.scenario, preset.scenario);
    renderSelected();
    renderResults(cards);
    setStatus(`已套用模板，并自动选择 ${cards.length} 张相关卡。建议再点“获取 YGO 脚本”。`);
  } else {
    setEditorText(els.question, preset.question);
    setEditorText(els.scenario, preset.scenario);
  }

  await buildPrompt();
}

function renderResults(cards) {
  if (!cards.length) {
    els.results.innerHTML = `<p class="status">没有找到匹配卡片。</p>`;
    return;
  }

  renderCards(
    cards,
    els.results,
    (card) => (state.selected.has(cardKey(card)) ? "已加入" : "加入@列表"),
    (card) => {
      state.selected.set(cardKey(card), card);
      renderSelected();
      renderResults(cards);
      setStatus(`已将 @《${displayName(card)}》 加入右侧 @ 列表。现在可在问题框输入 @ 选择它。`);
    },
  );
}

function renderSelected() {
  const cards = Array.from(state.selected.values());
  els.selectedCount.textContent = String(cards.length);
  els.selectedCards.classList.toggle("empty", cards.length === 0);

  if (!cards.length) {
    els.selectedCards.textContent = "还没有 @ 列表。左侧搜索后点“加入@列表”，再在问题框输入 @ 插入卡片。";
    return;
  }

  renderCards(
    cards,
    els.selectedCards,
    () => "移除引用",
    (card) => {
      state.selected.delete(cardKey(card));
      renderSelected();
    },
  );
}

function compactCard(card) {
  const base = {
    name: card.cn_name,
    id: card.id,
    cid: card.cid,
    names: {
      sc_name: card.sc_name,
      md_name: card.md_name,
      nwbbs_n: card.nwbbs_n,
      cnocg_n: card.cnocg_n,
      jp_name: card.jp_name,
      en_name: card.en_name,
    },
    types: card.types,
    pendulum_effect: card.pdesc,
    effect: card.desc,
    faqcount: card.faqcount,
  };

  if (els.includeRaw.checked) {
    base.raw_data = card.data;
  }

  if (els.includeScripts.checked) {
    base.ygo_script = card.script?.code
      ? {
          file: card.script.file,
          source: card.script.source,
          url: card.script.url,
          code: card.script.code,
        }
      : {
          file: card.id ? `c${card.id}.lua` : "",
          status: "not_loaded_or_not_found",
          error: card.script?.error || "",
          tried: card.script?.tried || [],
          note: "如果脚本获取失败，请查看 error/tried；如果为空，说明尚未尝试获取。",
        };
  }

  return base;
}

async function buildPrompt(options = {}) {
  const { autoFetchScripts = true } = options;
  hydrateMentionText(els.question);
  hydrateMentionText(els.scenario);
  const referenced = referencedCards();
  if (els.includeScripts.checked && autoFetchScripts && referenced.length) {
    setStatus(`正在为 ${referenced.length} 张 @ 卡片补全 YGO Lua 脚本。`);
    const result = await fetchScriptsForCards(referenced);
    renderSelected();
    setStatus(`脚本补全完成：${result.found} 个成功，${result.missing} 个未找到或失败。`);
  }
  const cards = referenced.map(compactCard);
  const question = editorText(els.question).trim() || "请根据以下卡片信息判断这个游戏王规则/判例问题。";
  const scenario = editorText(els.scenario).trim() || "未补充具体场景，请先指出还需要哪些关键信息。";

  const instructions = [
    "你是一名熟悉游戏王 OCG 规则、连锁处理、效果分类、裁定写法，并能阅读 YGO/EDOPro Lua 脚本的助手。",
    "本次任务必须优先分析 ygo_script.code。不要先按卡片文本或泛用规则直接下结论；如果提供了 Lua 脚本，必须先解释脚本机制，再回答问题。",
    "禁止在 Lua 脚本审计前写“结论前置”“简短结论”“最终答案”等结论性段落。第一段必须是【Lua 脚本审计】。",
    "第一步【Lua 脚本审计】：逐张卡提取和本问题有关的脚本语义。必须指出关键 effect 注册在谁身上、SetType/SetCode/SetProperty/SetTargetRange/SetValue/SetCondition/SetCost/SetTarget/SetOperation 分别意味着什么；如果相关函数不存在，也要说明脚本没有体现。",
    "第二步【文本对照】：把 Lua 语义与卡片文本对照，说明哪些结论由文本支持，哪些由 Lua 实现支持，哪些只是模拟器实现参考。",
    "第三步【精确问题回答】：只回答用户提出的具体场景，不要把其他可能场景混进主结论。若需要讨论其他场景，必须放在“旁支情况”中，且不能改变主结论。",
    "精确问题回答的第一句必须使用固定格式：“对用户这个具体问题：可以/不能/无法确定。” 后面紧接一句说明该结论引用了哪一条 Lua 机制。",
    "结论必须引用第一步提取出的 Lua 机制；如果你的结论没有引用 Lua 机制，请重新分析，不要输出最终结论。若 Lua 机制已经能给出模拟器实现结论，不要因为缺少官方 FAQ 就把主结论改成“无法确定”；应写“按 Lua/EDOPro 实现：可以/不能；官方 FAQ：未提供资料，需要另查”。",
    "请重点区分：效果作用于哪张卡/哪个玩家、是否直接影响被解放/送墓/除外/无效的卡、是否取对象、是否入连锁、召唤手续与卡的效果、持续适用、无效与不受影响。",
    "Lua 脚本只能作为 YGO/EDOPro 模拟器实现参考，不等同于官方裁定；如果卡片文本、Lua 脚本、通用规则或已知裁定之间存在冲突，必须显式列出冲突，并分别给出“Lua/EDOPro 实现结论”“官方资料内可确认结论”“仍需核对点”。不要把“仍需核对点”写成主结论。",
    "禁止只复述卡片文本或只引用外部社区说法。若要引用旧卡、类似卡或社区裁定，必须说明它与当前卡脚本是否同构，不能直接套用。",
    "输出前做一致性检查：检查开头、主结论、推理链、表格中的“可以/不能”是否一致。若发现矛盾，必须先修正，不要把互相矛盾的结论一起输出。",
  ];

  if (els.askForCitations.checked) {
    instructions.push("结论后请列出依据、推理链、可能存在争议或需要确认的官方判例；优先说明应查哪张卡的官方 FAQ 或事务局回答。");
  }

  const prompt = [
    "# 游戏王判例问题",
    "",
    "## @卡片资料",
    "```json",
    JSON.stringify(cards, null, 2),
    "```",
    "",
    "## 用户问题",
    question,
    "",
    "## 用户补充场景",
    scenario,
    "",
    "## 回答要求",
    instructions.map((item, index) => `${index + 1}. ${item}`).join("\n"),
    "",
    "请严格按【Lua 脚本审计】→【文本对照】→【精确问题回答】→【旁支情况】→【一致性检查】→【待确认点】的顺序输出。不要把结论放在 Lua 脚本审计之前。若无法确定，请说明缺少哪些信息，以及建议我去哪里核对。",
  ].join("\n");

  els.promptOutput.value = prompt;
  setStatus(`Prompt 已生成，已展开 ${cards.length} 张 @ 卡片。`);
  return prompt;
}

async function safelyBuildPrompt(options = {}) {
  try {
    return await buildPrompt(options);
  } catch (error) {
    setStatus(`生成 Prompt 失败：${error.message}`, "warn");
    throw error;
  }
}

async function handleSearch(event) {
  event.preventDefault();
  const query = els.query.value.trim();
  await runSearch(query);
}

async function runSearch(query, options = {}) {
  const { saveHistory = true } = options;
  const normalized = query.trim();
  if (!normalized) {
    setStatus("请输入关键词。", "warn");
    return;
  }

  els.query.value = normalized;
  setStatus("正在搜索。");
  try {
    const cards = state.localReady ? searchLocal(normalized) : await searchOnline(normalized);
    renderResults(cards);
    if (saveHistory) addSearchHistory(normalized);
    setStatus(`${state.localReady ? "本地" : "在线"}搜索完成，找到 ${cards.length} 条。`);
  } catch (error) {
    setStatus(`搜索失败：${error.message}`, "warn");
  }
}

els.searchForm.addEventListener("submit", handleSearch);
els.clearHistoryBtn.addEventListener("click", clearSearchHistory);
els.loadLocalBtn.addEventListener("click", () => loadLocalCards(true));
els.updatePoolBtn.addEventListener("click", updateCardPool);
els.fetchScriptsBtn.addEventListener("click", fetchSelectedScripts);
els.scenarioPreset.addEventListener("change", applyScenarioPreset);
els.clearQuestionBtn.addEventListener("click", () => {
  clearEditor(els.question);
  hideMentionSuggest();
  safelyBuildPrompt({ autoFetchScripts: false });
  els.question.focus();
});
els.clearScenarioBtn.addEventListener("click", () => {
  clearEditor(els.scenario);
  hideMentionSuggest();
  safelyBuildPrompt({ autoFetchScripts: false });
  els.scenario.focus();
});
els.question.addEventListener("blur", () => hydrateMentionText(els.question));
els.scenario.addEventListener("blur", () => hydrateMentionText(els.scenario));
for (const editor of [els.question, els.scenario]) {
  editor.addEventListener("input", () => updateMentionSuggest(editor));
  editor.addEventListener("keyup", (event) => {
    if (!shouldSkipMentionRefresh(event)) updateMentionSuggest(editor);
  });
  editor.addEventListener("click", () => updateMentionSuggest(editor));
  editor.addEventListener("keydown", handleEditorKeydown);
  editor.addEventListener("copy", handleEditorCopy);
  editor.addEventListener("cut", handleEditorCut);
  editor.addEventListener("paste", handleEditorPaste);
}
document.addEventListener("mousedown", (event) => {
  if (!els.mentionSuggest.contains(event.target) && !isPromptEditor(event.target)) {
    hideMentionSuggest();
  }
});
els.clearBtn.addEventListener("click", () => {
  state.selected.clear();
  clearEditor(els.question);
  clearEditor(els.scenario);
  renderSelected();
  safelyBuildPrompt({ autoFetchScripts: false });
});
els.buildPromptBtn.addEventListener("click", () => safelyBuildPrompt());
els.copyPromptBtn.addEventListener("click", async () => {
  await copyPromptToClipboard();
  setStatus("Prompt 已复制。");
});
els.aiAppSelect.addEventListener("change", syncAiPreset);
for (const input of [els.aiPackageInput, els.aiUrlInput]) {
  input.addEventListener("input", persistAiBinding);
}
els.copyOpenAiBtn.addEventListener("click", async () => {
  await copyPromptToClipboard();
  const binding = selectedAiBinding();
  saveAiBinding(binding);
  window.location.href = buildIntentUrl(binding);
  setStatus(`Prompt 已复制，正在打开 ${aiLabel(binding)}。进入 AI 应用后直接粘贴即可。`);
});
els.sharePromptBtn.addEventListener("click", async () => {
  const prompt = await safelyBuildPrompt();
  if (!navigator.share) {
    await navigator.clipboard.writeText(prompt);
    setStatus("当前浏览器不支持系统分享，已改为复制 Prompt。");
    return;
  }
  await navigator.share({
    title: "游戏王判例 Prompt",
    text: prompt,
  });
  setStatus("已打开系统分享。");
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      setStatus("离线缓存注册失败，不影响正常使用。", "warn");
    });
  });
}

updateViewportInsets();
window.addEventListener("resize", updateViewportInsets);
window.visualViewport?.addEventListener("resize", updateViewportInsets);
window.visualViewport?.addEventListener("scroll", updateViewportInsets);

loadLocalCards();
renderSelected();
renderSearchHistory();
renderAiBinding();
