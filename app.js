"use strict";

const STORAGE_KEY = "go-joseki-memory:v1";
const LAST_SYNC_KEY = "go-joseki-memory:last-cloud-sync";
const SUPABASE_TABLE = "go_joseki_stores";
const CLOUD_SAVE_DEBOUNCE_MS = 900;
const PRINT_HISTORY_LIMIT = 80;

window.GO_JOSEKI_APP_OWNS_SUPABASE_SYNC = true;

const dom = {
  categoryList: document.getElementById("categoryList"),
  categoryForm: document.getElementById("categoryForm"),
  newCategoryName: document.getElementById("newCategoryName"),
  tagFilterList: document.getElementById("tagFilterList"),
  clearTagFilter: document.getElementById("clearTagFilter"),
  recordCount: document.getElementById("recordCount"),
  workspace: document.getElementById("workspace"),
  leftPaneToggle: document.getElementById("leftPaneToggle"),
  rightPaneToggle: document.getElementById("rightPaneToggle"),
  accountPanelButton: document.getElementById("accountPanelButton"),
  topContext: document.getElementById("topContext"),
  sideRecordList: document.getElementById("sideRecordList"),
  recordTitle: document.getElementById("recordTitle"),
  recordCategory: document.getElementById("recordCategory"),
  variantName: document.getElementById("variantName"),
  variantAdvantage: document.getElementById("variantAdvantage"),
  recordTags: document.getElementById("recordTags"),
  customBoardSize: document.getElementById("customBoardSize"),
  goBoard: document.getElementById("goBoard"),
  feedback: document.getElementById("feedback"),
  practiceProgress: document.getElementById("practiceProgress"),
  recordNotes: document.getElementById("recordNotes"),
  moveList: document.getElementById("moveList"),
  moveCountLabel: document.getElementById("moveCountLabel"),
  recordCards: document.getElementById("recordCards"),
  modeSelector: document.getElementById("modeSelector"),
  editToolSelector: document.getElementById("editToolSelector"),
  editTools: document.getElementById("editTools"),
  recordSequenceButton: document.getElementById("recordSequenceButton"),
  recordingHint: document.getElementById("recordingHint"),
  clearVariationButton: document.getElementById("clearVariationButton"),
  fitBoardButton: document.getElementById("fitBoardButton"),
  zoomInButton: document.getElementById("zoomInButton"),
  zoomOutButton: document.getElementById("zoomOutButton"),
  correctionSelector: document.getElementById("correctionSelector"),
  hintToggle: document.getElementById("hintToggle"),
  attemptCount: document.getElementById("attemptCount"),
  accuracyRate: document.getElementById("accuracyRate"),
  streakCount: document.getElementById("streakCount"),
  lastResult: document.getElementById("lastResult"),
  startPracticeButton: document.getElementById("startPracticeButton"),
  undoMoveButton: document.getElementById("undoMoveButton"),
  showAnswerButton: document.getElementById("showAnswerButton"),
  editRecordButton: document.getElementById("editRecordButton"),
  newRecordButton: document.getElementById("newRecordButton"),
  newVariantButton: document.getElementById("newVariantButton"),
  duplicateRecordButton: document.getElementById("duplicateRecordButton"),
  deleteRecordButton: document.getElementById("deleteRecordButton"),
  deleteJosekiButton: document.getElementById("deleteJosekiButton"),
  archiveRecordButton: document.getElementById("archiveRecordButton"),
  archiveSelect: document.getElementById("archiveSelect"),
  restoreArchiveButton: document.getElementById("restoreArchiveButton"),
  deleteArchiveButton: document.getElementById("deleteArchiveButton"),
  archiveStatus: document.getElementById("archiveStatus"),
  shufflePracticeButton: document.getElementById("shufflePracticeButton"),
  resetPracticeButton: document.getElementById("resetPracticeButton"),
  importButton: document.getElementById("importButton"),
  importFile: document.getElementById("importFile"),
  moreMenuButton: document.getElementById("moreMenuButton"),
  topMoreMenu: document.getElementById("topMoreMenu"),
  exportCurrentButton: document.getElementById("exportCurrentButton"),
  exportAllButton: document.getElementById("exportAllButton"),
  printButton: document.getElementById("printButton"),
  printPanelButton: document.getElementById("printPanelButton"),
  boardTheme: document.getElementById("boardTheme"),
  printScope: document.getElementById("printScope"),
  printSelectionList: document.getElementById("printSelectionList"),
  printHistorySummary: document.getElementById("printHistorySummary"),
  printHistoryList: document.getElementById("printHistoryList"),
  clearPrintHistoryButton: document.getElementById("clearPrintHistoryButton"),
  includeAnswers: document.getElementById("includeAnswers"),
  printRoot: document.getElementById("printRoot"),
  practiceSummary: document.getElementById("practiceSummary"),
  summaryBody: document.getElementById("summaryBody"),
  summaryRetryButton: document.getElementById("summaryRetryButton"),
  summaryNextButton: document.getElementById("summaryNextButton"),
  summaryCloseButton: document.getElementById("summaryCloseButton"),
  accountSyncDetails: document.getElementById("accountSyncDetails"),
  authPanel: document.getElementById("authPanel"),
  authAccountLabel: document.getElementById("authAccountLabel"),
  authEmail: document.getElementById("authEmail"),
  authPassword: document.getElementById("authPassword"),
  signInButton: document.getElementById("signInButton"),
  signUpButton: document.getElementById("signUpButton"),
  signOutButton: document.getElementById("signOutButton"),
  syncNowButton: document.getElementById("syncNowButton"),
  syncStatus: document.getElementById("syncStatus"),
  syncHelp: document.getElementById("syncHelp"),
};

const ui = {
  selectedCategoryId: "all",
  selectedTags: new Set(),
  selectedRecordId: "",
  mode: "edit",
  editTool: "alternate",
  isRecordingSequence: false,
  correctionMode: "instant",
  hintsEnabled: false,
  practiceHint: null,
  reviewHints: [],
  practiceResult: null,
  choiceSelection: null,
  sequenceAnswers: [],
  freeMoves: [],
  showAnswer: false,
  printLayout: "grid",
  selectedPrintIds: new Set(),
  boardZoom: 1,
  selectedMoveIndex: -1,
  sidebarCollapsed: false,
  rightPanelCollapsed: false,
  hasUnsavedEdit: false,
  currentStreak: 0,
};

const cloud = {
  client: null,
  session: null,
  user: null,
  configured: false,
  initializing: false,
  syncing: false,
  applyingRemote: false,
  saveTimer: null,
  lastSyncedAt: localStorage.getItem(LAST_SYNC_KEY) || "",
  lastError: "",
  statusText: "本地保存",
};

let store = loadStore();
ensureValidSelection();
render();
initCloudSync();

function createDefaultStore() {
  const now = new Date().toISOString();
  const categoryBasics = {
    id: createId("cat"),
    name: "小目定式",
    color: "#0e9488",
    createdAt: now,
    updatedAt: now,
  };
  const categoryStar = {
    id: createId("cat"),
    name: "星位定式",
    color: "#f0c44c",
    createdAt: now,
    updatedAt: now,
  };
  const categoryCorner = {
    id: createId("cat"),
    name: "三三入侵",
    color: "#7aa36f",
    createdAt: now,
    updatedAt: now,
  };

  const records = [
    {
      id: createId("rec"),
      title: "小目一间高挂",
      categoryId: categoryBasics.id,
      tags: ["入门", "常见"],
      boardSize: 9,
      initialMoves: [
        move(2, 6, "black", 1),
        move(2, 2, "white", 2),
        move(4, 2, "black", 3),
      ],
      choicePoints: [
        choicePoint(3, 4),
        choicePoint(5, 4),
        choicePoint(1, 5),
      ],
      answerMoves: [
        move(3, 4, "white", 4),
        move(4, 4, "black", 5),
        move(5, 3, "white", 6),
      ],
      notes: "先记住方向：靠角的一侧要保持连接。",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: createId("rec"),
      title: "星位小飞守角",
      categoryId: categoryStar.id,
      tags: ["入门", "本周复习"],
      boardSize: 9,
      initialMoves: [
        move(2, 2, "black", 1),
        move(5, 2, "white", 2),
      ],
      choicePoints: [choicePoint(3, 4), choicePoint(4, 4), choicePoint(6, 3)],
      answerMoves: [
        move(3, 4, "black", 3),
        move(5, 4, "white", 4),
        move(4, 5, "black", 5),
      ],
      notes: "小飞守角要注意形状轻灵。",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: createId("rec"),
      title: "三三入侵基础",
      categoryId: categoryCorner.id,
      tags: ["常见", "易错"],
      boardSize: 9,
      initialMoves: [
        move(2, 2, "black", 1),
        move(2, 3, "white", 2),
        move(3, 2, "black", 3),
      ],
      choicePoints: [choicePoint(3, 3), choicePoint(4, 3), choicePoint(1, 4)],
      answerMoves: [
        move(3, 3, "white", 4),
        move(1, 3, "black", 5),
        move(1, 2, "white", 6),
      ],
      notes: "三三变化要按顺序背，避免先后手颠倒。",
      createdAt: now,
      updatedAt: now,
    },
  ];
  records.forEach((record) => {
    record.josekiId = createId("jos");
    record.variantName = "基础变化";
    record.advantage = "even";
  });

  return {
    version: 1,
    categories: [categoryBasics, categoryStar, categoryCorner],
    records,
    stats: {},
    settings: {
      boardTheme: "wood",
    },
    libraryArchives: [],
    printHistory: [],
  };
}

function move(x, y, color, moveNo) {
  return { x, y, color, moveNo };
}

function choicePoint(x, y, label = "") {
  return { x, y, label };
}

function loadStore() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return createDefaultStore();
    const parsed = JSON.parse(saved);
    if (!parsed || !Array.isArray(parsed.categories) || !Array.isArray(parsed.records)) {
      return createDefaultStore();
    }
    return normalizeStoreData({
      version: 1,
      categories: parsed.categories,
      records: parsed.records,
      stats: parsed.stats || {},
      settings: {
        boardTheme: normalizeBoardTheme(parsed.settings?.boardTheme),
      },
      libraryArchives: parsed.libraryArchives || [],
      printHistory: parsed.printHistory || [],
    });
  } catch (error) {
    console.warn("无法读取本地数据，已载入默认数据。", error);
    return createDefaultStore();
  }
}

function saveStore() {
  saveLocalStore();
  scheduleCloudSave();
}

function saveLocalStore() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (error) {
    const isQuotaError =
      error?.name === "QuotaExceededError" ||
      error?.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      error?.code === 22 ||
      error?.code === 1014;
    if (!isQuotaError || (!store.libraryArchives?.length && !store.printHistory?.length)) throw error;
    let removedCount = 0;
    if (store.printHistory?.length > 20) {
      store.printHistory = store.printHistory.slice(0, 20);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
        if (dom.feedback) setFeedback("本地空间不足，已只保留最近 20 条打印记录后保存。", "bad");
        return;
      } catch (retryError) {
        const retryIsQuota =
          retryError?.name === "QuotaExceededError" ||
          retryError?.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
          retryError?.code === 22 ||
          retryError?.code === 1014;
        if (!retryIsQuota) throw retryError;
      }
    }
    if (!store.libraryArchives?.length && store.printHistory?.length) {
      store.printHistory = [];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
        if (dom.feedback) setFeedback("本地空间不足，已清空打印记录后保存。", "bad");
        return;
      } catch (retryError) {
        const retryIsQuota =
          retryError?.name === "QuotaExceededError" ||
          retryError?.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
          retryError?.code === 22 ||
          retryError?.code === 1014;
        if (!retryIsQuota) throw retryError;
      }
    }
    while (store.libraryArchives?.length) {
      store.libraryArchives = store.libraryArchives.slice(0, -1);
      removedCount += 1;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
        if (dom.feedback) setFeedback(`本地空间不足，已删除 ${removedCount} 个最旧整库备份后保存。`, "bad");
        return;
      } catch (retryError) {
        const retryIsQuota =
          retryError?.name === "QuotaExceededError" ||
          retryError?.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
          retryError?.code === 22 ||
          retryError?.code === 1014;
        if (!retryIsQuota) throw retryError;
      }
    }
    throw error;
  }
}

function supabaseSettings() {
  const config = window.GO_JOSEKI_SUPABASE_CONFIG || {};
  return {
    url: String(config.url || "").trim(),
    publishableKey: String(config.publishableKey || config.anonKey || "").trim(),
  };
}

function hasSupabaseSettings(settings) {
  return (
    settings.url.startsWith("https://") &&
    settings.url.includes(".supabase.co") &&
    settings.publishableKey.length > 20 &&
    !settings.publishableKey.includes("YOUR_")
  );
}

async function initCloudSync() {
  const settings = supabaseSettings();
  cloud.configured = hasSupabaseSettings(settings);
  if (!cloud.configured) {
    cloud.statusText = "未配置云同步";
    renderCloudSync();
    return;
  }
  if (!window.supabase?.createClient) {
    cloud.lastError = "Supabase SDK 未加载";
    cloud.statusText = cloud.lastError;
    renderCloudSync();
    return;
  }

  cloud.initializing = true;
  cloud.statusText = "正在连接云同步";
  renderCloudSync();

  try {
    cloud.client = window.supabase.createClient(settings.url, settings.publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });

    cloud.client.auth.onAuthStateChange((_event, session) => {
      handleAuthSession(session);
    });

    const { data, error } = await cloud.client.auth.getSession();
    if (error) throw error;
    await handleAuthSession(data.session);
  } catch (error) {
    console.error(error);
    cloud.lastError = readableError(error);
    cloud.statusText = "云同步连接失败";
  } finally {
    cloud.initializing = false;
    renderCloudSync();
  }
}

async function handleAuthSession(session) {
  const previousUserId = cloud.user?.id || "";
  cloud.session = session || null;
  cloud.user = session?.user || null;
  cloud.lastError = "";
  if (!cloud.user) {
    cloud.statusText = cloud.configured ? "未登录，使用本地保存" : "未配置云同步";
    renderCloudSync();
    return;
  }
  cloud.statusText = "已登录，正在读取云端";
  renderCloudSync();
  if (previousUserId !== cloud.user.id) {
    await pullCloudStoreOnLogin();
  } else {
    cloud.statusText = cloud.lastSyncedAt ? `已同步 ${formatSyncTime(cloud.lastSyncedAt)}` : "已登录";
    renderCloudSync();
  }
}

function scheduleCloudSave() {
  if (!cloud.client || !cloud.user || cloud.applyingRemote) return;
  window.clearTimeout(cloud.saveTimer);
  cloud.saveTimer = window.setTimeout(() => {
    uploadCloudStore();
  }, CLOUD_SAVE_DEBOUNCE_MS);
}

async function pullCloudStoreOnLogin() {
  if (!cloud.client || !cloud.user) return;
  cloud.syncing = true;
  cloud.statusText = "正在读取云端数据";
  renderCloudSync();
  try {
    const { data, error } = await cloud.client
      .from(SUPABASE_TABLE)
      .select("store, updated_at")
      .eq("user_id", cloud.user.id)
      .maybeSingle();
    if (error) throw error;

    if (data?.store) {
      cloud.applyingRemote = true;
      store = normalizeStoreData(data.store);
      ensureValidSelection();
      resetPracticeState();
      saveLocalStore();
      cloud.applyingRemote = false;
      render();
      markCloudSynced(data.updated_at || new Date().toISOString());
      setFeedback("已载入云端定式。", "good");
    } else {
      await uploadCloudStore({ statusPrefix: "首次上传", force: true });
      setFeedback("本地定式已上传到账号。", "good");
    }
  } catch (error) {
    cloud.applyingRemote = false;
    console.error(error);
    cloud.lastError = readableError(error);
    cloud.statusText = "云端读取失败";
    setFeedback(`云同步失败：${cloud.lastError}`, "bad");
  } finally {
    cloud.syncing = false;
    renderCloudSync();
  }
}

async function uploadCloudStore(options = {}) {
  if (!cloud.client || !cloud.user || (cloud.syncing && !options.force)) return;
  cloud.syncing = true;
  cloud.statusText = options.statusPrefix || "正在同步";
  renderCloudSync();
  try {
    const now = new Date().toISOString();
    const payload = normalizeStoreData(structuredClone(store));
    const { error } = await cloud.client.from(SUPABASE_TABLE).upsert(
      {
        user_id: cloud.user.id,
        store: payload,
        updated_at: now,
      },
      { onConflict: "user_id" },
    );
    if (error) throw error;
    markCloudSynced(now);
    cloud.lastError = "";
  } catch (error) {
    console.error(error);
    cloud.lastError = readableError(error);
    cloud.statusText = "云同步失败";
    setFeedback(`云同步失败：${cloud.lastError}`, "bad");
  } finally {
    cloud.syncing = false;
    renderCloudSync();
  }
}

function markCloudSynced(isoString) {
  cloud.lastSyncedAt = isoString;
  localStorage.setItem(LAST_SYNC_KEY, isoString);
  cloud.statusText = `已同步 ${formatSyncTime(isoString)}`;
}

function renderCloudSync() {
  if (!dom.authPanel) return;
  const isLoggedIn = Boolean(cloud.user);
  const canSubmitAuth = Boolean(cloud.client) && !cloud.syncing && !cloud.initializing;
  const canSync = isLoggedIn && !cloud.syncing && !cloud.initializing;

  dom.authAccountLabel.textContent = isLoggedIn ? cloud.user.email || "已登录账号" : "未登录";
  dom.syncStatus.textContent = cloud.lastError || cloud.statusText;
  dom.syncStatus.className = cloud.lastError ? "sync-status bad" : isLoggedIn ? "sync-status good" : "sync-status";
  dom.syncHelp.textContent = cloud.configured
    ? isLoggedIn
      ? "登录后会自动读取云端；编辑后会自动同步。"
      : "登录后会读取云端数据；云端没有数据时会上传当前本地定式。"
    : "请先在 supabase-config.js 填入项目 URL 和 publishable key。";

  dom.authEmail.disabled = !canSubmitAuth || isLoggedIn;
  dom.authPassword.disabled = !canSubmitAuth || isLoggedIn;
  dom.signInButton.disabled = !canSubmitAuth || isLoggedIn;
  dom.signUpButton.disabled = !canSubmitAuth || isLoggedIn;
  dom.signOutButton.disabled = !canSync;
  dom.syncNowButton.disabled = !canSync;
}

function authFormValues() {
  return {
    email: dom.authEmail.value.trim(),
    password: dom.authPassword.value,
  };
}

function requireAuthForm() {
  const values = authFormValues();
  if (!values.email || !values.password) {
    setFeedback("请先填写邮箱和密码。", "bad");
    return null;
  }
  if (values.password.length < 6) {
    setFeedback("密码至少需要 6 位。", "bad");
    return null;
  }
  return values;
}

async function signInWithEmail() {
  if (!cloud.client) return;
  const values = requireAuthForm();
  if (!values) return;
  cloud.syncing = true;
  cloud.statusText = "正在登录";
  renderCloudSync();
  try {
    const { error } = await cloud.client.auth.signInWithPassword(values);
    if (error) throw error;
    dom.authPassword.value = "";
    setFeedback("登录成功，正在同步。", "good");
  } catch (error) {
    console.error(error);
    cloud.lastError = readableError(error);
    setFeedback(`登录失败：${cloud.lastError}`, "bad");
  } finally {
    cloud.syncing = false;
    renderCloudSync();
  }
}

async function signUpWithEmail() {
  if (!cloud.client) return;
  const values = requireAuthForm();
  if (!values) return;
  cloud.syncing = true;
  cloud.statusText = "正在注册";
  renderCloudSync();
  try {
    const { data, error } = await cloud.client.auth.signUp(values);
    if (error) throw error;
    dom.authPassword.value = "";
    setFeedback(data.session ? "注册成功，正在同步。" : "注册成功，请先完成邮箱确认。", "good");
  } catch (error) {
    console.error(error);
    cloud.lastError = readableError(error);
    setFeedback(`注册失败：${cloud.lastError}`, "bad");
  } finally {
    cloud.syncing = false;
    renderCloudSync();
  }
}

async function signOutCloud() {
  if (!cloud.client) return;
  cloud.syncing = true;
  cloud.statusText = "正在退出";
  renderCloudSync();
  try {
    const { error } = await cloud.client.auth.signOut();
    if (error) throw error;
    cloud.session = null;
    cloud.user = null;
    cloud.statusText = "已退出，使用本地保存";
    setFeedback("已退出账号，本机数据仍保留。", "info");
  } catch (error) {
    console.error(error);
    cloud.lastError = readableError(error);
    setFeedback(`退出失败：${cloud.lastError}`, "bad");
  } finally {
    cloud.syncing = false;
    renderCloudSync();
  }
}

function formatSyncTime(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatArchiveTime(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "未知时间";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function readableError(error) {
  return error?.message || String(error || "未知错误");
}

function normalizeBoardTheme(theme) {
  return ["wood", "pale", "white"].includes(theme) ? theme : "wood";
}

function normalizeAdvantage(value) {
  if (value === "none") return "even";
  return ["black", "white", "even"].includes(value) ? value : "even";
}

function normalizeChoicePoints(points, boardSize = 19) {
  const size = clampBoardSize(boardSize || 19);
  const seen = new Set();
  return (Array.isArray(points) ? points : [])
    .map((item) => ({
      x: Number(item.x),
      y: Number(item.y),
      label: String(item.label || "").trim(),
    }))
    .filter((item) => Number.isInteger(item.x) && Number.isInteger(item.y) && item.x >= 0 && item.y >= 0 && item.x < size && item.y < size)
    .filter((item) => {
      const key = pointKey(item.x, item.y);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((item, index) => ({ ...item, label: item.label || choiceLabel(index) }));
}

function choiceLabel(index) {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return letters[index] || String(index + 1);
}

function normalizeRecordArchives(archives, boardSize = 19) {
  if (!Array.isArray(archives)) return [];
  return archives
    .map((archive) => {
      const snapshot = archive?.snapshot || archive?.record || {};
      const size = clampBoardSize(snapshot.boardSize || boardSize || 9);
      return {
        id: archive.id || createId("arc"),
        name: String(archive.name || "").trim() || `存档 ${formatArchiveTime(archive.createdAt || new Date().toISOString())}`,
        createdAt: archive.createdAt || new Date().toISOString(),
        snapshot: {
          variantName: String(snapshot.variantName || "基础变化"),
          advantage: normalizeAdvantage(snapshot.advantage),
          boardSize: size,
          initialMoves: sanitizeMoves(snapshot.initialMoves || []).filter((item) => item.x < size && item.y < size),
          choicePoints: normalizeChoicePoints(snapshot.choicePoints || [], size),
          answerMoves: sanitizeMoves(snapshot.answerMoves || []).filter((item) => item.x < size && item.y < size),
          notes: String(snapshot.notes || ""),
        },
      };
    })
    .filter((archive) => archive.snapshot)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 20);
}

function createRecordArchiveSnapshot(record) {
  return {
    variantName: record.variantName || "基础变化",
    advantage: normalizeAdvantage(record.advantage),
    boardSize: clampBoardSize(record.boardSize),
    initialMoves: structuredClone(record.initialMoves || []),
    choicePoints: structuredClone(record.choicePoints || []),
    answerMoves: structuredClone(record.answerMoves || []),
    notes: record.notes || "",
  };
}

function createLibraryArchiveSnapshot(data = store) {
  const raw = {
    version: 1,
    categories: structuredClone(data.categories || []),
    records: structuredClone(data.records || []),
    stats: structuredClone(data.stats || {}),
    settings: structuredClone(data.settings || { boardTheme: "wood" }),
    libraryArchives: [],
  };
  const normalized = normalizeStoreData(raw, { normalizeArchives: false });
  return {
    version: 1,
    categories: normalized.categories,
    records: normalized.records,
    stats: normalized.stats,
    settings: normalized.settings,
  };
}

function normalizeLibraryArchives(archives) {
  if (!Array.isArray(archives)) return [];
  return archives
    .map((archive) => {
      const createdAt = archive?.createdAt || new Date().toISOString();
      const snapshot = createLibraryArchiveSnapshot(archive?.snapshot || archive?.store || {});
      return {
        id: archive?.id || createId("lib"),
        name: String(archive?.name || "").trim() || `整库备份 ${formatArchiveTime(createdAt)}`,
        createdAt,
        snapshot,
      };
    })
    .filter((archive) => archive.snapshot.records.length || archive.snapshot.categories.length)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 20);
}

function normalizePrintHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .map((entry) => {
      const printedAt = entry?.printedAt || entry?.createdAt || new Date().toISOString();
      const recordCount = Number(entry?.recordCount || 0);
      return {
        id: entry?.id || createId("prt"),
        printedAt,
        scope: normalizePrintScope(entry?.scope),
        scopeLabel: String(entry?.scopeLabel || printScopeLabel(entry?.scope)).trim() || "当前变形",
        contentMode: normalizePrintContentMode(entry?.contentMode),
        contentLabel: printContentLabel(entry?.contentMode),
        layout: entry?.layout === "single" ? "single" : "grid",
        recordCount: Number.isFinite(recordCount) && recordCount >= 0 ? recordCount : 0,
        recordTitles: (Array.isArray(entry?.recordTitles) ? entry.recordTitles : [])
          .map((title) => String(title || "").trim())
          .filter(Boolean)
          .slice(0, 12),
      };
    })
    .filter((entry) => !Number.isNaN(new Date(entry.printedAt).getTime()))
    .sort((a, b) => new Date(b.printedAt) - new Date(a.printedAt))
    .slice(0, PRINT_HISTORY_LIMIT);
}

function advantageLabel(value) {
  const normalized = normalizeAdvantage(value);
  if (normalized === "black") return "黑优";
  if (normalized === "white") return "白优";
  return "平手";
}

function normalizeStoreData(data, options = {}) {
  const normalizeArchives = options.normalizeArchives !== false;
  const seenJosekiByTitle = new Map();
  const records = (data.records || []).map((record) => {
    if (!record.josekiId) {
      const key = `${record.categoryId || ""}::${record.title || ""}`;
      if (!seenJosekiByTitle.has(key)) seenJosekiByTitle.set(key, createId("jos"));
      record.josekiId = seenJosekiByTitle.get(key);
    }
    if (!record.variantName) record.variantName = "基础变化";
    record.advantage = normalizeAdvantage(record.advantage);
    if (!Array.isArray(record.tags)) record.tags = [];
    if (!Array.isArray(record.initialMoves)) record.initialMoves = [];
    if (!Array.isArray(record.answerMoves)) record.answerMoves = [];
    record.choicePoints = normalizeChoicePoints(record.choicePoints || [], record.boardSize);
    record.archives = normalizeRecordArchives(record.archives || [], record.boardSize);
    return record;
  });
  return {
    version: 1,
    categories: data.categories || [],
    records,
    stats: data.stats || {},
    settings: {
      boardTheme: normalizeBoardTheme(data.settings?.boardTheme),
    },
    libraryArchives: normalizeArchives ? normalizeLibraryArchives(data.libraryArchives || []) : data.libraryArchives || [],
    printHistory: normalizePrintHistory(data.printHistory || []),
  };
}

function createId(prefix) {
  const random = Math.random().toString(36).slice(2, 9);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}

function ensureValidSelection() {
  if (!store.categories.length) {
    const now = new Date().toISOString();
    store.categories.push({
      id: createId("cat"),
      name: "默认分类",
      color: "#0e9488",
      createdAt: now,
      updatedAt: now,
    });
  }
  if (!store.records.length) {
    const record = createBlankRecord();
    store.records.push(record);
  }
  store = normalizeStoreData(store, { normalizeArchives: false });
  store.records.forEach((record) => renumberRecord(record));
  const visibleRecords = filteredRecords();
  const selectedIsVisible = visibleRecords.some((record) => record.id === ui.selectedRecordId);
  ui.selectedRecordId = selectedIsVisible ? ui.selectedRecordId : visibleRecords[0]?.id || "";
}

function createBlankRecord() {
  const now = new Date().toISOString();
  return {
    id: createId("rec"),
    josekiId: createId("jos"),
    title: "新定式",
    variantName: "基础变化",
    advantage: "even",
    categoryId: store.categories[0].id,
    tags: ["入门"],
    boardSize: 9,
    initialMoves: [],
    choicePoints: [],
    answerMoves: [],
    archives: [],
    notes: "",
    createdAt: now,
    updatedAt: now,
  };
}

function selectedRecord() {
  return store.records.find((record) => record.id === ui.selectedRecordId) || null;
}

function selectedStats() {
  const record = selectedRecord();
  if (!record) return { attempts: 0, correctAttempts: 0, wrongAttempts: 0, lastPracticedAt: "" };
  if (!store.stats[record.id]) {
    store.stats[record.id] = {
      recordId: record.id,
      attempts: 0,
      correctAttempts: 0,
      wrongAttempts: 0,
      lastPracticedAt: "",
    };
  }
  return store.stats[record.id];
}

function updateJosekiGroup(record, updates) {
  if (!record) return;
  store.records
    .filter((item) => item.josekiId === record.josekiId)
    .forEach((item) => {
      Object.assign(item, updates, { updatedAt: new Date().toISOString() });
    });
  saveStore();
}

function filteredRecords() {
  return store.records.filter((record) => {
    const inCategory = ui.selectedCategoryId === "all" || record.categoryId === ui.selectedCategoryId;
    const inTags =
      ui.selectedTags.size === 0 || record.tags.some((tag) => ui.selectedTags.has(tag));
    return inCategory && inTags;
  });
}

function recordsInCurrentJoseki() {
  const record = selectedRecord();
  if (!record) return [];
  return store.records.filter((item) => item.josekiId === record.josekiId);
}

function recordsForJoseki(josekiId) {
  return store.records.filter((item) => item.josekiId === josekiId);
}

function selectFirstVisibleRecord() {
  ui.selectedRecordId = filteredRecords()[0]?.id || "";
}

function groupRecords(records) {
  const groups = [];
  const byId = new Map();
  records.forEach((record) => {
    if (!byId.has(record.josekiId)) {
      const group = {
        id: record.josekiId,
        title: record.title,
        categoryId: record.categoryId,
        tags: record.tags || [],
        records: [],
      };
      byId.set(record.josekiId, group);
      groups.push(group);
    }
    byId.get(record.josekiId).records.push(record);
  });
  return groups;
}

function groupToRecords(groupOrRecord) {
  if (!groupOrRecord) return [];
  if (Array.isArray(groupOrRecord.records)) return groupOrRecord.records;
  return recordsForJoseki(groupOrRecord.josekiId);
}

function renameJosekiGroup(groupOrRecord) {
  const records = groupToRecords(groupOrRecord);
  const first = records[0];
  if (!first) return;
  const nextTitle = window.prompt("定式名称", first.title || "未命名定式");
  if (nextTitle === null) return;
  const title = nextTitle.trim();
  if (!title) return;
  const now = new Date().toISOString();
  records.forEach((record) => {
    record.title = title;
    record.updatedAt = now;
  });
  saveStore();
  render();
}

function deleteJosekiGroup(groupOrRecord) {
  const records = groupToRecords(groupOrRecord);
  const first = records[0];
  if (!first) return;
  const title = first.title || "未命名定式";
  if (!confirmDanger(`删除“${title}”整个定式和 ${records.length} 个变形？这个操作不能撤销。`)) return;
  const ids = new Set(records.map((record) => record.id));
  store.records = store.records.filter((record) => !ids.has(record.id));
  ids.forEach((id) => {
    delete store.stats[id];
    ui.selectedPrintIds.delete(id);
  });
  selectFirstVisibleRecord();
  ensureValidSelection();
  saveStore();
  resetPracticeState();
  render();
}

function deleteVariantRecord(record) {
  if (!record) return;
  const variants = recordsForJoseki(record.josekiId);
  const isLastVariant = variants.length <= 1;
  const message = isLastVariant
    ? `“${record.title}”只有这一个变形，删除后这个定式也会消失。确定删除吗？`
    : `删除“${record.title}”中的“${record.variantName || "基础变化"}”变形？这个操作不能撤销。`;
  if (!confirmDanger(message)) return;
  const nextVariantId = variants.find((item) => item.id !== record.id)?.id || "";
  store.records = store.records.filter((item) => item.id !== record.id);
  delete store.stats[record.id];
  ui.selectedPrintIds.delete(record.id);
  ui.selectedRecordId = nextVariantId;
  ensureValidSelection();
  saveStore();
  resetPracticeState();
  render();
}

function archiveCurrentRecord() {
  const now = new Date().toISOString();
  const archives = normalizeLibraryArchives(store.libraryArchives || []);
  store.libraryArchives = normalizeLibraryArchives([
    {
      id: createId("lib"),
      name: `${formatArchiveTime(now)} · ${store.records.length}题`,
      createdAt: now,
      snapshot: createLibraryArchiveSnapshot(store),
    },
    ...archives,
  ]);
  saveStore();
  renderArchiveControls();
  renderCloudSync();
  setFeedback("已备份整个定式库。", "good");
}

function selectedArchive() {
  if (!dom.archiveSelect) return null;
  const archives = normalizeLibraryArchives(store.libraryArchives || []);
  const archiveId = dom.archiveSelect.value;
  return archives.find((archive) => archive.id === archiveId) || archives[0] || null;
}

function restoreSelectedArchive() {
  const archive = selectedArchive();
  if (!archive) return;
  if (!window.confirm(`恢复整库备份“${archive.name}”？当前全部定式、分类和练习统计会被覆盖。`)) return;
  const archives = normalizeLibraryArchives(store.libraryArchives || []);
  const snapshot = archive.snapshot;
  store = normalizeStoreData({
    version: 1,
    categories: structuredClone(snapshot.categories || []),
    records: structuredClone(snapshot.records || []),
    stats: structuredClone(snapshot.stats || {}),
    settings: structuredClone(snapshot.settings || { boardTheme: "wood" }),
    libraryArchives: archives,
  });
  ui.selectedCategoryId = "all";
  ui.selectedTags.clear();
  ui.selectedPrintIds.clear();
  ensureValidSelection();
  resetPracticeState();
  saveStore();
  render();
  setFeedback(`已恢复整库备份：${archive.name}`, "good");
}

function deleteSelectedArchive() {
  const archive = selectedArchive();
  if (!archive) return;
  if (!window.confirm(`删除整库备份“${archive.name}”？`)) return;
  store.libraryArchives = normalizeLibraryArchives(store.libraryArchives || []).filter((item) => item.id !== archive.id);
  saveStore();
  renderArchiveControls();
  setFeedback("已删除所选整库备份。", "info");
}

function archiveCurrentRecordLegacy() {
  const record = selectedRecord();
  if (!record) return;
  const now = new Date().toISOString();
  record.archives = normalizeRecordArchives(record.archives || [], record.boardSize);
  record.archives.unshift({
    id: createId("arc"),
    name: `${formatArchiveTime(now)} · ${record.answerMoves.length}手`,
    createdAt: now,
    snapshot: createRecordArchiveSnapshot(record),
  });
  record.archives = normalizeRecordArchives(record.archives, record.boardSize);
  record.updatedAt = now;
  saveStore();
  renderEditor();
  renderCloudSync();
  setFeedback("已存档当前棋谱。", "good");
}

function selectedRecordArchive(record) {
  if (!record || !dom.archiveSelect) return null;
  const archiveId = dom.archiveSelect.value;
  return (record.archives || []).find((archive) => archive.id === archiveId) || record.archives?.[0] || null;
}

function restoreSelectedRecordArchive() {
  const record = selectedRecord();
  const archive = selectedRecordArchive(record);
  if (!record || !archive) return;
  if (!window.confirm(`恢复“${archive.name}”？当前未存档的修改会被覆盖。`)) return;
  const snapshot = archive.snapshot;
  const archives = normalizeRecordArchives(record.archives || [], record.boardSize);
  record.variantName = snapshot.variantName || "基础变化";
  record.advantage = normalizeAdvantage(snapshot.advantage);
  record.boardSize = clampBoardSize(snapshot.boardSize);
  record.initialMoves = sanitizeMoves(snapshot.initialMoves || []).filter((item) => item.x < record.boardSize && item.y < record.boardSize);
  record.choicePoints = normalizeChoicePoints(snapshot.choicePoints || [], record.boardSize);
  record.answerMoves = sanitizeMoves(snapshot.answerMoves || []).filter((item) => item.x < record.boardSize && item.y < record.boardSize);
  record.notes = snapshot.notes || "";
  record.archives = archives;
  renumberRecord(record);
  resetPracticeState();
  ui.selectedMoveIndex = -1;
  touchRecord(record);
  render();
  setFeedback(`已恢复存档：${archive.name}`, "good");
}

function deleteSelectedRecordArchive() {
  const record = selectedRecord();
  const archive = selectedRecordArchive(record);
  if (!record || !archive) return;
  if (!window.confirm(`删除存档“${archive.name}”？`)) return;
  record.archives = (record.archives || []).filter((item) => item.id !== archive.id);
  touchRecord(record);
  renderEditor();
  setFeedback("已删除所选存档。", "info");
}

function moveVariantRecord(record, direction) {
  if (!record) return;
  const variants = recordsForJoseki(record.josekiId);
  const currentVariantIndex = variants.findIndex((item) => item.id === record.id);
  const nextVariantIndex = direction === "up" ? currentVariantIndex - 1 : currentVariantIndex + 1;
  if (currentVariantIndex < 0 || nextVariantIndex < 0 || nextVariantIndex >= variants.length) return;
  const currentStoreIndex = store.records.findIndex((item) => item.id === record.id);
  const nextStoreIndex = store.records.findIndex((item) => item.id === variants[nextVariantIndex].id);
  if (currentStoreIndex < 0 || nextStoreIndex < 0) return;
  [store.records[currentStoreIndex], store.records[nextStoreIndex]] = [
    store.records[nextStoreIndex],
    store.records[currentStoreIndex],
  ];
  saveStore();
  renderSideRecordList();
  renderCards();
  renderPrintSelection();
}

function deleteCategory(categoryId) {
  if (categoryId === "all") return;
  const category = store.categories.find((item) => item.id === categoryId);
  if (!category) return;
  const records = store.records.filter((record) => record.categoryId === categoryId);
  const message = records.length
    ? `删除分类“${category.name}”会同时删除其中 ${records.length} 个变形和练习统计。确定删除吗？`
    : `删除空分类“${category.name}”？`;
  if (!confirmDanger(message)) return;
  const ids = new Set(records.map((record) => record.id));
  store.categories = store.categories.filter((item) => item.id !== categoryId);
  store.records = store.records.filter((record) => !ids.has(record.id));
  ids.forEach((id) => {
    delete store.stats[id];
    ui.selectedPrintIds.delete(id);
  });
  if (ui.selectedCategoryId === categoryId) ui.selectedCategoryId = "all";
  selectFirstVisibleRecord();
  ensureValidSelection();
  saveStore();
  resetPracticeState();
  render();
}

function confirmDanger(message) {
  if (!window.confirm(message)) return false;
  return window.confirm("请再次确认删除。删除后不能撤销。");
}

function allTags() {
  return [...new Set(store.records.flatMap((record) => record.tags || []))].sort((a, b) =>
    a.localeCompare(b, "zh-CN"),
  );
}

function render() {
  ensureValidSelection();
  renderTopContext();
  renderCategories();
  renderTagFilters();
  renderEditor();
  renderBoard();
  renderControls();
  renderPracticeProgress();
  renderMoveList();
  renderSideRecordList();
  renderCards();
  renderPrintSelection();
  renderPrintHistory();
  renderLayoutState();
  renderCloudSync();
}

function renderTopContext() {
  const record = selectedRecord();
  if (!record) {
    dom.topContext.textContent = "请选择一个定式";
    return;
  }
  dom.topContext.textContent = `${record.title || "未命名定式"} · ${record.variantName || "基础变化"} · ${record.boardSize}路 · ${advantageLabel(record.advantage) || "未标记"}`;
}

function renderCategories() {
  const visibleCount = filteredRecords().length;
  dom.recordCount.textContent = `${visibleCount}题`;
  dom.categoryList.innerHTML = "";
  const allButton = createCategoryButton("all", "全部定式", store.records.length);
  dom.categoryList.appendChild(allButton);

  store.categories.forEach((category) => {
    const count = store.records.filter((record) => record.categoryId === category.id).length;
    dom.categoryList.appendChild(createCategoryRow(category, count));
  });
}

function createCategoryRow(category, count) {
  const row = document.createElement("div");
  row.className = "category-row";
  const button = createCategoryButton(category.id, category.name, count);
  button.title = "点击筛选，双击改名";
  button.addEventListener("dblclick", (event) => {
    event.preventDefault();
    startCategoryRename(row, category);
  });
  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "category-edit-button";
  editButton.textContent = "改";
  editButton.setAttribute("aria-label", `修改分类“${category.name}”名称`);
  editButton.title = `修改分类“${category.name}”名称`;
  editButton.addEventListener("click", (event) => {
    event.stopPropagation();
    startCategoryRename(row, category);
  });
  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "category-delete-button danger-button";
  deleteButton.textContent = "删";
  deleteButton.setAttribute("aria-label", `删除分类“${category.name}”`);
  deleteButton.title = `删除分类“${category.name}”`;
  deleteButton.addEventListener("click", (event) => {
    event.stopPropagation();
    deleteCategory(category.id);
  });
  row.append(button, editButton, deleteButton);
  return row;
}

function startCategoryRename(row, category) {
  let finished = false;
  row.classList.add("renaming");
  row.innerHTML = "";

  const form = document.createElement("form");
  form.className = "category-rename-form";
  const input = document.createElement("input");
  input.type = "text";
  input.maxLength = 18;
  input.value = category.name;
  input.setAttribute("aria-label", "分类新名称");

  const saveButton = document.createElement("button");
  saveButton.type = "submit";
  saveButton.className = "category-rename-save";
  saveButton.textContent = "保存";

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "category-rename-cancel";
  cancelButton.textContent = "取消";

  function finish(shouldSave) {
    if (finished) return;
    if (!shouldSave) {
      finished = true;
      renderCategories();
      return;
    }

    const nextName = input.value.trim();
    if (!nextName) {
      input.focus();
      return;
    }
    const duplicate = store.categories.some((item) => item.id !== category.id && item.name === nextName);
    if (duplicate) {
      window.alert("已有同名分类。");
      input.focus();
      input.select();
      return;
    }

    if (nextName !== category.name) {
      if (ui.hasUnsavedEdit) {
        flushPendingEdits();
        ui.hasUnsavedEdit = false;
      }
      category.name = nextName;
      category.updatedAt = new Date().toISOString();
      saveStore();
      renderEditor();
      renderSideRecordList();
      renderCards();
      renderPrintSelection();
      renderCloudSync();
    }
    finished = true;
    renderCategories();
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    finish(true);
  });
  cancelButton.addEventListener("click", () => finish(false));
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      finish(false);
    }
  });
  form.addEventListener("focusout", () => {
    window.setTimeout(() => {
      if (!form.contains(document.activeElement)) finish(true);
    }, 0);
  });

  form.append(input, saveButton, cancelButton);
  row.appendChild(form);
  input.focus();
  input.select();
}

function createCategoryButton(id, name, count) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `category-button${ui.selectedCategoryId === id ? " active" : ""}`;
  button.innerHTML = `<span>${escapeHtml(name)}</span><span class="category-count">${count}</span>`;
  button.addEventListener("click", () => {
    if (!confirmRecordSwitch()) return;
    ui.selectedCategoryId = id;
    const next = filteredRecords()[0];
    ui.selectedRecordId = next?.id || "";
    resetPracticeState();
    render();
  });
  return button;
}

function selectRecord(recordId, nextMode = null) {
  if (!recordId) return false;
  if (recordId === ui.selectedRecordId) {
    if (nextMode) {
      ui.mode = nextMode;
      ui.selectedMoveIndex = -1;
      resetPracticeState();
      render();
    }
    return true;
  }
  if (!confirmRecordSwitch()) return false;
  ui.selectedRecordId = recordId;
  if (nextMode) ui.mode = nextMode;
  ui.selectedMoveIndex = -1;
  resetPracticeState();
  render();
  return true;
}

function confirmRecordSwitch() {
  if (!ui.hasUnsavedEdit) return true;
  const keepGoing = window.confirm("备注里有未保存的编辑。切换定式前会先保存，继续吗？");
  if (!keepGoing) return false;
  flushPendingEdits();
  ui.hasUnsavedEdit = false;
  return true;
}

function flushPendingEdits() {
  const record = selectedRecord();
  if (!record) return;
  record.notes = dom.recordNotes.value.trim();
  touchRecord(record);
}

function selectNextRecordForPractice() {
  const records = filteredRecords();
  if (!records.length) return;
  const currentIndex = records.findIndex((record) => record.id === ui.selectedRecordId);
  const next = records[(currentIndex + 1 + records.length) % records.length];
  ui.selectedRecordId = next.id;
  ui.mode = "sequence";
  ui.selectedMoveIndex = -1;
  resetPracticeState();
  render();
}

function renderTagFilters() {
  dom.tagFilterList.innerHTML = "";
  const tags = allTags();
  if (!tags.length) {
    dom.tagFilterList.innerHTML = `<div class="empty-state">还没有标签</div>`;
    return;
  }
  tags.forEach((tag) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `tag-chip${ui.selectedTags.has(tag) ? " active" : ""}`;
    button.textContent = tag;
    button.addEventListener("click", () => {
      if (ui.selectedTags.has(tag)) ui.selectedTags.delete(tag);
      else ui.selectedTags.add(tag);
      const next = filteredRecords()[0];
      ui.selectedRecordId = next?.id || "";
      resetPracticeState();
      render();
    });
    dom.tagFilterList.appendChild(button);
  });
}

function renderSideRecordList() {
  if (!dom.sideRecordList) return;
  const records = filteredRecords();
  dom.sideRecordList.innerHTML = "";
  if (!records.length) {
    dom.sideRecordList.innerHTML = `<div class="empty-state small-empty">还没有定式</div>`;
    return;
  }
  records.forEach((record) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `side-record-item${record.id === ui.selectedRecordId ? " active" : ""}`;
    const mini = createMiniBoard(record);
    mini.classList.add("small-mini");
    const tags = [record.boardSize ? `${record.boardSize}路` : "", advantageLabel(record.advantage), ...(record.tags || [])]
      .filter(Boolean)
      .slice(0, 4)
      .join(" · ");
    const text = document.createElement("span");
    text.innerHTML = `<strong>${escapeHtml(record.variantName || "基础变化")}</strong><small>${escapeHtml(tags || record.title)}</small>`;
    button.append(mini, text);
    button.addEventListener("click", () => {
      selectRecord(record.id);
    });
    dom.sideRecordList.appendChild(button);
  });
}

function renderEditor() {
  const record = selectedRecord();
  setEditorFieldsDisabled(!record);
  if (!record) {
    dom.recordTitle.value = "";
    dom.recordTitle.placeholder = "这个分类还没有定式";
    dom.variantName.value = "";
    dom.variantName.placeholder = "先新建一个定式";
    dom.variantAdvantage.value = "even";
    dom.recordCategory.innerHTML = "";
    store.categories.forEach((category) => {
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = category.name;
      option.selected = category.id === ui.selectedCategoryId;
      dom.recordCategory.appendChild(option);
    });
    dom.recordTags.value = "";
    dom.customBoardSize.value = 19;
    dom.recordNotes.value = "";
    renderArchiveControls();
    document.querySelectorAll(".board-size-controls button").forEach((button) => {
      button.classList.remove("active");
    });
    return;
  }
  dom.recordTitle.value = record.title;
  dom.recordTitle.placeholder = "定式名称";
  dom.variantName.placeholder = "变形：基础变化";
  dom.variantName.value = record.variantName || "基础变化";
  dom.variantAdvantage.value = normalizeAdvantage(record.advantage);
  dom.recordCategory.innerHTML = "";
  store.categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = category.name;
    option.selected = category.id === record.categoryId;
    dom.recordCategory.appendChild(option);
  });
  dom.recordTags.value = (record.tags || []).join(", ");
  dom.customBoardSize.value = record.boardSize;
  dom.recordNotes.value = record.notes || "";

  document.querySelectorAll(".board-size-controls button").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.size) === record.boardSize);
  });
  renderArchiveControls();
}

function renderArchiveControls() {
  if (!dom.archiveSelect) return;
  const archives = Array.isArray(store.libraryArchives) ? store.libraryArchives : [];
  dom.archiveSelect.innerHTML = "";
  if (!archives.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "暂无整库备份";
    dom.archiveSelect.appendChild(option);
  } else {
    archives.forEach((archive) => {
      const option = document.createElement("option");
      option.value = archive.id;
      option.textContent = archive.name;
      dom.archiveSelect.appendChild(option);
    });
  }
  const hasArchive = Boolean(archives.length);
  dom.archiveRecordButton.disabled = !store.records.length;
  dom.archiveSelect.disabled = !hasArchive;
  dom.restoreArchiveButton.disabled = !hasArchive;
  dom.deleteArchiveButton.disabled = !hasArchive;
  dom.archiveStatus.textContent = hasArchive ? `${archives.length} 个整库备份，最多保留 20 个` : "暂无整库备份";
}

function setEditorFieldsDisabled(disabled) {
  [
    dom.recordTitle,
    dom.recordCategory,
    dom.variantName,
    dom.variantAdvantage,
    dom.recordTags,
    dom.customBoardSize,
    dom.recordNotes,
    dom.editRecordButton,
    dom.newVariantButton,
    dom.duplicateRecordButton,
    dom.deleteRecordButton,
    dom.deleteJosekiButton,
    dom.clearVariationButton,
  ].forEach((element) => {
    if (element) element.disabled = disabled;
  });
  document.querySelectorAll(".board-size-controls button").forEach((button) => {
    button.disabled = disabled;
  });
}

function renderControls() {
  const hasRecord = Boolean(selectedRecord());
  dom.startPracticeButton.disabled = !hasRecord;
  dom.editRecordButton.disabled = !hasRecord;
  dom.undoMoveButton.disabled =
    !hasRecord ||
    !(
      (ui.mode === "free" && ui.freeMoves.length > 0) ||
      (ui.mode === "choice" && ui.choiceSelection?.correct && ui.freeMoves.length > 0)
    );
  dom.showAnswerButton.disabled = !hasRecord;
  dom.resetPracticeButton.disabled = !hasRecord;
  if (dom.shufflePracticeButton) dom.shufflePracticeButton.disabled = !filteredRecords().length;
  dom.exportCurrentButton.disabled = !hasRecord;
  if (dom.printPanelButton) dom.printPanelButton.disabled = !hasRecord;
  dom.hintToggle.disabled = !hasRecord;
  dom.hintToggle.checked = ui.hintsEnabled;
  store.settings = store.settings || { boardTheme: "wood" };
  dom.boardTheme.value = normalizeBoardTheme(store.settings.boardTheme);
  document.querySelectorAll("#modeSelector button").forEach((button) => {
    const activePracticeMode = ["sequence", "free", "choice"].includes(ui.mode) ? ui.mode : "free";
    button.classList.toggle("active", button.dataset.mode === activePracticeMode);
  });
  document.querySelectorAll("#editToolSelector button").forEach((button) => {
    button.classList.toggle("active", button.dataset.tool === ui.editTool);
  });
  document.querySelectorAll("#correctionSelector button").forEach((button) => {
    button.classList.toggle("active", button.dataset.correction === ui.correctionMode);
  });
  dom.editTools.hidden = ui.mode !== "edit";
  dom.recordSequenceButton.classList.toggle("active", ui.isRecordingSequence);
  dom.recordSequenceButton.textContent = ui.isRecordingSequence ? "停止记录顺序" : "开始记录顺序";
  dom.recordingHint.textContent = ui.isRecordingSequence
    ? "记录中：后续落子从 1 编号。"
    : "未开始记录：落子只作题面。";
  dom.showAnswerButton.textContent = ui.showAnswer ? "隐藏答案" : "显示答案";
  dom.goBoard.style.setProperty("--board-zoom", String(ui.boardZoom));

  const stats = selectedStats();
  const accuracy = stats.attempts ? Math.round((stats.correctAttempts / stats.attempts) * 100) : 0;
  dom.attemptCount.textContent = `${stats.attempts} 次`;
  dom.accuracyRate.textContent = `${accuracy}%`;
  if (dom.streakCount) dom.streakCount.textContent = `${ui.currentStreak} 题`;
  if (dom.lastResult) {
    dom.lastResult.textContent = ui.practiceResult
      ? ui.practiceResult.isCorrect
        ? "全对"
        : "需复习"
      : stats.lastPracticedAt
        ? "已练习"
        : "未练习";
  }
}

function renderPracticeProgress() {
  if (!dom.practiceProgress) return;
  const record = selectedRecord();
  if (!record) {
    dom.practiceProgress.textContent = "还没有定式";
    return;
  }
  const total = record.answerMoves.length;
  if (ui.mode === "edit") {
    dom.practiceProgress.textContent = `编辑模式 · 答案 ${total} 手`;
    return;
  }
  if (ui.mode === "choice" && !ui.choiceSelection) {
    dom.practiceProgress.textContent = `先选最佳点 · 后续 ${Math.max(total - 1, 0)} 手`;
    return;
  }
  if (ui.mode === "choice" && ui.choiceSelection && !ui.choiceSelection.correct) {
    dom.practiceProgress.textContent = `最佳点已判错 · 共 ${total} 手`;
    return;
  }
  const done = ui.mode === "sequence" ? ui.sequenceAnswers.length : ui.freeMoves.length;
  const current = Math.min(done + 1, total || 1);
  dom.practiceProgress.textContent =
    done >= total && total > 0 ? `已完成 · 共 ${total} 手` : `当前：第 ${current} 手 / 共 ${total} 手`;
}

function renderMoveList() {
  if (!dom.moveList) return;
  const record = selectedRecord();
  dom.moveList.innerHTML = "";
  if (!record || !record.answerMoves.length) {
    dom.moveCountLabel.textContent = "0手";
    dom.moveList.innerHTML = `<div class="empty-state small-empty">点击“开始记录顺序”后，这里会显示答案手顺。</div>`;
    return;
  }
  dom.moveCountLabel.textContent = `${record.answerMoves.length}手`;
  record.answerMoves.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = `move-card${ui.selectedMoveIndex === index ? " active" : ""}`;
    const colorLabel = item.color === "black" ? "黑" : "白";
    const coord = moveCoordinate(item, record.boardSize);
    const selectButton = document.createElement("button");
    selectButton.type = "button";
    selectButton.className = "move-select";
    selectButton.innerHTML = `<b>${item.moveNo || index + 1}</b><span class="move-main"><i class="move-color-mini ${item.color}" aria-hidden="true"></i><span class="move-coord">${coord}</span></span>`;
    selectButton.setAttribute("aria-label", `第 ${item.moveNo || index + 1} 手，${colorLabel}棋 ${coord}`);
    selectButton.addEventListener("click", () => {
      ui.selectedMoveIndex = ui.selectedMoveIndex === index ? -1 : index;
      renderBoard();
      renderMoveList();
    });
    const colorButton = document.createElement("button");
    colorButton.type = "button";
    colorButton.className = "move-action color-switch";
    colorButton.textContent = item.color === "black" ? "白" : "黑";
    colorButton.title = item.color === "black" ? "改成白棋" : "改成黑棋";
    colorButton.setAttribute("aria-label", colorButton.title);
    colorButton.addEventListener("click", () => {
      item.color = item.color === "black" ? "white" : "black";
      touchRecord(record);
      render();
    });
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "move-action danger";
    deleteButton.textContent = "×";
    deleteButton.title = "删除这一步";
    deleteButton.setAttribute("aria-label", `删除第 ${item.moveNo || index + 1} 手`);
    deleteButton.addEventListener("click", () => {
      record.answerMoves.splice(index, 1);
      ui.selectedMoveIndex = -1;
      renumberRecord(record);
      touchRecord(record);
      render();
    });
    card.append(selectButton, colorButton, deleteButton);
    dom.moveList.appendChild(card);
  });
}

function renderLayoutState() {
  if (!dom.workspace) return;
  dom.workspace.classList.toggle("left-collapsed", ui.sidebarCollapsed);
  dom.workspace.classList.remove("right-collapsed");
  if (dom.leftPaneToggle) dom.leftPaneToggle.textContent = ui.sidebarCollapsed ? "展开左栏" : "左栏";
}

function moveCoordinate(item, size) {
  const letters = coordinateLetters(size);
  return `${letters[item.x] || item.x + 1}${size - item.y}`;
}

function renderCards() {
  const records = filteredRecords();
  dom.recordCards.innerHTML = "";
  if (!records.length) {
    dom.recordCards.innerHTML = `<div class="empty-state">这个分类下还没有定式。</div>`;
    return;
  }
  groupRecords(records).forEach((group) => {
    const container = document.createElement("div");
    container.className = "record-group";
    const heading = document.createElement("div");
    heading.className = "record-group-title";
    const titleText = document.createElement("span");
    titleText.className = "record-group-name";
    titleText.textContent = `${group.title} · ${group.records.length}个变形`;
    const actions = document.createElement("span");
    actions.className = "record-group-actions";
    const renameButton = document.createElement("button");
    renameButton.type = "button";
    renameButton.className = "record-group-action";
    renameButton.textContent = "改名";
    renameButton.addEventListener("click", (event) => {
      event.stopPropagation();
      renameJosekiGroup(group);
    });
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "record-group-action danger";
    deleteButton.textContent = "删除";
    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteJosekiGroup(group);
    });
    actions.append(renameButton, deleteButton);
    heading.append(titleText, actions);
    container.appendChild(heading);

    group.records.forEach((record) => {
      const variants = recordsForJoseki(record.josekiId);
      const variantIndex = variants.findIndex((item) => item.id === record.id);
      const card = document.createElement("article");
      card.className = `record-card${record.id === ui.selectedRecordId ? " active" : ""}`;
      const mini = createMiniBoard(record);
      mini.classList.add("large-mini");
      const text = document.createElement("div");
      text.className = "record-card-main";
      const advantage = advantageLabel(record.advantage);
      const tags = [record.boardSize ? `${record.boardSize}路` : "", advantage, ...(record.tags || [])].filter(Boolean);
      text.innerHTML = `<strong>${escapeHtml(record.variantName || "基础变化")}</strong><span>${escapeHtml(tags.join(" · "))}</span><em>${record.answerMoves.length}手</em>`;
      const actionsCell = document.createElement("div");
      actionsCell.className = "record-card-actions";
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "secondary-button";
      editButton.textContent = "编辑";
      editButton.addEventListener("click", () => {
        selectRecord(record.id, "edit");
      });
      const practiceButton = document.createElement("button");
      practiceButton.type = "button";
      practiceButton.className = "primary-button";
      practiceButton.textContent = "练习";
      practiceButton.addEventListener("click", () => {
        selectRecord(record.id, "free");
      });
      const menu = document.createElement("details");
      menu.className = "record-card-menu";
      const summary = document.createElement("summary");
      summary.textContent = "…";
      const moveUpButton = document.createElement("button");
      moveUpButton.type = "button";
      moveUpButton.className = "menu-item";
      moveUpButton.textContent = "上移";
      moveUpButton.title = `上移“${record.variantName || "基础变化"}”`;
      moveUpButton.disabled = variantIndex <= 0;
      moveUpButton.addEventListener("click", () => {
        moveVariantRecord(record, "up");
      });
      const moveDownButton = document.createElement("button");
      moveDownButton.type = "button";
      moveDownButton.className = "menu-item";
      moveDownButton.textContent = "下移";
      moveDownButton.title = `下移“${record.variantName || "基础变化"}”`;
      moveDownButton.disabled = variantIndex < 0 || variantIndex >= variants.length - 1;
      moveDownButton.addEventListener("click", () => {
        moveVariantRecord(record, "down");
      });
      const deleteVariantButton = document.createElement("button");
      deleteVariantButton.type = "button";
      deleteVariantButton.className = "menu-item danger-button";
      deleteVariantButton.textContent = "删除";
      deleteVariantButton.title = `删除“${record.variantName || "基础变化"}”变形`;
      deleteVariantButton.addEventListener("click", () => {
        deleteVariantRecord(record);
      });
      menu.append(summary, moveUpButton, moveDownButton, deleteVariantButton);
      actionsCell.append(editButton, practiceButton, menu);
      card.append(mini, text, actionsCell);
      card.addEventListener("click", (event) => {
        if (event.target.closest("button, summary, details")) return;
        selectRecord(record.id);
      });
      container.appendChild(card);
    });
    dom.recordCards.appendChild(container);
  });
}

function renderPrintSelection() {
  dom.printSelectionList.innerHTML = "";
  const groups = groupRecords(filteredRecords());
  if (!groups.length) {
    dom.printSelectionList.innerHTML = `<div class="empty-state">没有可打印的定式。</div>`;
    return;
  }

  groups.forEach((group) => {
    const wrapper = document.createElement("div");
    wrapper.className = "print-choice";
    const groupLabel = document.createElement("label");
    groupLabel.className = "print-choice-group";
    const groupCheckbox = document.createElement("input");
    groupCheckbox.type = "checkbox";
    const selectedCount = group.records.filter((record) => ui.selectedPrintIds.has(record.id)).length;
    groupCheckbox.checked = selectedCount === group.records.length;
    groupCheckbox.indeterminate = selectedCount > 0 && selectedCount < group.records.length;
    groupCheckbox.addEventListener("change", () => {
      group.records.forEach((record) => {
        if (groupCheckbox.checked) ui.selectedPrintIds.add(record.id);
        else ui.selectedPrintIds.delete(record.id);
      });
      dom.printScope.value = "selected";
      renderPrintSelection();
    });
    groupLabel.append(groupCheckbox, document.createTextNode(`${group.title}（${group.records.length}个变形）`));
    wrapper.appendChild(groupLabel);

    group.records.forEach((record) => {
      const label = document.createElement("label");
      label.className = "print-choice-variant";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = ui.selectedPrintIds.has(record.id);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) ui.selectedPrintIds.add(record.id);
        else ui.selectedPrintIds.delete(record.id);
        dom.printScope.value = "selected";
        renderPrintSelection();
      });
      label.append(
        checkbox,
        document.createTextNode(
          `${record.variantName || "基础变化"} · ${record.boardSize}路${advantageLabel(record.advantage) ? ` · ${advantageLabel(record.advantage)}` : ""}`,
        ),
      );
      wrapper.appendChild(label);
    });
    dom.printSelectionList.appendChild(wrapper);
  });
}

function renderPrintHistory() {
  if (!dom.printHistoryList || !dom.printHistorySummary) return;
  const history = normalizePrintHistory(store.printHistory || []);
  store.printHistory = history;
  dom.printHistoryList.innerHTML = "";
  if (!history.length) {
    dom.printHistorySummary.textContent = "暂无打印记录";
    dom.printHistoryList.innerHTML = `<div class="empty-state small-empty">打印或保存 PDF 后会显示在这里。</div>`;
    if (dom.clearPrintHistoryButton) dom.clearPrintHistoryButton.disabled = true;
    return;
  }
  dom.printHistorySummary.textContent = `最近 ${history.length} 次，最后 ${formatArchiveTime(history[0].printedAt)}`;
  if (dom.clearPrintHistoryButton) dom.clearPrintHistoryButton.disabled = false;
  history.slice(0, 20).forEach((entry) => {
    const item = document.createElement("article");
    item.className = "print-history-item";
    const titles = entry.recordTitles.length ? entry.recordTitles.join("、") : "未记录题目";
    item.innerHTML = `
      <div class="print-history-meta">
        <strong>${escapeHtml(formatArchiveTime(entry.printedAt))}</strong>
        <span>${escapeHtml(entry.scopeLabel)} · ${escapeHtml(entry.contentLabel)} · ${entry.recordCount}题</span>
      </div>
      <p>${escapeHtml(titles)}</p>
    `;
    dom.printHistoryList.appendChild(item);
  });
}

function createMiniBoard(record) {
  const board = document.createElement("div");
  board.className = "mini-board";
  const moves = [...record.initialMoves, ...record.answerMoves].slice(0, 6);
  moves.forEach((item) => {
    const stone = document.createElement("span");
    stone.className = `mini-stone ${item.color}`;
    stone.style.left = `${pointToPercent(item.x, record.boardSize)}%`;
    stone.style.top = `${pointToPercent(item.y, record.boardSize)}%`;
    board.appendChild(stone);
  });
  return board;
}

function renderBoard() {
  const record = selectedRecord();
  if (!record) {
    store.settings = store.settings || { boardTheme: "wood" };
    dom.goBoard.dataset.theme = normalizeBoardTheme(store.settings.boardTheme);
    delete dom.goBoard.dataset.answerDensity;
    dom.goBoard.classList.add("empty-board");
    dom.goBoard.innerHTML = "";
    setFeedback("这个分类还没有定式，点击“新建”添加。", "info");
    return;
  }
  const size = clampBoardSize(record.boardSize);
  store.settings = store.settings || { boardTheme: "wood" };
  dom.goBoard.dataset.theme = normalizeBoardTheme(store.settings.boardTheme);
  dom.goBoard.classList.remove("empty-board");
  dom.goBoard.style.setProperty("--lines", String(size));
  const cellPercent = 84 / (size - 1);
  dom.goBoard.style.setProperty("--cell", `${cellPercent}%`);
  dom.goBoard.style.setProperty("--point-size", `${cellPercent * 0.92}%`);
  dom.goBoard.style.setProperty("--stone-size", `${cellPercent * 0.78}%`);
  const answerCount = record.answerMoves.length;
  const answerDensity = answerCount >= 25 ? "dense" : answerCount >= 16 ? "compact" : "normal";
  const answerScale = answerDensity === "dense" ? 0.7 : answerDensity === "compact" ? 0.78 : 0.9;
  const answerMinSize = answerDensity === "dense" ? 16 : answerDensity === "compact" ? 18 : 20;
  dom.goBoard.dataset.answerDensity = answerDensity;
  dom.goBoard.style.setProperty("--answer-min-size", `${answerMinSize}px`);
  dom.goBoard.style.setProperty("--answer-size", `${cellPercent * answerScale}%`);
  dom.goBoard.style.setProperty("--answer-max-size", `${cellPercent * answerScale}%`);
  dom.goBoard.innerHTML = "";

  appendGridLines(dom.goBoard, size, "grid-line");
  appendCoordinateLabels(dom.goBoard, size, "coord-label");

  starPoints(size).forEach((point) => {
    const star = document.createElement("span");
    star.className = "star-point";
    placeElement(star, point.x, point.y, size);
    dom.goBoard.appendChild(star);
  });

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const point = document.createElement("button");
      point.type = "button";
      point.className = "point";
      point.setAttribute("aria-label", `第${y + 1}行第${x + 1}列`);
      placeElement(point, x, y, size);
      point.addEventListener("click", () => handlePointClick(x, y));
      dom.goBoard.appendChild(point);
    }
  }

  const appendStone = (item, markWrong = false) => {
    const stone = document.createElement("span");
    stone.className = `stone ${item.color}${markWrong ? " wrong-free" : ""}`;
    stone.textContent = item.source === "free" ? item.moveNo || "" : "";
    placeElement(stone, item.x, item.y, size);
    dom.goBoard.appendChild(stone);
  };

  const appendAnswerMarker = (item, index, answer = null, forceNumber = false) => {
    const marker = document.createElement("span");
    const isSolved = answer && answer.x === item.x && answer.y === item.y;
    const isWrong = answer && !isSolved;
    marker.className = `answer-marker${isSolved || ui.showAnswer ? " solved" : ""}${isWrong ? " wrong" : ""}${ui.selectedMoveIndex === index ? " selected" : ""}`;
    marker.textContent = forceNumber || ui.mode === "edit" || ui.showAnswer ? item.moveNo : isSolved ? item.moveNo : "";
    placeElement(marker, item.x, item.y, size);
    dom.goBoard.appendChild(marker);
  };

  const appendChoiceMarkers = () => {
    const firstAnswer = record.answerMoves[0];
    (record.choicePoints || []).forEach((item) => {
      const marker = document.createElement("span");
      const isSelected = ui.choiceSelection && samePoint(ui.choiceSelection, item.x, item.y);
      const isCorrect = firstAnswer && samePoint(firstAnswer, item.x, item.y);
      const revealCorrect = ui.showAnswer || Boolean(ui.choiceSelection);
      marker.className = `choice-marker${isSelected ? " selected" : ""}${isSelected && !ui.choiceSelection?.correct ? " wrong" : ""}${revealCorrect && isCorrect ? " correct" : ""}`;
      marker.textContent = item.label || "?";
      marker.setAttribute("aria-label", `候选点 ${item.label || ""}`);
      placeElement(marker, item.x, item.y, size);
      dom.goBoard.appendChild(marker);
    });
  };

  if (ui.mode === "choice") {
    const choiceIsCorrect = ui.choiceSelection?.correct;
    const choicePosition = choiceIsCorrect ? currentFreePosition(record) : buildGoPosition(size, record.initialMoves, []);
    Array.from(choicePosition.values()).forEach((item) => {
      const markWrong = item.source === "free" && ui.correctionMode === "final" && ui.reviewHints.length && item.correct === false;
      appendStone(item, markWrong);
    });

    if (!choiceIsCorrect) appendChoiceMarkers();

    if (choiceIsCorrect && ui.showAnswer) {
      const answerPosition = recordPosition(record);
      record.answerMoves.forEach((item, index) => {
        const live = answerPosition.get(pointKey(item.x, item.y));
        if (live?.source === "answer" && live.sourceIndex === index) appendAnswerMarker(item, index, null, true);
      });
    }

    const nextHint = choiceIsCorrect && ui.correctionMode === "instant" ? nextFreeExpected(record) : null;
    if (nextHint && !ui.showAnswer) {
      const hint = document.createElement("span");
      hint.className = "position-hint next-hint";
      hint.textContent = nextHint.moveNo || "";
      hint.setAttribute("aria-label", `下一手第 ${nextHint.moveNo || ""} 手`);
      placeElement(hint, nextHint.x, nextHint.y, size);
      dom.goBoard.appendChild(hint);
    }
    if (choiceIsCorrect && ui.correctionMode === "final" && ui.reviewHints.length && !ui.showAnswer) {
      ui.reviewHints.forEach((item) => {
        const hint = document.createElement("span");
        hint.className = "position-hint review-hint";
        hint.textContent = item.moveNo || "";
        hint.setAttribute("aria-label", `第 ${item.moveNo || ""} 手正确位置`);
        placeElement(hint, item.x, item.y, size);
        dom.goBoard.appendChild(hint);
      });
    }
    return;
  }

  const visibleAnswerMoves = ui.mode === "edit" || ui.mode === "sequence" || ui.showAnswer;
  if (ui.mode === "free") {
    const freePosition = currentFreePosition(record);
    Array.from(freePosition.values()).forEach((item) => {
      const markWrong = item.source === "free" && ui.correctionMode === "final" && ui.reviewHints.length && item.correct === false;
      appendStone(item, markWrong);
    });

    if (ui.showAnswer) {
      const answerPosition = recordPosition(record);
      record.answerMoves.forEach((item, index) => {
        const live = answerPosition.get(pointKey(item.x, item.y));
        if (live?.source === "answer" && live.sourceIndex === index) appendAnswerMarker(item, index, null, true);
      });
    }

    const nextHint = ui.correctionMode === "instant" ? nextFreeExpected(record) : null;
    if (nextHint && !ui.showAnswer) {
      const hint = document.createElement("span");
      hint.className = "position-hint next-hint";
      hint.textContent = nextHint.moveNo || "";
      hint.setAttribute("aria-label", `下一手第 ${nextHint.moveNo || ""} 手`);
      placeElement(hint, nextHint.x, nextHint.y, size);
      dom.goBoard.appendChild(hint);
    }
    if (ui.correctionMode === "final" && ui.reviewHints.length && !ui.showAnswer) {
      ui.reviewHints.forEach((item) => {
        const hint = document.createElement("span");
        hint.className = "position-hint review-hint";
        hint.textContent = item.moveNo || "";
        hint.setAttribute("aria-label", `第 ${item.moveNo || ""} 手正确位置`);
        placeElement(hint, item.x, item.y, size);
        dom.goBoard.appendChild(hint);
      });
    }
    return;
  }

  const sequenceMode = ui.mode === "sequence" && !ui.showAnswer;
  const playedAnswerMoves = sequenceMode
    ? record.answerMoves
        .slice(0, ui.sequenceAnswers.length)
        .map((item, index) => ({ ...item, source: "answer", sourceIndex: index }))
        .filter((_, index) => ui.sequenceAnswers[index]?.correct)
    : record.answerMoves.map((item, index) => ({ ...item, source: "answer", sourceIndex: index }));
  const answerPosition = recordPosition(record, visibleAnswerMoves ? playedAnswerMoves : []);

  Array.from(answerPosition.values()).forEach((item) => {
    if (item.source === "initial") appendStone(item);
  });

  if (visibleAnswerMoves) {
    record.answerMoves.forEach((item, index) => {
      const answer = ui.sequenceAnswers[index];
      const isSolved = answer && answer.x === item.x && answer.y === item.y;
      const isWrong = answer && !isSolved;
      const live = answerPosition.get(pointKey(item.x, item.y));
      const isLiveAnswer = live?.source === "answer" && live.sourceIndex === index;

      if ((ui.mode === "edit" || ui.showAnswer || isSolved) && !isLiveAnswer) return;
      if (!isSolved && !isWrong && answerPosition.has(pointKey(item.x, item.y)) && ui.mode !== "edit" && !ui.showAnswer) return;

      appendAnswerMarker(item, index, answer);

      if (!ui.showAnswer && !isSolved && ui.mode !== "edit") {
        const label = document.createElement("span");
        label.className = "practice-label";
        label.textContent = "";
        placeElement(label, Math.min(item.x + 0.45, size - 1), Math.max(item.y - 0.45, 0), size);
        dom.goBoard.appendChild(label);
      }
    });
  }

  if (ui.mode === "edit" || ui.showAnswer) appendChoiceMarkers();
}

function placeElement(element, x, y, size) {
  element.style.left = `${pointToPercent(x, size)}%`;
  element.style.top = `${pointToPercent(y, size)}%`;
}

function appendGridLines(board, size, className) {
  for (let index = 0; index < size; index += 1) {
    const percent = pointToPercent(index, size);
    const vertical = document.createElement("span");
    vertical.className = `${className} vertical`;
    vertical.style.left = `${percent}%`;
    board.appendChild(vertical);

    const horizontal = document.createElement("span");
    horizontal.className = `${className} horizontal`;
    horizontal.style.top = `${percent}%`;
    board.appendChild(horizontal);
  }
}

function appendCoordinateLabels(board, size, className) {
  const letters = coordinateLetters(size);
  for (let index = 0; index < size; index += 1) {
    const percent = pointToPercent(index, size);
    const number = String(size - index);
    const letter = letters[index];

    const top = document.createElement("span");
    top.className = `${className} top`;
    top.textContent = letter;
    top.style.left = `${percent}%`;
    board.appendChild(top);

    const bottom = document.createElement("span");
    bottom.className = `${className} bottom`;
    bottom.textContent = letter;
    bottom.style.left = `${percent}%`;
    board.appendChild(bottom);

    const left = document.createElement("span");
    left.className = `${className} left`;
    left.textContent = number;
    left.style.top = `${percent}%`;
    board.appendChild(left);

    const right = document.createElement("span");
    right.className = `${className} right`;
    right.textContent = number;
    right.style.top = `${percent}%`;
    board.appendChild(right);
  }
}

function coordinateLetters(size) {
  const letters = "ABCDEFGHJKLMNOPQRST".split("");
  return letters.slice(0, size);
}

function pointToPercent(index, size) {
  if (size <= 1) return 50;
  return 8 + (index / (size - 1)) * 84;
}

function handlePointClick(x, y) {
  const record = selectedRecord();
  if (!record) return;
  if (ui.mode === "edit") {
    editPoint(record, x, y);
  } else if (ui.mode === "sequence") {
    answerSequencePoint(record, x, y);
  } else if (ui.mode === "free") {
    addFreeMove(record, x, y);
  } else if (ui.mode === "choice") {
    answerChoicePoint(record, x, y);
  }
  saveStore();
  render();
}

function editPoint(record, x, y) {
  const existingInitial = record.initialMoves.findIndex((item) => samePoint(item, x, y));
  const existingChoice = record.choicePoints.findIndex((item) => samePoint(item, x, y));
  let existingAnswer = -1;
  for (let index = record.answerMoves.length - 1; index >= 0; index -= 1) {
    if (samePoint(record.answerMoves[index], x, y)) {
      existingAnswer = index;
      break;
    }
  }

  if (ui.editTool === "erase") {
    if (existingInitial >= 0) record.initialMoves.splice(existingInitial, 1);
    if (existingAnswer >= 0) record.answerMoves.splice(existingAnswer, 1);
    if (existingChoice >= 0) record.choicePoints.splice(existingChoice, 1);
    renumberRecord(record);
    setFeedback("已删除这个点。", "info");
    touchRecord(record);
    return;
  }

  if (ui.editTool === "choice") {
    if (existingChoice >= 0) {
      record.choicePoints.splice(existingChoice, 1);
      renumberRecord(record);
      setFeedback("已删除这个候选点。", "info");
      touchRecord(record);
      return;
    }
    const questionPosition = buildGoPosition(clampBoardSize(record.boardSize), record.initialMoves, []);
    if (questionPosition.has(pointKey(x, y))) {
      setFeedback("候选点要放在题面空点上。", "bad");
      return;
    }
    if (record.choicePoints.length >= 8) {
      setFeedback("候选点最多放 8 个，避免小朋友看花。", "bad");
      return;
    }
    const label = choiceLabel(record.choicePoints.length);
    record.choicePoints.push(choicePoint(x, y, label));
    renumberRecord(record);
    setFeedback(`已加入候选点 ${label}。答案第 1 手所在候选点就是最佳点。`, "good");
    touchRecord(record);
    return;
  }

  const isAnswerMove = ui.editTool === "answer" || ui.isRecordingSequence;
  const currentPosition = recordPosition(record);
  const pointOccupiedNow = currentPosition.has(pointKey(x, y));

  if ((isAnswerMove && pointOccupiedNow) || (!isAnswerMove && (existingInitial >= 0 || existingAnswer >= 0))) {
    setFeedback("这个交叉点已经有棋子或答案点了。", "bad");
    return;
  }

  if (isAnswerMove) {
    const moveNo = record.answerMoves.length + 1;
    const color = selectedEditColor(record, "answer");
    if (!isLegalGoMove(currentPosition, move(x, y, color, moveNo), clampBoardSize(record.boardSize))) {
      setFeedback("这手下完没有气，不能作为合法手。", "bad");
      return;
    }
    record.answerMoves.push(move(x, y, color, moveNo));
    ui.selectedMoveIndex = record.answerMoves.length - 1;
    renumberRecord(record);
    setFeedback(`已记录第 ${moveNo} 手。`, "good");
  } else {
    const moveNo = record.initialMoves.length + 1;
    const color = selectedEditColor(record, "initial");
    record.initialMoves.push(move(x, y, color, moveNo));
    renumberRecord(record);
    setFeedback(`已加入题面${color === "black" ? "黑棋" : "白棋"}，不记录顺序。`, "good");
  }
  touchRecord(record);
}

function answerChoicePoint(record, x, y) {
  const firstAnswer = record.answerMoves[0];
  if (!firstAnswer) {
    setFeedback("这个变形还没有答案步骤，不能练最佳点。", "bad");
    return;
  }

  if (!ui.choiceSelection) {
    const candidate = (record.choicePoints || []).find((item) => samePoint(item, x, y));
    if (!candidate) {
      setFeedback("请点击 A/B/C/D 候选点。", "bad");
      return;
    }
    const correct = samePoint(firstAnswer, x, y);
    ui.choiceSelection = { ...candidate, correct };
    if (!correct) {
      setFeedback(`选错了，${candidate.label || "这个点"}不是最佳点。`, "bad");
      finishPractice(false);
      return;
    }

    const currentPosition = buildGoPosition(clampBoardSize(record.boardSize), record.initialMoves, []);
    const firstMove = move(firstAnswer.x, firstAnswer.y, firstAnswer.color, firstAnswer.moveNo || 1);
    if (!isLegalGoMove(currentPosition, firstMove, clampBoardSize(record.boardSize))) {
      setFeedback("最佳点位置正确，但这手在当前题面下不是合法手。", "bad");
      finishPractice(false);
      return;
    }
    ui.freeMoves.push({ ...firstMove, correct: true });
    if (ui.freeMoves.length === record.answerMoves.length) {
      finishPractice(true);
      return;
    }
    const next = record.answerMoves[ui.freeMoves.length];
    setFeedback(`位置正确。请继续走第 ${next?.moveNo || ui.freeMoves.length + 1} 手。`, "good");
    return;
  }

  if (!ui.choiceSelection.correct) return;
  addFreeMove(record, x, y);
}

function answerSequencePoint(record, x, y) {
  const answerIndex = ui.sequenceAnswers.length;
  const expected = record.answerMoves[answerIndex];
  if (!expected) {
    finishPractice(true);
    return;
  }

  const currentPosition = currentSequencePosition(record);
  if (currentPosition.has(pointKey(x, y))) {
    setFeedback("这里现在已经有棋子。", "bad");
    return;
  }

  const clickedCandidate = record.answerMoves.find((item) => samePoint(item, x, y));
  if (!clickedCandidate) {
    setFeedback("请点击空心圆标记的位置。", "bad");
    return;
  }

  const correct = samePoint(expected, x, y);

  if (ui.correctionMode === "instant") {
    setFeedback(correct ? "这一步正确。" : `顺序不对，应该先填第 ${answerIndex + 1} 个。`, correct ? "good" : "bad");
    if (!correct) return;
    ui.sequenceAnswers.push({ x, y, correct });
  } else {
    ui.sequenceAnswers.push({ x, y, correct });
    setFeedback(`已填写第 ${answerIndex + 1} 手。`, "info");
  }

  if (ui.sequenceAnswers.length === record.answerMoves.length) {
    const allCorrect = ui.sequenceAnswers.every((item) => item.correct);
    finishPractice(allCorrect);
  }
}

function addFreeMove(record, x, y) {
  const moveNo = ui.freeMoves.length + 1;
  const expected = record.answerMoves[ui.freeMoves.length];
  if (!expected) {
    finishPractice(ui.freeMoves.every((item) => item.correct));
    return;
  }
  const currentPosition = currentFreePosition(record);
  const occupied = currentPosition.has(pointKey(x, y));
  const correct = samePoint(expected, x, y);

  if (ui.correctionMode === "instant") {
    ui.reviewHints = [];
    if (occupied || !correct) {
      setFeedback(`请按提示点击第 ${expected.moveNo || moveNo} 手的位置。`, "bad");
      return;
    }
    if (!isLegalGoMove(currentPosition, move(x, y, expected.color, moveNo), clampBoardSize(record.boardSize))) {
      setFeedback("这手下完没有气，不能下在这里。", "bad");
      return;
    }
    ui.freeMoves.push({ ...move(x, y, expected.color, moveNo), correct: true });
    if (ui.freeMoves.length === record.answerMoves.length) {
      finishPractice(true);
    } else {
      const next = record.answerMoves[ui.freeMoves.length];
      setFeedback(`正确。下一手是第 ${next.moveNo || ui.freeMoves.length + 1} 手。`, "good");
    }
    return;
  }

  if (occupied) {
    setFeedback("这个位置已经有棋子了。", "bad");
    return;
  }
  const color = expected?.color || nextFreeColor(record);
  const placed = move(x, y, color, moveNo);
  if (!isLegalGoMove(currentPosition, placed, clampBoardSize(record.boardSize))) {
    setFeedback("这手下完没有气，不能下在这里。", "bad");
    return;
  }
  ui.freeMoves.push({ ...placed, correct });
  ui.reviewHints = [];
  setFeedback(`已落第 ${moveNo} 手，共 ${record.answerMoves.length} 手。`, "info");

  if (ui.freeMoves.length === record.answerMoves.length) {
    const allCorrect = ui.freeMoves.every((item) => item.correct);
    ui.reviewHints = freePracticeReviewHints(record);
    finishPractice(allCorrect);
    if (!allCorrect) {
      setFeedback(`完成，有 ${ui.reviewHints.length} 处需要改正。红圈是正确位置，红框是你的落点。`, "bad");
    }
  }
}

function finishPractice(isCorrect) {
  const stats = selectedStats();
  stats.attempts += 1;
  if (isCorrect) stats.correctAttempts += 1;
  else stats.wrongAttempts += 1;
  ui.currentStreak = isCorrect ? ui.currentStreak + 1 : 0;
  stats.lastPracticedAt = new Date().toISOString();
  const record = selectedRecord();
  ui.practiceResult = record ? { recordId: record.id, isCorrect } : null;
  saveStore();
  setFeedback(isCorrect ? "完成，本题全对。" : "完成，有步骤需要复习。", isCorrect ? "good" : "bad");
  showPracticeSummary(isCorrect);
}

function showPracticeSummary(isCorrect) {
  if (!dom.practiceSummary || !dom.summaryBody) return;
  const record = selectedRecord();
  if (!record) return;
  const total = Math.max(record.answerMoves.length, 1);
  const wrongMoves =
    ui.mode === "sequence"
      ? ui.sequenceAnswers.filter((item) => !item.correct).length
      : ui.mode === "choice"
        ? (ui.choiceSelection && !ui.choiceSelection.correct ? 1 : 0) +
          ui.freeMoves.filter((item) => item.correct === false).length
        : ui.freeMoves.filter((item) => item.correct === false).length;
  const correctRate = Math.max(0, Math.round(((total - wrongMoves) / total) * 100));
  dom.summaryBody.innerHTML = `
    <div><span>本次正确率</span><strong>${isCorrect ? 100 : correctRate}%</strong></div>
    <div><span>错误手数</span><strong>${wrongMoves} 手</strong></div>
    <div><span>练习定式</span><strong>${escapeHtml(record.variantName || record.title)}</strong></div>
  `;
  dom.practiceSummary.hidden = false;
}

function freePracticeReviewHints(record) {
  return ui.freeMoves
    .map((item, index) => {
      if (item.correct) return null;
      const expected = record.answerMoves[index];
      if (!expected) return null;
      return { x: expected.x, y: expected.y, moveNo: expected.moveNo || index + 1 };
    })
    .filter(Boolean);
}

function undoFreeMove() {
  const record = selectedRecord();
  if (!record || ui.mode !== "free" || !ui.freeMoves.length) return;
  rollbackFinishedPractice(record);
  const removed = ui.freeMoves.pop();
  ui.practiceHint = null;
  ui.reviewHints = [];
  setFeedback(`已退回第 ${removed.moveNo || ui.freeMoves.length + 1} 手。`, "info");
  saveStore();
  render();
}

function undoChoiceMove() {
  const record = selectedRecord();
  if (!record || ui.mode !== "choice" || !ui.choiceSelection?.correct || !ui.freeMoves.length) return;
  rollbackFinishedPractice(record);
  const removed = ui.freeMoves.pop();
  ui.practiceHint = null;
  ui.reviewHints = [];
  if (!ui.freeMoves.length) {
    ui.choiceSelection = null;
    setFeedback("已退回到选择最佳点。", "info");
  } else {
    setFeedback(`已退回第 ${removed.moveNo || ui.freeMoves.length + 1} 手。`, "info");
  }
  saveStore();
  render();
}

function rollbackFinishedPractice(record) {
  if (
    !ui.practiceResult ||
    ui.practiceResult.recordId !== record.id ||
    ui.freeMoves.length !== record.answerMoves.length
  ) {
    return;
  }
  const stats = selectedStats();
  stats.attempts = Math.max(0, stats.attempts - 1);
  if (ui.practiceResult.isCorrect) stats.correctAttempts = Math.max(0, stats.correctAttempts - 1);
  else stats.wrongAttempts = Math.max(0, stats.wrongAttempts - 1);
  if (!stats.attempts) stats.lastPracticedAt = "";
  ui.practiceResult = null;
}

function renumberRecord(record) {
  const occupied = new Set();
  record.initialMoves = record.initialMoves.filter((item) => {
    const key = pointKey(item.x, item.y);
    if (occupied.has(key)) return false;
    occupied.add(key);
    return true;
  });
  record.initialMoves.forEach((item, index) => {
    item.moveNo = index + 1;
  });
  record.answerMoves.forEach((item, index) => {
    item.moveNo = index + 1;
  });
  record.choicePoints = normalizeChoicePoints(record.choicePoints || [], record.boardSize);
}

function selectedEditColor(record, target) {
  if (ui.editTool === "black" || ui.editTool === "white") return ui.editTool;
  return target === "answer" ? nextRecordedColor(record) : nextInitialColor(record);
}

function nextRecordedColor(record) {
  const previous = record.answerMoves.at(-1) || record.initialMoves.at(-1);
  if (!previous) return "black";
  return previous.color === "black" ? "white" : "black";
}

function nextFreeColor(record) {
  const previous = ui.freeMoves.at(-1) || record.answerMoves.at(-1) || record.initialMoves.at(-1);
  if (!previous) return "black";
  return previous.color === "black" ? "white" : "black";
}

function nextFreeExpected(record) {
  return record.answerMoves[ui.freeMoves.length] || null;
}

function nextInitialColor(record) {
  const previous = [...record.initialMoves].sort((a, b) => a.moveNo - b.moveNo).at(-1);
  if (!previous) return "black";
  return previous.color === "black" ? "white" : "black";
}

function samePoint(item, x, y) {
  return item.x === x && item.y === y;
}

function pointKey(x, y) {
  return `${x},${y}`;
}

function boardNeighbors(x, y, size) {
  return [
    [x - 1, y],
    [x + 1, y],
    [x, y - 1],
    [x, y + 1],
  ].filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < size && ny < size);
}

function cloneBoard(board) {
  return new Map(Array.from(board.entries()).map(([key, value]) => [key, { ...value }]));
}

function buildGoPosition(size, initialMoves = [], playedMoves = []) {
  const board = new Map();
  initialMoves.forEach((item, index) => {
    const x = Number(item.x);
    const y = Number(item.y);
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const key = pointKey(x, y);
    if (!board.has(key)) {
      board.set(key, { ...item, x, y, source: "initial", sourceIndex: index });
    }
  });
  playedMoves.forEach((item, index) => {
    applyGoMove(board, {
      ...item,
      source: item.source || "answer",
      sourceIndex: Number.isInteger(item.sourceIndex) ? item.sourceIndex : index,
    }, size);
  });
  return board;
}

function recordPosition(record, answerMoves = record.answerMoves) {
  const size = clampBoardSize(record.boardSize);
  const playedMoves = answerMoves.map((item, index) => ({
    ...item,
    source: "answer",
    sourceIndex: Number.isInteger(item.sourceIndex) ? item.sourceIndex : index,
  }));
  return buildGoPosition(size, record.initialMoves, playedMoves);
}

function currentSequencePosition(record) {
  const moves = [];
  const limit = Math.min(ui.sequenceAnswers.length, record.answerMoves.length);
  for (let index = 0; index < limit; index += 1) {
    if (ui.sequenceAnswers[index]?.correct) {
      moves.push({ ...record.answerMoves[index], source: "answer", sourceIndex: index });
    }
  }
  return recordPosition(record, moves);
}

function currentFreePosition(record) {
  const moves = ui.freeMoves.map((item, index) => ({
    ...item,
    source: "free",
    sourceIndex: index,
  }));
  return buildGoPosition(clampBoardSize(record.boardSize), record.initialMoves, moves);
}

function applyGoMove(board, item, size) {
  const key = pointKey(item.x, item.y);
  if (board.has(key)) return { captured: [], illegal: "occupied" };

  board.set(key, { ...item });
  const captured = [];
  const checked = new Set();
  boardNeighbors(item.x, item.y, size).forEach(([nx, ny]) => {
    const neighborKey = pointKey(nx, ny);
    const neighbor = board.get(neighborKey);
    if (!neighbor || neighbor.color === item.color || checked.has(neighborKey)) return;
    const group = collectGroup(board, nx, ny, size);
    group.stones.forEach((stoneKey) => checked.add(stoneKey));
    if (group.liberties.size === 0) {
      group.stones.forEach((stoneKey) => {
        captured.push(board.get(stoneKey));
        board.delete(stoneKey);
      });
    }
  });

  const ownGroup = collectGroup(board, item.x, item.y, size);
  if (ownGroup.liberties.size === 0 && captured.length === 0) {
    board.delete(key);
    return { captured: [], illegal: "suicide" };
  }

  return { captured, illegal: "" };
}

function collectGroup(board, x, y, size) {
  const start = board.get(pointKey(x, y));
  const stones = new Set();
  const liberties = new Set();
  if (!start) return { stones, liberties };

  const stack = [[x, y]];
  while (stack.length) {
    const [cx, cy] = stack.pop();
    const key = pointKey(cx, cy);
    if (stones.has(key)) continue;
    const stone = board.get(key);
    if (!stone || stone.color !== start.color) continue;
    stones.add(key);
    boardNeighbors(cx, cy, size).forEach(([nx, ny]) => {
      const neighborKey = pointKey(nx, ny);
      const neighbor = board.get(neighborKey);
      if (!neighbor) liberties.add(neighborKey);
      else if (neighbor.color === start.color && !stones.has(neighborKey)) stack.push([nx, ny]);
    });
  }
  return { stones, liberties };
}

function isLegalGoMove(board, item, size) {
  const trial = cloneBoard(board);
  return !applyGoMove(trial, item, size).illegal;
}

function setFeedback(message, type = "info") {
  dom.feedback.textContent = message;
  dom.feedback.className = `feedback ${type}`;
}

function resetPracticeState() {
  ui.sequenceAnswers = [];
  ui.freeMoves = [];
  ui.choiceSelection = null;
  ui.practiceHint = null;
  ui.reviewHints = [];
  ui.practiceResult = null;
  ui.showAnswer = false;
  if (ui.mode !== "edit") ui.selectedMoveIndex = -1;
  setFeedback("准备好了，可以开始。", "info");
}

function touchRecord(record) {
  record.updatedAt = new Date().toISOString();
  saveStore();
}

function setBoardSize(size) {
  const record = selectedRecord();
  if (!record) return;
  const nextSize = clampBoardSize(size);
  const hasOutOfRange = [...record.initialMoves, ...record.answerMoves, ...(record.choicePoints || [])].some(
    (item) => item.x >= nextSize || item.y >= nextSize,
  );
  if (hasOutOfRange && !window.confirm("新棋盘会移除越界棋子，确定继续吗？")) {
    dom.customBoardSize.value = record.boardSize;
    return;
  }
  record.boardSize = nextSize;
  record.initialMoves = record.initialMoves.filter((item) => item.x < nextSize && item.y < nextSize);
  record.answerMoves = record.answerMoves.filter((item) => item.x < nextSize && item.y < nextSize);
  record.choicePoints = normalizeChoicePoints((record.choicePoints || []).filter((item) => item.x < nextSize && item.y < nextSize), nextSize);
  renumberRecord(record);
  touchRecord(record);
  resetPracticeState();
  render();
}

function clampBoardSize(size) {
  const parsed = Number(size);
  if (Number.isNaN(parsed)) return 9;
  return Math.min(19, Math.max(5, Math.round(parsed)));
}

function starPoints(size) {
  if (size < 7) return [];
  const low = size >= 13 ? 3 : 2;
  const high = size - 1 - low;
  const middle = Math.floor(size / 2);
  if (size < 9) return [{ x: middle, y: middle }];
  if (size === 9) {
    return [
      { x: low, y: low },
      { x: high, y: low },
      { x: middle, y: middle },
      { x: low, y: high },
      { x: high, y: high },
    ];
  }
  return [
    { x: low, y: low },
    { x: middle, y: low },
    { x: high, y: low },
    { x: low, y: middle },
    { x: middle, y: middle },
    { x: high, y: middle },
    { x: low, y: high },
    { x: middle, y: high },
    { x: high, y: high },
  ];
}

function applyRecordTitleInput(shouldRender = false) {
  const record = selectedRecord();
  if (!record) return;
  const title = dom.recordTitle.value.trim() || "未命名定式";
  const now = new Date().toISOString();
  recordsForJoseki(record.josekiId).forEach((item) => {
    item.title = title;
    item.updatedAt = now;
  });
  saveStore();
  if (shouldRender) {
    render();
  } else {
    renderCategories();
    renderCards();
    renderPrintSelection();
  }
}

dom.categoryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = dom.newCategoryName.value.trim();
  if (!name) return;
  const now = new Date().toISOString();
  const category = {
    id: createId("cat"),
    name,
    color: "#0e9488",
    createdAt: now,
    updatedAt: now,
  };
  store.categories.push(category);
  ui.selectedCategoryId = category.id;
  ui.selectedRecordId = "";
  dom.newCategoryName.value = "";
  saveStore();
  render();
});

dom.leftPaneToggle?.addEventListener("click", () => {
  ui.sidebarCollapsed = !ui.sidebarCollapsed;
  renderLayoutState();
});

dom.rightPaneToggle?.addEventListener("click", () => {
  ui.rightPanelCollapsed = !ui.rightPanelCollapsed;
  renderLayoutState();
});

dom.accountPanelButton?.addEventListener("click", () => {
  ui.sidebarCollapsed = false;
  if (dom.accountSyncDetails) dom.accountSyncDetails.open = true;
  renderLayoutState();
  dom.authPanel?.scrollIntoView({ behavior: "smooth", block: "start" });
  dom.authEmail?.focus({ preventScroll: true });
});

dom.moreMenuButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  const nextHidden = !dom.topMoreMenu.hidden;
  dom.topMoreMenu.hidden = nextHidden;
  dom.moreMenuButton.setAttribute("aria-expanded", String(!nextHidden));
});

document.addEventListener("click", (event) => {
  if (!dom.topMoreMenu || dom.topMoreMenu.hidden) return;
  if (event.target.closest(".menu-wrap")) return;
  dom.topMoreMenu.hidden = true;
  dom.moreMenuButton?.setAttribute("aria-expanded", "false");
});

dom.clearTagFilter.addEventListener("click", () => {
  ui.selectedTags.clear();
  ui.selectedRecordId = filteredRecords()[0]?.id || "";
  render();
});

dom.recordTitle.addEventListener("input", () => applyRecordTitleInput(false));
dom.recordTitle.addEventListener("change", () => applyRecordTitleInput(true));

dom.variantName.addEventListener("change", () => {
  const record = selectedRecord();
  if (!record) return;
  record.variantName = dom.variantName.value.trim() || "基础变化";
  touchRecord(record);
  render();
});

dom.variantAdvantage.addEventListener("change", () => {
  const record = selectedRecord();
  if (!record) return;
  record.advantage = normalizeAdvantage(dom.variantAdvantage.value);
  touchRecord(record);
  render();
});

dom.recordCategory.addEventListener("change", () => {
  const record = selectedRecord();
  if (!record) return;
  updateJosekiGroup(record, { categoryId: dom.recordCategory.value });
  render();
});

dom.recordTags.addEventListener("change", () => {
  const record = selectedRecord();
  if (!record) return;
  const tags = dom.recordTags.value
    .split(/[,，]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
  updateJosekiGroup(record, { tags });
  render();
});

dom.recordNotes.addEventListener("change", () => {
  const record = selectedRecord();
  if (!record) return;
  record.notes = dom.recordNotes.value.trim();
  ui.hasUnsavedEdit = false;
  touchRecord(record);
});

dom.recordNotes.addEventListener("input", () => {
  ui.hasUnsavedEdit = true;
});

document.querySelectorAll(".board-size-controls button").forEach((button) => {
  button.addEventListener("click", () => setBoardSize(button.dataset.size));
});

dom.customBoardSize.addEventListener("change", () => setBoardSize(dom.customBoardSize.value));

dom.modeSelector.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-mode]");
  if (!button) return;
  ui.mode = button.dataset.mode;
  if (ui.mode !== "edit") ui.isRecordingSequence = false;
  resetPracticeState();
  render();
});

dom.editToolSelector.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-tool]");
  if (!button) return;
  ui.editTool = button.dataset.tool;
  renderControls();
});

dom.recordSequenceButton.addEventListener("click", () => {
  if (!selectedRecord()) return;
  ui.isRecordingSequence = !ui.isRecordingSequence;
  setFeedback(
    ui.isRecordingSequence ? "已开始记录顺序，后续落子会从 1 开始编号。" : "已停止记录，后续落子只作为题面。",
    "info",
  );
  renderControls();
});

dom.clearVariationButton?.addEventListener("click", () => {
  const record = selectedRecord();
  if (!record) return;
  if (!window.confirm("清空当前变形的题面棋子和答案手顺？")) return;
  record.initialMoves = [];
  record.choicePoints = [];
  record.answerMoves = [];
  ui.selectedMoveIndex = -1;
  resetPracticeState();
  touchRecord(record);
  render();
});

dom.fitBoardButton?.addEventListener("click", () => {
  ui.boardZoom = 1;
  renderControls();
});

dom.zoomInButton?.addEventListener("click", () => {
  ui.boardZoom = Math.min(1.35, Math.round((ui.boardZoom + 0.1) * 10) / 10);
  renderControls();
});

dom.zoomOutButton?.addEventListener("click", () => {
  ui.boardZoom = Math.max(0.75, Math.round((ui.boardZoom - 0.1) * 10) / 10);
  renderControls();
});

dom.correctionSelector.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-correction]");
  if (!button) return;
  ui.correctionMode = button.dataset.correction;
  resetPracticeState();
  render();
});

dom.hintToggle.addEventListener("change", () => {
  ui.hintsEnabled = dom.hintToggle.checked;
  if (!ui.hintsEnabled) ui.practiceHint = null;
  renderControls();
  renderBoard();
});

dom.newRecordButton.addEventListener("click", () => {
  const record = createBlankRecord();
  if (ui.selectedCategoryId !== "all") record.categoryId = ui.selectedCategoryId;
  store.records.push(record);
  ui.selectedRecordId = record.id;
  ui.mode = "edit";
  ui.isRecordingSequence = false;
  resetPracticeState();
  saveStore();
  render();
});

dom.newVariantButton.addEventListener("click", () => {
  const current = selectedRecord();
  if (!current) return;
  const now = new Date().toISOString();
  const variantCount = recordsInCurrentJoseki().length + 1;
  const variant = {
    ...structuredClone(current),
    id: createId("rec"),
    variantName: `变化${variantCount}`,
    advantage: "even",
    choicePoints: [],
    answerMoves: [],
    notes: "",
    createdAt: now,
    updatedAt: now,
  };
  store.records.push(variant);
  ui.selectedRecordId = variant.id;
  ui.mode = "edit";
  ui.isRecordingSequence = true;
  resetPracticeState();
  saveStore();
  render();
});

dom.duplicateRecordButton.addEventListener("click", () => {
  const record = selectedRecord();
  if (!record) return;
  const now = new Date().toISOString();
  const copy = structuredClone(record);
  copy.id = createId("rec");
  copy.variantName = `${record.variantName || "基础变化"} 副本`;
  copy.createdAt = now;
  copy.updatedAt = now;
  store.records.push(copy);
  ui.selectedRecordId = copy.id;
  resetPracticeState();
  saveStore();
  render();
});

dom.deleteRecordButton.addEventListener("click", () => {
  const record = selectedRecord();
  deleteVariantRecord(record);
});

dom.deleteJosekiButton.addEventListener("click", () => {
  const record = selectedRecord();
  if (!record) return;
  deleteJosekiGroup(record);
});

dom.archiveRecordButton?.addEventListener("click", archiveCurrentRecord);

dom.restoreArchiveButton?.addEventListener("click", restoreSelectedArchive);

dom.deleteArchiveButton?.addEventListener("click", deleteSelectedArchive);

dom.editRecordButton.addEventListener("click", () => {
  if (!selectedRecord()) return;
  ui.mode = "edit";
  ui.isRecordingSequence = false;
  resetPracticeState();
  setFeedback("已回到编辑定式。先摆题面棋子，再开始记录答案顺序。", "info");
  render();
});

dom.startPracticeButton.addEventListener("click", () => {
  const record = selectedRecord();
  if (!record) return;
  ui.mode = ui.mode === "edit" ? "free" : ui.mode;
  resetPracticeState();
  if (ui.mode === "sequence") {
    setFeedback("请按正确顺序点击空心圆。", "info");
  } else if (ui.mode === "choice") {
    const first = record.answerMoves[0];
    const hasCandidates = (record.choicePoints || []).length > 0;
    const hasCorrectCandidate = first && (record.choicePoints || []).some((item) => samePoint(item, first.x, first.y));
    if (!first) {
      setFeedback("这个变形还没有答案步骤，不能练最佳点。", "bad");
    } else if (!hasCandidates) {
      setFeedback("请先在编辑模式用“候选点”标出 A/B/C/D。", "bad");
    } else if (!hasCorrectCandidate) {
      setFeedback("候选点里还没有答案第 1 手，请把正确位置也标成候选点。", "bad");
    } else {
      setFeedback("先选择最佳点。选错直接判错，选对后继续走后续变化。", "info");
    }
  } else if (ui.mode === "free" && ui.correctionMode === "instant") {
    const first = record.answerMoves[0];
    setFeedback(first ? `第 ${first.moveNo || 1} 手已标出，请按提示落子。` : "这个变形还没有答案步骤。", "info");
  } else if (ui.mode === "free") {
    setFeedback(`本题共 ${record.answerMoves.length} 手，落满后统一批改。`, "info");
  } else {
    setFeedback("准备好了，可以开始。", "info");
  }
  render();
});

dom.undoMoveButton.addEventListener("click", () => {
  if (ui.mode === "choice") undoChoiceMove();
  else undoFreeMove();
});

dom.resetPracticeButton.addEventListener("click", () => {
  resetPracticeState();
  renderControls();
  renderBoard();
});

dom.shufflePracticeButton?.addEventListener("click", () => {
  const records = filteredRecords();
  if (!records.length) return;
  ui.selectedRecordId = records[Math.floor(Math.random() * records.length)].id;
  ui.mode = "free";
  resetPracticeState();
  render();
});

dom.showAnswerButton.addEventListener("click", () => {
  ui.showAnswer = !ui.showAnswer;
  renderControls();
  renderBoard();
});

dom.importButton.addEventListener("click", () => dom.importFile.click());
dom.importFile.addEventListener("change", async () => {
  const file = dom.importFile.files?.[0];
  if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    importData(imported);
    saveStore();
    resetPracticeState();
    render();
    setFeedback("导入完成。", "good");
  } catch (error) {
    console.error(error);
    setFeedback("导入失败，请检查 JSON 文件。", "bad");
  } finally {
    dom.importFile.value = "";
  }
});

dom.exportCurrentButton.addEventListener("click", () => {
  if (dom.topMoreMenu) dom.topMoreMenu.hidden = true;
  dom.moreMenuButton?.setAttribute("aria-expanded", "false");
  exportJson({ ...store, records: [selectedRecord()].filter(Boolean) }, "当前定式");
});

dom.exportAllButton.addEventListener("click", () => {
  if (dom.topMoreMenu) dom.topMoreMenu.hidden = true;
  dom.moreMenuButton?.setAttribute("aria-expanded", "false");
  exportJson(store, "全部定式");
});

dom.printButton.addEventListener("click", () => {
  dom.topMoreMenu.hidden = true;
  dom.moreMenuButton?.setAttribute("aria-expanded", "false");
  if (preparePrint()) window.print();
});

dom.printPanelButton?.addEventListener("click", () => {
  if (preparePrint()) window.print();
});

dom.clearPrintHistoryButton?.addEventListener("click", () => {
  if (!store.printHistory?.length) return;
  if (!window.confirm("清空所有打印记录？")) return;
  store.printHistory = [];
  saveStore();
  renderPrintHistory();
  setFeedback("打印记录已清空。", "info");
});

dom.summaryCloseButton?.addEventListener("click", () => {
  dom.practiceSummary.hidden = true;
});

dom.summaryRetryButton?.addEventListener("click", () => {
  dom.practiceSummary.hidden = true;
  resetPracticeState();
  render();
});

dom.summaryNextButton?.addEventListener("click", () => {
  dom.practiceSummary.hidden = true;
  selectNextRecordForPractice();
});

dom.signInButton?.addEventListener("click", () => {
  signInWithEmail();
});

dom.signUpButton?.addEventListener("click", () => {
  signUpWithEmail();
});

dom.signOutButton?.addEventListener("click", () => {
  signOutCloud();
});

dom.syncNowButton?.addEventListener("click", () => {
  uploadCloudStore({ statusPrefix: "正在手动同步" });
});

document.querySelectorAll("input[name='printLayout']").forEach((input) => {
  input.addEventListener("change", () => {
    ui.printLayout = input.value;
  });
});

dom.boardTheme.addEventListener("change", () => {
  store.settings = store.settings || { boardTheme: "wood" };
  store.settings.boardTheme = normalizeBoardTheme(dom.boardTheme.value);
  saveStore();
  renderBoard();
});

function importData(imported) {
  const records = Array.isArray(imported.records) ? imported.records : [];
  const categories = Array.isArray(imported.categories) ? imported.categories : [];
  if (!records.length && !categories.length) throw new Error("Empty import");

  const categoryIdMap = new Map();
  categories.forEach((category) => {
    const id = store.categories.some((item) => item.id === category.id) ? createId("cat") : category.id || createId("cat");
    categoryIdMap.set(category.id, id);
    store.categories.push({
      id,
      name: category.name || "导入分类",
      color: category.color || "#0e9488",
      createdAt: category.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  const josekiIdMap = new Map();
  records.forEach((record) => {
    const id = store.records.some((item) => item.id === record.id) ? createId("rec") : record.id || createId("rec");
    const sourceJosekiId = record.josekiId || `${record.categoryId || ""}::${record.title || ""}`;
    if (!josekiIdMap.has(sourceJosekiId)) {
      const importedJosekiId = record.josekiId;
      const targetJosekiId =
        importedJosekiId && !store.records.some((item) => item.josekiId === importedJosekiId)
          ? importedJosekiId
          : createId("jos");
      josekiIdMap.set(sourceJosekiId, targetJosekiId);
    }
    const categoryId =
      categoryIdMap.get(record.categoryId) ||
      store.categories.find((category) => category.id === record.categoryId)?.id ||
      store.categories[0].id;
    store.records.push({
      id,
      josekiId: josekiIdMap.get(sourceJosekiId),
      title: record.title || "导入定式",
      variantName: record.variantName || "基础变化",
      advantage: normalizeAdvantage(record.advantage),
      categoryId,
      tags: Array.isArray(record.tags) ? record.tags : [],
      boardSize: clampBoardSize(record.boardSize || 9),
      initialMoves: sanitizeMoves(record.initialMoves || []),
      choicePoints: normalizeChoicePoints(record.choicePoints || [], record.boardSize || 9),
      answerMoves: sanitizeMoves(record.answerMoves || []),
      archives: normalizeRecordArchives(record.archives || [], record.boardSize || 9),
      notes: record.notes || "",
      createdAt: record.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });
  if (imported.settings?.boardTheme) {
    store.settings = store.settings || { boardTheme: "wood" };
    store.settings.boardTheme = normalizeBoardTheme(imported.settings.boardTheme);
  }
  if (Array.isArray(imported.libraryArchives)) {
    store.libraryArchives = normalizeLibraryArchives([...(store.libraryArchives || []), ...imported.libraryArchives]);
  }
  if (Array.isArray(imported.printHistory)) {
    store.printHistory = normalizePrintHistory([...(store.printHistory || []), ...imported.printHistory]);
  }
  ui.selectedRecordId = store.records.at(-1)?.id || ui.selectedRecordId;
}

function sanitizeMoves(moves) {
  return (Array.isArray(moves) ? moves : [])
    .map((item, index) => ({
      x: Number(item.x),
      y: Number(item.y),
      color: item.color === "white" ? "white" : "black",
      moveNo: Number(item.moveNo || index + 1),
    }))
    .filter((item) => Number.isInteger(item.x) && Number.isInteger(item.y) && item.x >= 0 && item.y >= 0);
}

function exportJson(data, label) {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    categories: data.categories,
    records: data.records,
    stats: data.stats || {},
    settings: data.settings || store.settings || { boardTheme: "wood" },
    libraryArchives: data.libraryArchives || [],
    printHistory: data.printHistory || [],
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `围棋定式记忆-${label}-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  URL.revokeObjectURL(link.href);
  link.remove();
}

function preparePrint() {
  const scope = dom.printScope.value;
  const contentMode = selectedPrintContentMode();
  const records = recordsForPrint(scope);
  dom.printRoot.innerHTML = "";
  if (!records.length) {
    window.alert("没有可打印的定式。");
    return false;
  }
  if (contentMode === "practice" || contentMode === "both") {
    appendPrintSheet(records, false);
  }
  if (contentMode === "answers" || contentMode === "both") {
    appendPrintSheet(records, true);
  }
  recordPrintHistory(records, scope, contentMode);
  return true;
}

function selectedPrintContentMode() {
  return normalizePrintContentMode(document.querySelector("input[name='printContent']:checked")?.value);
}

function normalizePrintContentMode(value) {
  return ["practice", "answers", "both"].includes(value) ? value : "practice";
}

function normalizePrintScope(value) {
  return ["current", "joseki", "selected", "category", "all"].includes(value) ? value : "current";
}

function printContentLabel(value) {
  const normalized = normalizePrintContentMode(value);
  if (normalized === "answers") return "答案页";
  if (normalized === "both") return "练习+答案";
  return "练习页";
}

function printScopeLabel(value) {
  const normalized = normalizePrintScope(value);
  if (normalized === "joseki") return "当前定式全部变形";
  if (normalized === "selected") return "勾选内容";
  if (normalized === "category") return ui.selectedCategoryId === "all" ? "当前筛选" : "当前分类";
  if (normalized === "all") return "全部定式";
  return "当前变形";
}

function recordPrintHistory(records, scope, contentMode) {
  const titles = records.map((record) => {
    const variant = record.variantName || "基础变化";
    return record.title && record.title !== variant ? `${record.title} · ${variant}` : variant;
  });
  const entry = {
    id: createId("prt"),
    printedAt: new Date().toISOString(),
    scope: normalizePrintScope(scope),
    scopeLabel: printScopeLabel(scope),
    contentMode: normalizePrintContentMode(contentMode),
    contentLabel: printContentLabel(contentMode),
    layout: ui.printLayout === "single" ? "single" : "grid",
    recordCount: records.length,
    recordTitles: titles.slice(0, 12),
  };
  store.printHistory = normalizePrintHistory([entry, ...(store.printHistory || [])]);
  saveStore();
  renderPrintHistory();
}

function appendPrintSheet(records, withAnswers) {
  const sheet = document.createElement("div");
  sheet.className = `print-sheet ${withAnswers ? "answer-sheet" : "practice-sheet"}`;
  const grid = document.createElement("div");
  grid.className = `print-grid ${ui.printLayout === "single" ? "single" : ""}`;
  records.forEach((record) => {
    grid.appendChild(createPrintCardSvg(record, withAnswers));
  });
  sheet.appendChild(grid);
  dom.printRoot.appendChild(sheet);
}

function recordsForPrint(scope) {
  if (scope === "joseki") return recordsInCurrentJoseki();
  if (scope === "selected") {
    const selected = store.records.filter((record) => ui.selectedPrintIds.has(record.id));
    return selected.length ? selected : [selectedRecord()].filter(Boolean);
  }
  if (scope === "all") return store.records;
  if (scope === "category") {
    if (ui.selectedCategoryId === "all") return filteredRecords();
    return store.records.filter((record) => record.categoryId === ui.selectedCategoryId);
  }
  return [selectedRecord()].filter(Boolean);
}

function createPrintCardSvg(record, withAnswers) {
  const card = document.createElement("article");
  card.className = "print-card";
  const title = document.createElement("h2");
  const advantage = advantageLabel(record.advantage);
  const variantTitle = `${record.title} · ${record.variantName || "基础变化"}${advantage ? ` · ${advantage}` : ""}`;
  title.textContent = withAnswers ? `${variantTitle}（答案）` : variantTitle;
  const board = createPrintBoardSvg(record, withAnswers);
  const note = document.createElement("p");
  note.textContent = withAnswers
    ? record.notes || "按编号复盘。"
    : (record.choicePoints || []).length
      ? "先选择最佳点，再完成后续变化。"
      : "请在空心圆中填写正确手顺。";
  card.append(title, board, note);
  return card;
}

function createPrintBoardSvg(record, withAnswers) {
  const theme = printTheme(normalizeBoardTheme(store.settings?.boardTheme));
  const size = clampBoardSize(record.boardSize);
  const gridStart = 120;
  const gridEnd = 880;
  const gridSize = gridEnd - gridStart;
  const toSvgPoint = (index) => gridStart + (index / (size - 1)) * gridSize;
  const cell = gridSize / (size - 1);
  const stoneRadius = Math.min(23, Math.max(13, cell * 0.35));
  const answerRadius = Math.min(28, Math.max(16, cell * 0.43));
  const svg = createSvgElement("svg", {
    class: "print-board-svg",
    viewBox: "0 0 1000 1000",
    role: "img",
    "aria-label": `${record.title}棋盘`,
  });

  svg.appendChild(
    createSvgElement("rect", {
      x: 20,
      y: 20,
      width: 960,
      height: 960,
      rx: 8,
      fill: theme.background,
      stroke: theme.border,
      "stroke-width": 3,
    }),
  );

  for (let index = 0; index < size; index += 1) {
    const position = toSvgPoint(index);
    svg.appendChild(
      createSvgElement("line", {
        x1: position,
        y1: gridStart,
        x2: position,
        y2: gridEnd,
        stroke: theme.grid,
        "stroke-width": 2.2,
      }),
    );
    svg.appendChild(
      createSvgElement("line", {
        x1: gridStart,
        y1: position,
        x2: gridEnd,
        y2: position,
        stroke: theme.grid,
        "stroke-width": 2.2,
      }),
    );
  }

  starPoints(size).forEach((point) => {
    svg.appendChild(
      createSvgElement("circle", {
        cx: toSvgPoint(point.x),
        cy: toSvgPoint(point.y),
        r: Math.min(5, Math.max(3, cell * 0.1)),
        fill: theme.grid,
      }),
    );
  });

  appendSvgCoordinates(svg, size, toSvgPoint, theme.grid);

  record.initialMoves.forEach((item) => {
    const cx = toSvgPoint(item.x);
    const cy = toSvgPoint(item.y);
    const isBlack = item.color === "black";
    svg.appendChild(
      createSvgElement("circle", {
        cx,
        cy,
        r: stoneRadius,
        fill: isBlack ? "#111111" : "#ffffff",
        stroke: "#111111",
        "stroke-width": isBlack ? 1.5 : 2.4,
      }),
    );
  });

  record.answerMoves.forEach((item) => {
    const cx = toSvgPoint(item.x);
    const cy = toSvgPoint(item.y);
    svg.appendChild(
      createSvgElement("circle", {
        cx,
        cy,
        r: answerRadius,
        fill: "#ffffff",
        stroke: "#111111",
        "stroke-width": 4,
      }),
    );
    if (withAnswers) {
      svg.appendChild(
        createSvgText(String(item.moveNo || ""), cx, cy + answerRadius * 0.34, {
          fill: "#111111",
          size: Math.max(16, answerRadius * 1.05),
          weight: "900",
        }),
      );
    }
  });

  if ((record.choicePoints || []).length) {
    const firstAnswer = record.answerMoves[0];
    record.choicePoints.forEach((item) => {
      const cx = toSvgPoint(item.x);
      const cy = toSvgPoint(item.y);
      const isCorrect = firstAnswer && samePoint(firstAnswer, item.x, item.y);
      svg.appendChild(
        createSvgElement("circle", {
          cx,
          cy,
          r: answerRadius * 0.92,
          fill: "#ffd769",
          stroke: withAnswers && isCorrect ? "#0e9488" : "#f1ba35",
          "stroke-width": withAnswers && isCorrect ? 5 : 3,
        }),
      );
      svg.appendChild(
        createSvgText(item.label || "", cx, cy + answerRadius * 0.32, {
          fill: "#075bb8",
          size: Math.max(18, answerRadius * 1.05),
          weight: "900",
        }),
      );
    });
  }

  return svg;
}

function appendSvgCoordinates(svg, size, toSvgPoint, color) {
  const letters = coordinateLetters(size);
  for (let index = 0; index < size; index += 1) {
    const position = toSvgPoint(index);
    const number = String(size - index);
    const letter = letters[index];
    svg.appendChild(createSvgText(letter, position, 78, { fill: color, size: 22, weight: "800" }));
    svg.appendChild(createSvgText(letter, position, 948, { fill: color, size: 22, weight: "800" }));
    svg.appendChild(createSvgText(number, 70, position + 8, { fill: color, size: 22, weight: "800" }));
    svg.appendChild(createSvgText(number, 930, position + 8, { fill: color, size: 22, weight: "800" }));
  }
}

function printTheme(theme) {
  if (theme === "wood") {
    return { background: "#e6bd65", border: "#8b5d1c", grid: "#4c351c" };
  }
  if (theme === "pale") {
    return { background: "#fbf0d4", border: "#8b5d1c", grid: "#222222" };
  }
  return { background: "#ffffff", border: "#111111", grid: "#111111" };
}

function createSvgElement(name, attributes) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, String(value));
  });
  return element;
}

function createSvgText(text, x, y, options) {
  const element = createSvgElement("text", {
    x,
    y,
    fill: options.fill,
    "font-size": options.size,
    "font-weight": options.weight,
    "font-family": "Arial, Helvetica, sans-serif",
    "text-anchor": "middle",
  });
  element.textContent = text;
  return element;
}

function createPrintCard(record, withAnswers) {
  const card = document.createElement("article");
  card.className = "print-card";
  const title = document.createElement("h2");
  title.textContent = withAnswers ? `${record.title}（答案）` : record.title;
  const board = document.createElement("div");
  board.className = "print-board";
  board.dataset.theme = normalizeBoardTheme(store.settings?.boardTheme);
  const cellPercent = 84 / (record.boardSize - 1);
  board.style.setProperty("--print-stone-size", `${cellPercent * 0.88}%`);
  board.style.setProperty("--print-answer-size", `${cellPercent * 0.74}%`);
  board.style.setProperty("--print-star-size", `${Math.max(0.8, cellPercent * 0.18)}%`);
  appendGridLines(board, record.boardSize, "print-line");
  appendCoordinateLabels(board, record.boardSize, "print-coord");

  starPoints(record.boardSize).forEach((point) => {
    const star = document.createElement("span");
    star.className = "print-star";
    placePrintElement(star, point.x, point.y, record.boardSize);
    board.appendChild(star);
  });

  record.initialMoves.forEach((item) => {
    const stone = document.createElement("span");
    stone.className = `print-stone ${item.color}`;
    stone.textContent = item.moveNo;
    placePrintElement(stone, item.x, item.y, record.boardSize);
    board.appendChild(stone);
  });

  record.answerMoves.forEach((item) => {
    const answer = document.createElement("span");
    answer.className = `print-answer${withAnswers ? " with-number" : ""}`;
    answer.textContent = withAnswers ? item.moveNo : "";
    placePrintElement(answer, item.x, item.y, record.boardSize);
    board.appendChild(answer);
  });

  const note = document.createElement("p");
  note.textContent = withAnswers ? record.notes || "按编号复盘。" : "请在空心圆中填写正确手顺。";
  card.append(title, board, note);
  return card;
}

function placePrintElement(element, x, y, size) {
  element.style.left = `${pointToPercent(x, size)}%`;
  element.style.top = `${pointToPercent(y, size)}%`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
