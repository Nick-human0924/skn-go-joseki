(function () {
  "use strict";

  const STORAGE_KEY = "go-joseki-memory:v1";
  const LAST_SYNC_KEY = "go-joseki-memory:last-cloud-sync";
  const TABLE = "go_joseki_stores";
  const DEBOUNCE_MS = 900;
  const CHANGE_SCAN_MS = 2500;

  const state = {
    client: null,
    user: null,
    ready: false,
    uploading: false,
    debounceId: 0,
    scanId: 0,
    lastStoreSnapshot: "",
    status: "未登录：数据只保存在当前浏览器",
  };

  const $ = (id) => document.getElementById(id);

  function ensureUi() {
    if (!$("accountPanelButton")) {
      const topActions = document.querySelector(".top-actions");
      const button = document.createElement("button");
      button.className = "icon-button";
      button.id = "accountPanelButton";
      button.type = "button";
      button.title = "打开账号同步";
      button.textContent = "账号";
      topActions?.insertBefore(button, topActions.firstChild);
    }

    if (!$("accountSyncDetails")) {
      const sidebar = $("rightSidebar") || document.querySelector(".control-panel");
      if (!sidebar) return;

      const details = document.createElement("details");
      details.className = "panel task-panel";
      details.id = "accountSyncDetails";
      details.open = true;
      details.innerHTML = `
        <summary>账号同步</summary>
        <div class="auth-panel" id="authPanel">
          <div class="auth-account">
            <span id="authAccountLabel">未登录</span>
            <small id="authLastSyncLabel">尚未同步</small>
          </div>
          <label class="field-row">
            邮箱
            <input id="authEmail" type="email" autocomplete="email" placeholder="parent@example.com" />
          </label>
          <label class="field-row">
            密码
            <input id="authPassword" type="password" autocomplete="current-password" placeholder="至少 6 位密码" />
          </label>
          <div class="auth-actions">
            <button type="button" class="primary-button" id="loginButton">登录</button>
            <button type="button" class="secondary-button" id="signupButton">注册</button>
          </div>
          <div class="auth-actions signed-in-actions">
            <button type="button" class="secondary-button" id="syncNowButton">手动同步</button>
            <button type="button" id="logoutButton">退出</button>
          </div>
          <p class="sync-status" id="syncStatus">未登录：数据只保存在当前浏览器</p>
        </div>
      `;
      sidebar.insertBefore(details, sidebar.firstChild);
    }

    if (!$("supabaseSyncStyle")) {
      const style = document.createElement("style");
      style.id = "supabaseSyncStyle";
      style.textContent = `
        .auth-panel { display: grid; gap: 10px; }
        .auth-account { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
        .auth-account span { font-weight: 700; }
        .auth-account small, .sync-status { color: var(--muted, #64748b); }
        .auth-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .signed-in-actions { display: none; }
        .auth-panel.is-signed-in .signed-in-actions { display: grid; }
        .auth-panel.is-signed-in #loginButton,
        .auth-panel.is-signed-in #signupButton,
        .auth-panel.is-signed-in #signInButton,
        .auth-panel.is-signed-in #signUpButton { display: none; }
        .sync-status { margin: 0; font-size: 12px; line-height: 1.5; }
      `;
      document.head.appendChild(style);
    }
  }

  function setStatus(message, isError) {
    state.status = message;
    const status = $("syncStatus");
    if (status) {
      status.textContent = message;
      status.style.color = isError ? "#b42318" : "";
    }
  }

  function updateUi() {
    const signedIn = Boolean(state.user);
    $("authPanel")?.classList.toggle("is-signed-in", signedIn);

    const account = $("authAccountLabel");
    if (account) account.textContent = signedIn ? state.user.email || "已登录账号" : "未登录";

    const last = localStorage.getItem(LAST_SYNC_KEY);
    const lastLabel = $("authLastSyncLabel");
    if (lastLabel) lastLabel.textContent = last ? `最近同步 ${new Date(last).toLocaleString()}` : "尚未同步";

    const email = $("authEmail");
    const password = $("authPassword");
    if (email) email.disabled = signedIn;
    if (password) password.disabled = signedIn;

    setStatus(state.status, false);
  }

  function readLocalStore() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { categories: [], records: [], selectedCategoryId: null, selectedRecordId: null, selectedVariantId: null };
    try {
      return JSON.parse(raw);
    } catch (error) {
      throw new Error("本地数据不是有效 JSON，已停止云同步");
    }
  }

  function markSynced() {
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
    updateUi();
  }

  async function uploadLocalStore(reason) {
    if (!state.client || !state.user || state.uploading) return;
    state.uploading = true;
    try {
      const store = readLocalStore();
      state.lastStoreSnapshot = JSON.stringify(store);
      const { error } = await state.client.from(TABLE).upsert(
        { user_id: state.user.id, store },
        { onConflict: "user_id" }
      );
      if (error) throw error;
      markSynced();
      setStatus(reason === "manual" ? "已手动同步到云端" : "已自动同步到云端", false);
    } catch (error) {
      setStatus(error.message || "云同步失败", true);
    } finally {
      state.uploading = false;
    }
  }

  function scheduleUpload() {
    if (!state.user) return;
    window.clearTimeout(state.debounceId);
    state.debounceId = window.setTimeout(() => uploadLocalStore("auto"), DEBOUNCE_MS);
  }

  function currentStoreSnapshot() {
    return localStorage.getItem(STORAGE_KEY) || "";
  }

  function scanLocalStoreChange() {
    if (!state.user) return;
    const snapshot = currentStoreSnapshot();
    if (!snapshot || snapshot === state.lastStoreSnapshot) return;
    state.lastStoreSnapshot = snapshot;
    scheduleUpload();
  }

  async function pullOrSeedCloudStore() {
    if (!state.client || !state.user) return;
    setStatus("正在同步云端数据...", false);
    const { data, error } = await state.client
      .from(TABLE)
      .select("store, updated_at")
      .eq("user_id", state.user.id)
      .maybeSingle();

    if (error) {
      setStatus(error.message || "读取云端数据失败", true);
      return;
    }

    if (data?.store) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data.store));
      state.lastStoreSnapshot = currentStoreSnapshot();
      if (data.updated_at) localStorage.setItem(LAST_SYNC_KEY, data.updated_at);
      setStatus("已从云端拉取账号数据，正在刷新页面", false);
      window.setTimeout(() => window.location.reload(), 250);
      return;
    }

    await uploadLocalStore("manual");
    setStatus("云端无数据，已上传当前本地数据", false);
  }

  function getAuthValues() {
    return {
      email: $("authEmail")?.value.trim() || "",
      password: $("authPassword")?.value || "",
    };
  }

  async function login() {
    if (!state.client) return;
    const values = getAuthValues();
    if (!values.email || !values.password) {
      setStatus("请输入邮箱和密码", true);
      return;
    }
    setStatus("正在登录...", false);
    const { error } = await state.client.auth.signInWithPassword(values);
    if (error) setStatus(error.message || "登录失败", true);
    else if ($("authPassword")) $("authPassword").value = "";
  }

  async function signup() {
    if (!state.client) return;
    const values = getAuthValues();
    if (!values.email || values.password.length < 6) {
      setStatus("请输入邮箱和至少 6 位密码", true);
      return;
    }
    setStatus("正在注册...", false);
    const { data, error } = await state.client.auth.signUp(values);
    if (error) {
      setStatus(error.message || "注册失败", true);
      return;
    }
    if ($("authPassword")) $("authPassword").value = "";
    if (data.session) setStatus("注册成功，正在同步", false);
    else setStatus("注册成功，请按邮件提示确认后再登录", false);
  }

  async function logout() {
    if (!state.client) return;
    const { error } = await state.client.auth.signOut();
    if (error) setStatus(error.message || "退出失败", true);
  }

  function patchLocalStorage() {
    const original = localStorage.setItem.bind(localStorage);
    if (localStorage.__goJosekiSupabasePatched) return;
    Object.defineProperty(localStorage, "__goJosekiSupabasePatched", { value: true });
    localStorage.setItem = function (key, value) {
      original(key, value);
      if (key === STORAGE_KEY) scheduleUpload();
    };
  }

  async function initSupabase() {
    const config = window.GO_JOSEKI_SUPABASE_CONFIG || {};
    if (!window.supabase?.createClient || !config.url || !config.publishableKey) {
      setStatus("Supabase 未配置：数据只保存在当前浏览器", false);
      updateUi();
      return;
    }

    state.client = window.supabase.createClient(config.url, config.publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    state.ready = true;

    state.client.auth.onAuthStateChange(async (_event, session) => {
      const previousUserId = state.user?.id;
      state.user = session?.user || null;
      state.status = state.user ? "已登录，准备同步" : "未登录：数据只保存在当前浏览器";
      updateUi();
      if (state.user && state.user.id !== previousUserId) await pullOrSeedCloudStore();
      if (state.user) startChangeScanner();
      else stopChangeScanner();
    });

    const { data, error } = await state.client.auth.getSession();
    if (error) {
      setStatus(error.message || "读取登录状态失败", true);
      return;
    }
    state.user = data.session?.user || null;
    state.status = state.user ? "已登录，准备同步" : "未登录：数据只保存在当前浏览器";
    updateUi();
    if (state.user) {
      await pullOrSeedCloudStore();
      startChangeScanner();
    }
  }

  function startChangeScanner() {
    if (state.scanId) return;
    state.lastStoreSnapshot = currentStoreSnapshot();
    state.scanId = window.setInterval(scanLocalStoreChange, CHANGE_SCAN_MS);
  }

  function stopChangeScanner() {
    if (!state.scanId) return;
    window.clearInterval(state.scanId);
    state.scanId = 0;
  }

  function bindUi() {
    $("accountPanelButton")?.addEventListener("click", () => {
      const details = $("accountSyncDetails");
      if (details) details.open = true;
      $("authPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
      $("authEmail")?.focus({ preventScroll: true });
    });
    $("loginButton")?.addEventListener("click", login);
    $("signInButton")?.addEventListener("click", login);
    $("signupButton")?.addEventListener("click", signup);
    $("signUpButton")?.addEventListener("click", signup);
    $("logoutButton")?.addEventListener("click", logout);
    $("signOutButton")?.addEventListener("click", logout);
    $("syncNowButton")?.addEventListener("click", () => uploadLocalStore("manual"));
    $("importFile")?.addEventListener("change", () => {
      window.setTimeout(scanLocalStoreChange, 1200);
      window.setTimeout(scanLocalStoreChange, 3000);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") scanLocalStoreChange();
    });
    window.addEventListener("beforeunload", scanLocalStoreChange);
  }

  function init() {
    ensureUi();
    bindUi();
    patchLocalStorage();
    initSupabase();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
