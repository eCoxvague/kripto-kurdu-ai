const state = {
  mode: "chat",
  messages: [],
  conversations: [],
  activeConversationId: "",
  currentVideoPrompt: "",
  videoPollAbort: null,
  pendingChatImages: [],
  hasServerKey: false
};

const els = {
  apiKey: document.querySelector("#apiKey"),
  keyState: document.querySelector("#keyState"),
  apiSettingsBtn: document.querySelector("#apiSettingsBtn"),
  apiModal: document.querySelector("#apiModal"),
  apiModalClose: document.querySelector("#apiModalClose"),
  saveApiKey: document.querySelector("#saveApiKey"),
  clearApiKey: document.querySelector("#clearApiKey"),
  clearBtn: document.querySelector("#clearBtn"),
  model: document.querySelector("#model"),
  temperature: document.querySelector("#temperature"),
  maxTokens: document.querySelector("#maxTokens"),
  topP: document.querySelector("#topP"),
  chatSeed: document.querySelector("#chatSeed"),
  frequencyPenalty: document.querySelector("#frequencyPenalty"),
  presencePenalty: document.querySelector("#presencePenalty"),
  repetitionPenalty: document.querySelector("#repetitionPenalty"),
  chatStop: document.querySelector("#chatStop"),
  size: document.querySelector("#size"),
  imageSeed: document.querySelector("#imageSeed"),
  videoPreset: document.querySelector("#videoPreset"),
  width: document.querySelector("#width"),
  height: document.querySelector("#height"),
  frames: document.querySelector("#frames"),
  fps: document.querySelector("#fps"),
  videoSeed: document.querySelector("#videoSeed"),
  videoSteps: document.querySelector("#videoSteps"),
  settings: document.querySelectorAll("[data-setting]"),
  tabs: document.querySelectorAll(".tab"),
  views: document.querySelectorAll(".view"),
  newConversation: document.querySelector("#newConversation"),
  conversationList: document.querySelector("#conversationList"),
  messages: document.querySelector("#messages"),
  chatForm: document.querySelector("#chatForm"),
  chatInput: document.querySelector("#chatInput"),
  chatImageTray: document.querySelector("#chatImageTray"),
  imagePrompt: document.querySelector("#imagePrompt"),
  imageSubject: document.querySelector("#imageSubject"),
  imageEnvironment: document.querySelector("#imageEnvironment"),
  imageLighting: document.querySelector("#imageLighting"),
  imageCamera: document.querySelector("#imageCamera"),
  imageAppearance: document.querySelector("#imageAppearance"),
  imageNegative: document.querySelector("#imageNegative"),
  enhanceImagePrompt: document.querySelector("#enhanceImagePrompt"),
  imageStyle: document.querySelector("#imageStyle"),
  imagePromptPreview: document.querySelector("#imagePromptPreview"),
  imageUrls: document.querySelector("#imageUrls"),
  generateImage: document.querySelector("#generateImage"),
  imageOutput: document.querySelector("#imageOutput"),
  videoPrompt: document.querySelector("#videoPrompt"),
  videoSubject: document.querySelector("#videoSubject"),
  videoEnvironment: document.querySelector("#videoEnvironment"),
  videoLighting: document.querySelector("#videoLighting"),
  videoCamera: document.querySelector("#videoCamera"),
  videoMotion: document.querySelector("#videoMotion"),
  videoAppearance: document.querySelector("#videoAppearance"),
  videoNegative: document.querySelector("#videoNegative"),
  enhanceVideoPrompt: document.querySelector("#enhanceVideoPrompt"),
  videoStyle: document.querySelector("#videoStyle"),
  videoPromptPreview: document.querySelector("#videoPromptPreview"),
  videoImages: document.querySelector("#videoImages"),
  keyframes: document.querySelector("#keyframes"),
  autoPollVideo: document.querySelector("#autoPollVideo"),
  videoHint: document.querySelector("#videoHint"),
  generateVideo: document.querySelector("#generateVideo"),
  videoOutput: document.querySelector("#videoOutput"),
  taskId: document.querySelector("#taskId"),
  pollVideo: document.querySelector("#pollVideo")
};

const imageStylePrompts = {
  realistic: "gerçekçi fotoğraf",
  studio: "stüdyo fotoğrafı",
  cinematic: "sinematik görünüm",
  editorial: "editoryal fotoğraf",
  product: "ürün çekimi"
};

const videoStylePrompts = {
  realistic: "gerçekçi video",
  cinematic: "sinematik video",
  street: "sokak çekimi",
  product: "ürün tanıtım videosu",
  runway: "podyum tarzı video"
};

const apiKeyStorageKey = "kripto_kurdu_agnes_api_key";
const conversationsStorageKey = "kripto_kurdu_chat_history";
const maxConversations = 10;
const maxStoredMessages = 10;
const maxStoredImageLength = 600000;

function storedApiKey() {
  return localStorage.getItem(apiKeyStorageKey) || "";
}

function updateApiKeyState() {
  const hasUiKey = Boolean(storedApiKey());
  const isReady = hasUiKey || state.hasServerKey;
  els.keyState.textContent = hasUiKey ? "•••• kayıtlı" : state.hasServerKey ? "Server key hazır" : "API key yok";
  els.apiSettingsBtn.classList.toggle("ok", isReady);
  els.apiSettingsBtn.classList.toggle("missing", !isReady);
}

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function conversationTitle(messages) {
  const firstUser = messages.find((message) => message.role === "user");
  const text = cleanText(firstUser?.content || "");
  if (text) return text.length > 42 ? `${text.slice(0, 42)}...` : text;
  if (firstUser?.images?.length) return "Görselli sohbet";
  return "Yeni sohbet";
}

function cloneMessagesForStorage(messages) {
  return messages
    .filter((message) => !message.loading)
    .slice(-maxStoredMessages)
    .map((message) => ({
      role: message.role,
      content: formatValue(message.content),
      images: (message.images || [])
        .filter((image) => image.url && image.url.length <= maxStoredImageLength)
        .map((image) => ({ id: image.id, name: image.name, url: image.url }))
    }));
}

function loadConversations() {
  const raw = localStorage.getItem(conversationsStorageKey);
  const parsed = safeJsonParse(raw, []);
  state.conversations = Array.isArray(parsed)
    ? parsed.filter((item) => item && item.id && Array.isArray(item.messages)).slice(0, maxConversations)
        .map((item) => ({ ...item, messages: cloneMessagesForStorage(item.messages) }))
    : [];
}

function saveConversations() {
  try {
    localStorage.setItem(conversationsStorageKey, JSON.stringify(state.conversations.slice(0, maxConversations)));
  } catch {
    const slim = state.conversations.map((conversation) => ({
      ...conversation,
      messages: conversation.messages.map((message) => ({ ...message, images: [] }))
    }));
    localStorage.setItem(conversationsStorageKey, JSON.stringify(slim.slice(0, maxConversations)));
    state.conversations = slim;
  }
}

function activeConversation() {
  return state.conversations.find((conversation) => conversation.id === state.activeConversationId) || null;
}

function ensureActiveConversation() {
  let conversation = activeConversation();
  if (conversation) return conversation;

  conversation = {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    title: "Yeni sohbet",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: []
  };
  state.activeConversationId = conversation.id;
  state.conversations.unshift(conversation);
  return conversation;
}

function persistCurrentConversation() {
  if (!state.messages.length && !state.activeConversationId) {
    renderConversationList();
    return;
  }

  const conversation = ensureActiveConversation();
  conversation.messages = cloneMessagesForStorage(state.messages);
  conversation.title = conversationTitle(conversation.messages);
  conversation.updatedAt = Date.now();

  state.conversations = [
    conversation,
    ...state.conversations.filter((item) => item.id !== conversation.id)
  ].slice(0, maxConversations);
  saveConversations();
  renderConversationList();
}

function startNewConversation() {
  state.activeConversationId = "";
  state.messages = [];
  state.pendingChatImages = [];
  renderChatImageTray();
  renderMessages();
  renderConversationList();
}

function openConversation(id) {
  const conversation = state.conversations.find((item) => item.id === id);
  if (!conversation) return;
  state.activeConversationId = id;
  state.messages = conversation.messages.map((message) => ({
    role: message.role,
    content: formatValue(message.content),
    images: Array.isArray(message.images) ? message.images : []
  }));
  state.pendingChatImages = [];
  renderChatImageTray();
  renderMessages();
  renderConversationList();
  setMode("chat");
}

function renderConversationList() {
  if (!els.conversationList) return;
  els.conversationList.innerHTML = "";

  if (!state.conversations.length) {
    const empty = document.createElement("div");
    empty.className = "history-empty";
    empty.textContent = "Henüz geçmiş yok";
    els.conversationList.append(empty);
    return;
  }

  for (const conversation of state.conversations) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "conversation-item";
    item.classList.toggle("active", conversation.id === state.activeConversationId);
    item.title = conversation.title;

    const title = document.createElement("span");
    title.className = "conversation-name";
    title.textContent = conversation.title || "Yeni sohbet";

    const meta = document.createElement("span");
    meta.className = "conversation-meta";
    meta.textContent = new Date(conversation.updatedAt || conversation.createdAt || Date.now()).toLocaleString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });

    item.append(title, meta);
    item.addEventListener("click", () => openConversation(conversation.id));
    els.conversationList.append(item);
  }
}

function openApiModal() {
  els.apiKey.value = storedApiKey();
  els.apiModal.hidden = false;
  requestAnimationFrame(() => els.apiKey.focus());
}

function closeApiModal() {
  els.apiModal.hidden = true;
}

function saveApiKey() {
  const key = els.apiKey.value.trim();
  if (key) {
    localStorage.setItem(apiKeyStorageKey, key);
  } else {
    localStorage.removeItem(apiKeyStorageKey);
  }
  updateApiKeyState();
  closeApiModal();
}

function clearApiKey() {
  els.apiKey.value = "";
  localStorage.removeItem(apiKeyStorageKey);
  updateApiKeyState();
}

function apiHeaders() {
  const headers = { "content-type": "application/json" };
  const key = storedApiKey();
  if (key) headers["x-agnes-api-key"] = key;
  return headers;
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { ...apiHeaders(), ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(formatApiError(data, response.status));
  }
  return data;
}

function formatValue(value) {
  if (value instanceof Error) return value.message;
  if (typeof value === "string") return value;
  if (value === undefined || value === null) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function errorRequestId(text) {
  const match = String(text).match(/request id:\s*([^)]+)/i);
  return match ? match[1].trim() : "";
}

function humanizeError(value) {
  const text = formatValue(value).trim();
  if (!text) return "Bir hata oluştu. Tekrar dene.";

  if (/api key bulunamad|AGNES_API_KEY is missing/i.test(text)) {
    return "API key bulunamadı. Üstteki API Ayarları bölümünden key gir veya .env dosyasına AGNES_API_KEY ekle.";
  }

  if (/agnes_upstream_failed|do_request_failed|upstream error|do request failed/i.test(text)) {
    const requestId = errorRequestId(text);
    const suffix = requestId ? ` İstek ID: ${requestId}` : "";
    return `Agnes API isteği şu anda tamamlayamadı. Bu genelde servis yoğunluğu veya geçici bağlantı hatasıdır. Birkaç saniye sonra tekrar dene.${suffix}`;
  }

  if (/agnes_connection_failed|failed to fetch|ECONN|timeout/i.test(text)) {
    return "Agnes API bağlantısı kurulamadı. İnternet bağlantısını ve Agnes servis durumunu kontrol edip tekrar dene.";
  }

  return text;
}

function formatApiError(data, status) {
  const value = data?.error ?? data?.message ?? data;
  const text = formatValue(value);
  const code = data?.code ? `\nKod: ${data.code}` : "";
  const requestId = data?.request_id ? `\nİstek ID: ${data.request_id}` : "";
  const output = text && text !== "{}" ? `${text}${code}${requestId}` : `HTTP ${status}`;
  return humanizeError(output);
}

function extractAssistantText(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const text = content
      .map((part) => {
        if (typeof part === "string") return part;
        return part?.text || part?.content || "";
      })
      .filter(Boolean)
      .join("\n");
    if (text) return text;
  }
  return formatValue(content || data?.output_text || data?.response || data);
}

function setBusy(button, busy, label) {
  if (!button.dataset.label) button.dataset.label = button.textContent;
  button.disabled = busy;
  button.textContent = busy ? label : button.dataset.label;
}

function appendInlineMarkdown(parent, text) {
  const tokenPattern = /(\*\*\*[^*]+?\*\*\*|\*\*[^*]+?\*\*|\*[^*]+?\*|`[^`]+?`|https?:\/\/[^\s<>()]+)/g;
  let cursor = 0;

  for (const match of text.matchAll(tokenPattern)) {
    if (match.index > cursor) {
      parent.append(document.createTextNode(text.slice(cursor, match.index)));
    }

    const token = match[0];
    if (token.startsWith("http")) {
      const link = document.createElement("a");
      link.href = token;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = token;
      parent.append(link);
    } else if (token.startsWith("`")) {
      const code = document.createElement("code");
      code.textContent = token.slice(1, -1);
      parent.append(code);
    } else if (token.startsWith("***")) {
      const strong = document.createElement("strong");
      const em = document.createElement("em");
      em.textContent = token.slice(3, -3);
      strong.append(em);
      parent.append(strong);
    } else if (token.startsWith("**")) {
      const strong = document.createElement("strong");
      strong.textContent = token.slice(2, -2);
      parent.append(strong);
    } else if (token.startsWith("*")) {
      const em = document.createElement("em");
      em.textContent = token.slice(1, -1);
      parent.append(em);
    }

    cursor = match.index + token.length;
  }

  if (cursor < text.length) {
    parent.append(document.createTextNode(text.slice(cursor)));
  }
}

function flushParagraph(container, lines) {
  if (!lines.length) return;
  const paragraph = document.createElement("p");
  appendInlineMarkdown(paragraph, lines.join("\n"));
  container.append(paragraph);
  lines.length = 0;
}

function appendList(container, items, ordered) {
  if (!items.length) return;
  const list = document.createElement(ordered ? "ol" : "ul");
  for (const item of items) {
    const li = document.createElement("li");
    appendInlineMarkdown(li, item);
    list.append(li);
  }
  container.append(list);
  items.length = 0;
}

function renderMarkdown(container, content) {
  const lines = formatValue(content).replace(/\r\n/g, "\n").split("\n");
  const paragraph = [];
  const unordered = [];
  const ordered = [];
  let codeBlock = null;

  const flushAll = () => {
    flushParagraph(container, paragraph);
    appendList(container, unordered, false);
    appendList(container, ordered, true);
  };

  for (const line of lines) {
    const fence = line.match(/^```(\w+)?\s*$/);
    if (fence) {
      if (codeBlock) {
        const pre = document.createElement("pre");
        const code = document.createElement("code");
        code.textContent = codeBlock.lines.join("\n");
        pre.append(code);
        container.append(pre);
        codeBlock = null;
      } else {
        flushAll();
        codeBlock = { lines: [] };
      }
      continue;
    }

    if (codeBlock) {
      codeBlock.lines.push(line);
      continue;
    }

    if (!line.trim()) {
      flushAll();
      continue;
    }

    if (/^(\*\*\*|---|___)\s*$/.test(line.trim())) {
      flushAll();
      container.append(document.createElement("hr"));
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushAll();
      const level = String(Math.min(heading[1].length + 2, 5));
      const h = document.createElement(`h${level}`);
      appendInlineMarkdown(h, heading[2].trim());
      container.append(h);
      continue;
    }

    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraph(container, paragraph);
      appendList(container, ordered, true);
      unordered.push(bullet[1].trim());
      continue;
    }

    const numbered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (numbered) {
      flushParagraph(container, paragraph);
      appendList(container, unordered, false);
      ordered.push(numbered[1].trim());
      continue;
    }

    appendList(container, unordered, false);
    appendList(container, ordered, true);
    paragraph.push(line);
  }

  flushAll();
  if (codeBlock) {
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    code.textContent = codeBlock.lines.join("\n");
    pre.append(code);
    container.append(pre);
  }
}

function renderMessages() {
  els.messages.innerHTML = "";
  for (const message of state.messages) {
    const item = document.createElement("div");
    item.className = `message ${message.role}`;
    if (message.loading) {
      const loader = document.createElement("div");
      loader.className = "ai-loading";
      const text = document.createElement("span");
      text.textContent = "Kripto Kurdu AI çalışıyor";
      const dots = document.createElement("span");
      dots.className = "ai-loading-dots";
      dots.setAttribute("aria-hidden", "true");
      dots.append(document.createElement("i"), document.createElement("i"), document.createElement("i"));
      loader.append(text, dots);
      item.append(loader);
    } else if (message.content) {
      renderMarkdown(item, message.content);
    }
    if (message.images?.length) {
      const gallery = document.createElement("div");
      gallery.className = "message-images";
      for (const image of message.images) {
        const img = document.createElement("img");
        img.src = image.url;
        img.alt = image.name || "Ekli görsel";
        gallery.append(img);
      }
      item.append(gallery);
    }
    els.messages.append(item);
  }
  els.messages.scrollTop = els.messages.scrollHeight;
}

function addMessage(role, content, images = []) {
  state.messages.push({ role, content: formatValue(content), images });
  renderMessages();
  persistCurrentConversation();
}

function addLoadingMessage() {
  const message = { role: "assistant", content: "", loading: true };
  state.messages.push(message);
  renderMessages();
  return message;
}

function finishLoadingMessage(message, role, content) {
  message.role = role;
  message.content = formatValue(content);
  message.loading = false;
  renderMessages();
  persistCurrentConversation();
}

function setMode(mode) {
  state.mode = mode;
  document.body.dataset.mode = mode;
  els.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.mode === mode));
  els.views.forEach((view) => view.classList.toggle("active", view.id === `${mode}View`));
  els.settings.forEach((setting) => {
    const modes = String(setting.dataset.setting || "").split(/\s+/);
    setting.classList.toggle("is-hidden", !modes.includes("common") && !modes.includes(mode));
  });

  if (mode === "chat") els.model.value = "agnes-2.0-flash";
  if (mode === "image" && !els.model.value.startsWith("agnes-image")) els.model.value = "agnes-image-2.1-flash";
  if (mode === "video") els.model.value = "agnes-video-v2.0";
}

function lines(value) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function cleanText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function textValue(element) {
  return element ? cleanText(element.value) : "";
}

function numberValue(element) {
  if (!element) return undefined;
  const raw = String(element.value || "").trim();
  if (!raw) return undefined;
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) ? value : undefined;
}

function setNumberIfPresent(target, key, element) {
  const value = numberValue(element);
  if (value !== undefined) target[key] = value;
}

function addField(parts, label, value) {
  const cleaned = cleanText(value);
  if (cleaned) parts.push(`${label}: ${cleaned}`);
}

function buildImagePrompt() {
  const raw = textValue(els.imagePrompt);
  if (!raw) return "";
  if (!els.enhanceImagePrompt.checked) return raw;

  const parts = [raw];
  addField(parts, "Konu", textValue(els.imageSubject));
  addField(parts, "Ortam ve mekan", textValue(els.imageEnvironment));
  addField(parts, "Işık", textValue(els.imageLighting));
  addField(parts, "Kamera ve bakış açısı", textValue(els.imageCamera));
  addField(parts, "Üst baş, saç, el ve detay", textValue(els.imageAppearance));
  parts.push(imageStylePrompts[els.imageStyle.value] || imageStylePrompts.realistic);
  addField(parts, "Kaçınılacaklar", textValue(els.imageNegative));

  return parts.join(", ");
}

function updateImagePromptPreview() {
  const prompt = buildImagePrompt();
  els.imagePromptPreview.textContent = prompt || "Prompt yazınca burada gönderilecek net hali görünür.";
}

function buildVideoPrompt() {
  const raw = textValue(els.videoPrompt);
  if (!raw) return "";
  if (!els.enhanceVideoPrompt.checked) return raw;

  const parts = [raw];
  addField(parts, "Konu", textValue(els.videoSubject));
  addField(parts, "Ortam ve mekan", textValue(els.videoEnvironment));
  addField(parts, "Işık", textValue(els.videoLighting));
  addField(parts, "Kamera ve bakış açısı", textValue(els.videoCamera));
  addField(parts, "Hareket", textValue(els.videoMotion));
  addField(parts, "Üst baş, saç, el ve detay", textValue(els.videoAppearance));
  parts.push(videoStylePrompts[els.videoStyle.value] || videoStylePrompts.realistic);

  return parts.join(", ");
}

function updateVideoPromptPreview() {
  const prompt = buildVideoPrompt();
  els.videoPromptPreview.textContent = prompt || "Prompt yazınca burada gönderilecek video promptu görünür.";
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Görsel okunamadı."));
    reader.readAsDataURL(file);
  });
}

function renderChatImageTray() {
  els.chatImageTray.innerHTML = "";
  els.chatImageTray.classList.toggle("is-empty", state.pendingChatImages.length === 0);

  for (const image of state.pendingChatImages) {
    const item = document.createElement("div");
    item.className = "chat-image-chip";

    const img = document.createElement("img");
    img.src = image.url;
    img.alt = image.name || "Yapıştırılan görsel";

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "X";
    remove.title = "Resmi kaldır";
    remove.addEventListener("click", () => {
      state.pendingChatImages = state.pendingChatImages.filter((entry) => entry.id !== image.id);
      renderChatImageTray();
    });

    item.append(img, remove);
    els.chatImageTray.append(item);
  }
}

async function handleChatPaste(event) {
  const items = Array.from(event.clipboardData?.items || []);
  const imageItems = items.filter((item) => item.type.startsWith("image/"));
  if (!imageItems.length) return;

  event.preventDefault();
  for (const item of imageItems) {
    const file = item.getAsFile();
    if (!file) continue;
    const url = await fileToDataUrl(file);
    state.pendingChatImages.push({
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      name: file.name || "pasted-image",
      url
    });
  }
  renderChatImageTray();
}

function messageContentForApi(message) {
  if (!message.images?.length) return message.content;
  const parts = [];
  if (message.content) {
    parts.push({ type: "text", text: message.content });
  }
  for (const image of message.images) {
    parts.push({ type: "image_url", image_url: { url: image.url } });
  }
  return parts;
}

function renderJson(container, data, summary = "Yanıt detayları") {
  const details = document.createElement("details");
  details.className = "json-details";
  const title = document.createElement("summary");
  title.textContent = summary;
  const pre = document.createElement("pre");
  pre.className = "json-output";
  pre.textContent = JSON.stringify(data, null, 2);
  details.append(title, pre);
  container.append(details);
}

function renderError(container, error, details = null) {
  const box = document.createElement("div");
  box.className = "result-error";
  box.textContent = humanizeError(error);
  container.append(box);
  if (details) renderJson(container, details, "Yanıt detayları");
}

function fileNameFromUrl(url, fallback) {
  try {
    const path = new URL(url).pathname;
    const name = path.split("/").filter(Boolean).pop();
    return name && /\.[a-z0-9]+$/i.test(name) ? name : fallback;
  } catch {
    return fallback;
  }
}

function proxiedMediaUrl(url, fileName, download = false) {
  const params = new URLSearchParams({ url, name: fileName });
  if (download) params.set("download", "1");
  return `/api/media?${params.toString()}`;
}

function setMediaStatus(statusElement, text, duration = 2800) {
  statusElement.textContent = text;
  window.setTimeout(() => {
    statusElement.textContent = "";
  }, duration);
}

async function fetchMediaBlob(url, fileName) {
  const response = await fetch(proxiedMediaUrl(url, fileName));
  if (!response.ok) throw new Error("Medya alınamadı");
  return response.blob();
}

async function imageBlobToPng(blob) {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = objectUrl;
    await image.decode();

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0);

    return await new Promise((resolve, reject) => {
      canvas.toBlob((pngBlob) => {
        if (pngBlob) resolve(pngBlob);
        else reject(new Error("PNG oluşturulamadı"));
      }, "image/png");
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function downloadMedia(url, type, fileName, statusElement) {
  try {
    const blob = await fetchMediaBlob(url, fileName);
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    setMediaStatus(statusElement, type === "video" ? "Video indiriliyor" : "Resim indiriliyor");
  } catch {
    setMediaStatus(statusElement, type === "video" ? "Video indirilemedi" : "Resim indirilemedi");
  }
}

async function copyMedia(url, type, fileName, statusElement) {
  const setStatus = (text) => {
    setMediaStatus(statusElement, text);
  };

  if (!navigator.clipboard?.write || !window.ClipboardItem) {
    setStatus("Tarayıcı medya kopyalamayı desteklemiyor");
    return false;
  }

  try {
    const blob = await fetchMediaBlob(url, fileName);
    if (type === "image") {
      const pngBlob = await imageBlobToPng(blob);
      await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })]);
      setStatus("Resim panoya kopyalandı");
      return true;
    }

    await navigator.clipboard.write([new ClipboardItem({ [blob.type || "video/mp4"]: blob })]);
    setStatus("Video panoya kopyalandı");
    return true;
  } catch {
    setStatus(type === "video" ? "Video kopyalanamadı" : "Resim kopyalanamadı");
    return false;
  }
}

function createMediaActions({ url, type, index = 0 }) {
  const actions = document.createElement("div");
  actions.className = "media-actions";

  const fileName = fileNameFromUrl(url, type === "video" ? `kripto-kurdu-video-${index + 1}.mp4` : `kripto-kurdu-gorsel-${index + 1}.png`);

  const open = document.createElement("a");
  open.href = url;
  open.target = "_blank";
  open.rel = "noopener noreferrer";
  open.textContent = "Aç";

  const download = document.createElement("button");
  download.type = "button";
  download.textContent = type === "video" ? "Videoyu indir" : "Resmi indir";

  const status = document.createElement("span");
  status.className = "media-action-status";
  status.setAttribute("aria-live", "polite");

  download.addEventListener("click", () => downloadMedia(url, type, fileName, status));

  actions.append(open, download);
  if (type === "image") {
    const copy = document.createElement("button");
    copy.type = "button";
    copy.textContent = "Resmi kopyala";
    copy.addEventListener("click", () => copyMedia(url, type, fileName, status));
    actions.append(copy);
  }
  actions.append(status);
  return actions;
}

function renderImageResult(data, finalPrompt) {
  els.imageOutput.innerHTML = "";
  const urls = Array.isArray(data.data) ? data.data.map((item) => item.url).filter(Boolean) : [];

  if (finalPrompt) {
    const promptBox = document.createElement("div");
    promptBox.className = "result-prompt";
    promptBox.textContent = finalPrompt;
    els.imageOutput.append(promptBox);
  }

  if (!urls.length) {
    renderError(els.imageOutput, "Görsel URL'i bulunamadı. Agnes yanıtı beklenen formatta gelmedi.", data);
    return;
  }

  urls.forEach((url, index) => {
    const img = document.createElement("img");
    img.src = url;
    img.alt = "Üretilen görsel";
    els.imageOutput.append(img);
    els.imageOutput.append(createMediaActions({ url, type: "image", index }));
  });
  renderJson(els.imageOutput, data, "Yanıt detayları");
}

function collectObjects(value, output = []) {
  if (!value || typeof value !== "object") return output;
  output.push(value);
  if (Array.isArray(value)) {
    for (const item of value) collectObjects(item, output);
    return output;
  }
  for (const child of Object.values(value)) collectObjects(child, output);
  return output;
}

function findFirstByKeys(data, keys, validator = (value) => value !== undefined && value !== null && value !== "") {
  for (const object of collectObjects(data)) {
    for (const key of keys) {
      const value = object[key];
      if (validator(value)) return value;
    }
  }
  return null;
}

function normalizeProgress(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "string") {
    const number = Number(value.replace("%", "").replace(",", ".").trim());
    return Number.isFinite(number) ? number : value;
  }
  return value;
}

function videoStatusLabel(status, progress) {
  const normalized = String(status || "").toLowerCase();
  if (["queued", "pending", "waiting"].includes(normalized)) return "Sırada bekliyor";
  if (["processing", "running", "generating", "in_progress"].includes(normalized)) return "Üretiliyor";
  if (["completed", "succeeded", "success"].includes(normalized)) return "Tamamlandı";
  if (["failed", "error", "cancelled", "canceled"].includes(normalized)) return "Hata/iptal";
  if (progress === 0) return "Hazırlanıyor";
  return "";
}

function extractVideoInfo(data) {
  const progress = normalizeProgress(
    findFirstByKeys(
      data,
      ["progress", "percent", "percentage", "progress_percent", "completed_percent"],
      (value) => value !== undefined && value !== null && value !== ""
    )
  );

  return {
    raw: data,
    taskId: findFirstByKeys(data, ["task_id", "id"], (value) => typeof value === "string" && value.length > 0),
    status: findFirstByKeys(data, ["status", "state"], (value) => typeof value === "string" && value.length > 0),
    progress,
    seconds: findFirstByKeys(data, ["seconds"], (value) => value !== undefined && value !== null),
    size: findFirstByKeys(data, ["size"], (value) => typeof value === "string" && value.length > 0),
    error: findFirstByKeys(data, ["error"], (value) => value),
    videoUrl: findFirstByKeys(
      data,
      ["video_url", "url", "remixed_from_video_id", "output_url"],
      (value) => typeof value === "string" && /^https?:\/\//.test(value)
    )
  };
}

function renderVideoResult(data, options = {}) {
  els.videoOutput.innerHTML = "";
  if (options.prompt) {
    const promptBox = document.createElement("div");
    promptBox.className = "result-prompt";
    promptBox.textContent = options.prompt;
    els.videoOutput.append(promptBox);
  }

  const info = extractVideoInfo(data);
  if (info.taskId) els.taskId.value = info.taskId;

  const status = document.createElement("div");
  status.className = "video-status";
  const title = document.createElement("div");
  title.className = "video-status-title";
  title.textContent = info.status ? `Durum: ${info.status}` : "Task bilgisi";
  const meta = document.createElement("div");
  meta.className = "video-status-meta";
  const metaParts = [];
  if (info.taskId) metaParts.push(`Task ID: ${info.taskId}`);
  const statusLabel = videoStatusLabel(info.status, info.progress);
  if (statusLabel) metaParts.push(`Aşama: ${statusLabel}`);
  if (info.progress !== null) metaParts.push(`İlerleme: ${info.progress}%`);
  if (info.seconds !== null) metaParts.push(`Süre: ${info.seconds}`);
  if (info.size) metaParts.push(`Boyut: ${info.size}`);
  if (options.polling) {
    metaParts.push(`Kontrol: ${options.pollIndex || 1}`);
    metaParts.push(`Son kontrol: ${new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`);
  }
  if (options.pollStopped) metaParts.push("Takip durduruldu; Sonucu Çek ile devam edebilirsin");
  meta.textContent = metaParts.join(" | ") || "Cevap alındı.";
  status.append(title, meta);

  if (typeof info.progress === "number") {
    const progressOuter = document.createElement("div");
    progressOuter.className = "video-progress";
    const progressInner = document.createElement("div");
    progressInner.style.width = `${Math.max(0, Math.min(100, info.progress))}%`;
    progressOuter.append(progressInner);
    status.append(progressOuter);
  }

  if (info.error) {
    const error = document.createElement("div");
    error.className = "video-status-error";
    error.textContent = humanizeError(info.error);
    status.append(error);
  }

  els.videoOutput.append(status);

  if (info.videoUrl) {
    const video = document.createElement("video");
    video.src = info.videoUrl;
    video.controls = true;
    video.autoplay = false;
    els.videoOutput.append(video);
    els.videoOutput.append(createMediaActions({ url: info.videoUrl, type: "video" }));
  }
  renderJson(els.videoOutput, data, "Yanıt detayları");
  return info;
}

function updateVideoHint() {
  const frames = Number(els.frames.value);
  const fps = Number(els.fps.value);
  if (!Number.isFinite(frames) || !Number.isFinite(fps) || fps <= 0) {
    els.videoHint.textContent = "Süre hesaplanamadı.";
    return;
  }
  els.videoHint.textContent = `Süre: ${frames} / ${fps} = ${(frames / fps).toFixed(2)} sn`;
}

function applyVideoPreset() {
  const value = els.videoPreset?.value || "";
  const match = value.match(/^(\d+)x(\d+):(\d+):(\d+)$/);
  if (!match) return;
  els.width.value = match[1];
  els.height.value = match[2];
  els.frames.value = match[3];
  els.fps.value = match[4];
  updateVideoHint();
}

async function pollVideoTask(taskId, prompt = "") {
  let lastInfo = null;
  const controller = new AbortController();
  state.videoPollAbort = controller;

  for (let index = 0; !controller.signal.aborted; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, index === 0 ? 2500 : 7000));
    if (controller.signal.aborted) break;

    const data = await request(`/api/videos/${encodeURIComponent(taskId)}`, { method: "GET" });
    lastInfo = renderVideoResult(data, { polling: true, pollIndex: index + 1, prompt });

    const status = String(lastInfo.status || "").toLowerCase();
    if (lastInfo.videoUrl || ["completed", "succeeded", "success", "failed", "error", "cancelled"].includes(status)) {
      state.videoPollAbort = null;
      return lastInfo;
    }
  }

  if (lastInfo) renderVideoResult(lastInfo.raw || { status: lastInfo.status, task_id: lastInfo.taskId }, { prompt, pollStopped: true });
  state.videoPollAbort = null;
  return lastInfo;
}

async function sendChat(event) {
  event.preventDefault();
  const content = els.chatInput.value.trim();
  const images = [...state.pendingChatImages];
  if (!content && !images.length) return;

  addMessage("user", content, images);
  els.chatInput.value = "";
  state.pendingChatImages = [];
  renderChatImageTray();
  setBusy(els.chatForm.querySelector("button"), true, "Yazıyor");

  const apiMessages = state.messages
    .filter((message) => !message.loading && (message.role === "user" || message.role === "assistant"))
    .slice(-maxStoredMessages)
    .map((message) => ({ role: message.role, content: messageContentForApi(message) }));
  const loadingMessage = addLoadingMessage();

  const payload = {
    model: els.model.value,
    messages: apiMessages,
    temperature: Number(els.temperature.value),
    max_tokens: Number(els.maxTokens.value)
  };
  setNumberIfPresent(payload, "top_p", els.topP);
  setNumberIfPresent(payload, "seed", els.chatSeed);
  setNumberIfPresent(payload, "frequency_penalty", els.frequencyPenalty);
  setNumberIfPresent(payload, "presence_penalty", els.presencePenalty);
  setNumberIfPresent(payload, "repetition_penalty", els.repetitionPenalty);
  if (textValue(els.chatStop)) payload.stop = textValue(els.chatStop);

  try {
    const data = await request("/api/chat", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    const reply = extractAssistantText(data);
    finishLoadingMessage(loadingMessage, "assistant", reply);
  } catch (error) {
    finishLoadingMessage(loadingMessage, "error", humanizeError(error));
  } finally {
    setBusy(els.chatForm.querySelector("button"), false);
  }
}

function handleChatKeydown(event) {
  if (event.key !== "Enter" || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
  event.preventDefault();
  if (!els.chatForm.querySelector("button").disabled) {
    els.chatForm.requestSubmit();
  }
}

async function generateImage() {
  const prompt = buildImagePrompt();
  if (!prompt) return;

  setBusy(els.generateImage, true, "Üretiliyor");
  els.imageOutput.innerHTML = "";

  const imageList = lines(els.imageUrls.value);
  const payload = {
    model: els.model.value.startsWith("agnes-image") ? els.model.value : "agnes-image-2.1-flash",
    prompt,
    size: els.size.value
  };
  setNumberIfPresent(payload, "seed", els.imageSeed);

  if (imageList.length) {
    payload.tags = ["img2img"];
    payload.extra_body = { image: imageList, response_format: "url" };
  }

  try {
    const data = await request("/api/images", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    renderImageResult(data, prompt);
  } catch (error) {
    renderError(els.imageOutput, error);
  } finally {
    setBusy(els.generateImage, false);
  }
}

async function generateVideo() {
  if (state.videoPollAbort) {
    state.videoPollAbort.abort();
    setMediaStatus(els.videoHint, "Takip durduruldu. Task ID ile Sonucu Çek kullanabilirsin.");
    els.generateVideo.disabled = false;
    els.generateVideo.textContent = els.generateVideo.dataset.label || "Video Task Aç";
    return;
  }

  const prompt = buildVideoPrompt();
  if (!prompt) return;

  setBusy(els.generateVideo, true, "Task açılıyor");
  els.videoOutput.innerHTML = "";
  state.currentVideoPrompt = prompt;

  const imageList = lines(els.videoImages.value);
  if (els.keyframes.checked && imageList.length < 2) {
    renderError(els.videoOutput, "Keyframe modu için en az iki görsel URL'i gerekir.");
    setBusy(els.generateVideo, false);
    return;
  }

  const payload = {
    model: els.model.value.startsWith("agnes-video") ? els.model.value : "agnes-video-v2.0",
    prompt,
    width: Number(els.width.value),
    height: Number(els.height.value),
    num_frames: Number(els.frames.value),
    frame_rate: Number(els.fps.value)
  };
  setNumberIfPresent(payload, "seed", els.videoSeed);
  setNumberIfPresent(payload, "num_inference_steps", els.videoSteps);
  if (textValue(els.videoNegative)) payload.negative_prompt = textValue(els.videoNegative);

  if (imageList.length === 1 && !els.keyframes.checked) {
    payload.image = imageList[0];
  }

  if (imageList.length > 1 || els.keyframes.checked) {
    payload.extra_body = { image: imageList };
    if (els.keyframes.checked) payload.extra_body.mode = "keyframes";
  }

  try {
    const data = await request("/api/videos", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    const info = renderVideoResult(data, { prompt });
    if (els.autoPollVideo.checked && info.taskId && !info.videoUrl) {
      els.generateVideo.disabled = false;
      els.generateVideo.textContent = "Takibi durdur";
      await pollVideoTask(info.taskId, prompt);
    }
  } catch (error) {
    renderError(els.videoOutput, error);
  } finally {
    state.videoPollAbort = null;
    setBusy(els.generateVideo, false);
  }
}

async function pollVideo() {
  const taskId = els.taskId.value.trim();
  if (!taskId) return;

  setBusy(els.pollVideo, true, "Çekiliyor");
  try {
    const data = await request(`/api/videos/${encodeURIComponent(taskId)}`, { method: "GET" });
    renderVideoResult(data, { prompt: state.currentVideoPrompt });
  } catch (error) {
    renderError(els.videoOutput, error);
  } finally {
    setBusy(els.pollVideo, false);
  }
}

function bindPromptPreview(elements, handler) {
  elements.filter(Boolean).forEach((element) => {
    element.addEventListener("input", handler);
    element.addEventListener("change", handler);
  });
}

async function init() {
  els.tabs.forEach((tab) => tab.addEventListener("click", () => setMode(tab.dataset.mode)));
  els.chatForm.addEventListener("submit", sendChat);
  els.chatInput.addEventListener("keydown", handleChatKeydown);
  els.chatInput.addEventListener("paste", handleChatPaste);
  renderChatImageTray();
  els.generateImage.addEventListener("click", generateImage);
  els.generateVideo.addEventListener("click", generateVideo);
  els.pollVideo.addEventListener("click", pollVideo);
  if (els.newConversation) els.newConversation.addEventListener("click", startNewConversation);
  if (els.videoPreset) els.videoPreset.addEventListener("change", applyVideoPreset);
  [els.frames, els.fps].forEach((element) => element.addEventListener("input", updateVideoHint));
  applyVideoPreset();
  updateVideoHint();
  els.clearBtn.addEventListener("click", () => {
    els.imageOutput.innerHTML = "";
    els.videoOutput.innerHTML = "";
    startNewConversation();
  });
  els.apiSettingsBtn.addEventListener("click", openApiModal);
  els.apiModalClose.addEventListener("click", closeApiModal);
  els.saveApiKey.addEventListener("click", saveApiKey);
  els.clearApiKey.addEventListener("click", clearApiKey);
  els.apiModal.addEventListener("click", (event) => {
    if (event.target === els.apiModal) closeApiModal();
  });
  els.apiKey.addEventListener("keydown", (event) => {
    if (event.key === "Enter") saveApiKey();
    if (event.key === "Escape") closeApiModal();
  });

  bindPromptPreview(
    [
      els.imagePrompt,
      els.imageSubject,
      els.imageEnvironment,
      els.imageLighting,
      els.imageCamera,
      els.imageAppearance,
      els.imageNegative,
      els.enhanceImagePrompt,
      els.imageStyle
    ],
    updateImagePromptPreview
  );
  updateImagePromptPreview();

  bindPromptPreview(
    [
      els.videoPrompt,
      els.videoSubject,
      els.videoEnvironment,
      els.videoLighting,
      els.videoCamera,
      els.videoMotion,
      els.videoAppearance,
      els.videoNegative,
      els.enhanceVideoPrompt,
      els.videoStyle
    ],
    updateVideoPromptPreview
  );
  updateVideoPromptPreview();
  setMode("chat");
  loadConversations();
  if (state.conversations.length) openConversation(state.conversations[0].id);
  else renderConversationList();

  const oldSessionKey = sessionStorage.getItem("agnes_api_key") || "";
  if (oldSessionKey && !storedApiKey()) {
    localStorage.setItem(apiKeyStorageKey, oldSessionKey);
    sessionStorage.removeItem("agnes_api_key");
  }
  updateApiKeyState();

  try {
    const status = await request("/api/status", { method: "GET" });
    state.hasServerKey = Boolean(status.hasServerKey);
    updateApiKeyState();
  } catch {
    els.keyState.textContent = "Key durumu yok";
    els.apiSettingsBtn.classList.remove("ok");
    els.apiSettingsBtn.classList.add("missing");
  }

}

init();
