/* 瑞賢禮儀社 PWA - Supabase 登入相容修正版
   目的：與目前 index.html 的 loginAccount / loginPassword / appView 完全對應。
   不在 localStorage 儲存密碼。
*/
"use strict";

const SUPABASE_URL = "https://zjetemcqysvpbnyvpyma.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_jdeKO7PxDMGjAg_qCFw5FA_wr5OJcei";

const $ = (id) => document.getElementById(id);

function show(id, visible) {
  const el = $(id);
  if (!el) return;
  el.hidden = !visible;
  el.classList.toggle("hidden", !visible);
  el.style.display = visible ? "" : "none";
}

function setStatus(id, message, error = false) {
  const el = $(id);
  if (!el) return;
  el.textContent = message || "";
  el.style.color = error ? "#b91c1c" : "#b45309";
}

function friendlyError(error) {
  if (!error) return "未知錯誤";
  return error.message || error.error_description || error.code || JSON.stringify(error);
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#39;"
  }[c]));
}

let supabase = null;
let currentUser = null;
let currentProfile = null;
let loginInProgress = false;
let enteringApp = false;

let customers = [];
let cases = [];
let payments = [];
let expenses = [];
let schedules = [];

function roleText(role) {
  return ({
    owner: "負責人",
    manager: "主管",
    counselor: "禮儀師",
    accounting: "會計",
    staff: "一般員工"
  })[role] || role || "員工";
}

/* 即使 index.html 尚未載入 Supabase SDK，也自動載入，不必修改 HTML */
function loadSupabaseSDK() {
  return new Promise((resolve, reject) => {
    if (window.supabase?.createClient) return resolve();

    const old = document.querySelector('script[data-ruixian-supabase]');
    if (old) {
      old.addEventListener("load", () => resolve(), { once: true });
      old.addEventListener("error", () => reject(new Error("Supabase SDK 載入失敗。")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    script.async = true;
    script.dataset.ruixianSupabase = "1";

    script.onload = () => window.supabase?.createClient
      ? resolve()
      : reject(new Error("Supabase SDK 載入後仍無法使用。"));

    script.onerror = () => reject(
      new Error("Supabase SDK 載入失敗，請確認網路連線。")
    );

    document.head.appendChild(script);
  });
}

async function initSupabase() {
  await loadSupabaseSDK();

  supabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );
}

async function loadProfile(userId) {
  const { data, error } = await supabase
    .from("staff_profiles")
    .select("user_id,name,email,role,active,created_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error("員工資料讀取失敗：" + friendlyError(error));
  }

  if (!data) {
    throw new Error("登入成功，但找不到對應的員工資料。");
  }

  if (!data.active) {
    throw new Error("這個員工帳號目前已停用。");
  }

  return data;
}

async function enterApp(session) {
  if (enteringApp) return;

  if (!session?.user) {
    throw new Error("沒有取得有效的登入 Session。");
  }

  enteringApp = true;

  try {
    currentUser = session.user;
    currentProfile = await loadProfile(currentUser.id);

    const userInfo = $("userInfo");

    if (userInfo) {
      userInfo.textContent =
        `${currentProfile.name || ""}｜${roleText(currentProfile.role)}`;
    }

    /* 目前 HTML 的真正主畫面 ID 是 appView，不是 mainView */
    show("loginView", false);
    show("appView", true);

    setStatus("loginStatus", "");

    try {
      await refreshAll();
    } catch (error) {
      console.error("雲端資料載入失敗：", error);

      setStatus(
        "dashboardStatus",
        "登入成功，但部分雲端資料無法讀取：" +
        friendlyError(error),
        true
      );
    }

    switchTab("dashboard");

  } catch (error) {
    console.error("進入系統失敗：", error);

    currentUser = null;
    currentProfile = null;

    show("appView", false);
    show("loginView", true);

    setStatus(
      "loginStatus",
      "登入失敗：" + friendlyError(error),
      true
    );

  } finally {
    enteringApp = false;
  }
}

async function refreshAll() {
  const queries = [
    [
      "customers",
      supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending:false })
    ],
    [
      "funeral_cases",
      supabase
        .from("funeral_cases")
        .select("*")
        .order("created_at", { ascending:false })
    ],
    [
      "payments",
      supabase
        .from("payments")
        .select("*")
        .order("payment_date", { ascending:false })
    ],
    [
      "expenses",
      supabase
        .from("expenses")
        .select("*")
        .order("expense_date", { ascending:false })
    ],
    [
      "schedules",
      supabase
        .from("schedules")
        .select("*")
        .order("start_at", { ascending:true })
    ]
  ];

  const results = await Promise.all(
    queries.map(x => x[1])
  );

  results.forEach((result, i) => {
    if (result.error) {
      throw new Error(
        `${queries[i][0]} 讀取失敗：${friendlyError(result.error)}`
      );
    }
  });

  customers = results[0].data || [];
  cases = results[1].data || [];
  payments = results[2].data || [];
  expenses = results[3].data || [];
  schedules = results[4].data || [];

  render();
}

function render() {
  if ($("customerCount")) {
    $("customerCount").textContent = customers.length;
  }

  if ($("caseCount")) {
    $("caseCount").textContent = cases.length;
  }

  if ($("pendingFinanceCount")) {
    $("pendingFinanceCount").textContent =
      payments.filter(x => x.status === "pending").length +
      expenses.filter(x => x.status === "pending").length;
  }

  if ($("customerList")) {
    $("customerList").innerHTML =
      customers.map(x => `
        <div class="item">
          <div class="item-title">${esc(x.name)}</div>
          <div class="item-meta">
            電話：${esc(x.phone)}<br>
            地址：${esc(x.address)}<br>
            關係：${esc(x.relation)}<br>
            備註：${esc(x.notes)}
          </div>
        </div>
      `).join("") ||
      '<div class="item muted">目前沒有客戶資料</div>';
  }

  if ($("caseList")) {
    $("caseList").innerHTML =
      cases.map(x => `
        <div class="item">
          <div class="item-title">
            ${esc(x.case_number)}｜${esc(x.deceased_name)}
          </div>
          <div class="item-meta">
            狀態：${esc(x.status)}<br>
            契約金額：
            ${Number(x.contract_amount || 0).toLocaleString()} 元<br>
            備註：${esc(x.notes)}
          </div>
        </div>
      `).join("") ||
      '<div class="item muted">目前沒有案件資料</div>';
  }

  if ($("paymentList")) {
    $("paymentList").innerHTML =
      payments.map(x => `
        <div class="item">
          <div class="item-title">
            付款 ${Number(x.amount || 0).toLocaleString()} 元
          </div>
          <div class="item-meta">
            日期：${esc(x.payment_date)}
            ｜狀態：${esc(x.status)}<br>
            ${esc(x.description)}
          </div>
        </div>
      `).join("") ||
      '<div class="item muted">目前沒有付款</div>';
  }

  if ($("expenseList")) {
    $("expenseList").innerHTML =
      expenses.map(x => `
        <div class="item">
          <div class="item-title">
            支出 ${Number(x.amount || 0).toLocaleString()} 元
          </div>
          <div class="item-meta">
            日期：${esc(x.expense_date)}
            ｜狀態：${esc(x.status)}<br>
            ${esc(x.description)}
          </div>
        </div>
      `).join("") ||
      '<div class="item muted">目前沒有支出</div>';
  }

  if ($("scheduleList")) {
    $("scheduleList").innerHTML =
      schedules.map(x => `
        <div class="item">
          <div class="item-title">${esc(x.title)}</div>
          <div class="item-meta">
            ${esc(x.start_at)}｜${esc(x.location)}<br>
            ${esc(x.notes)}
          </div>
        </div>
      `).join("") ||
      '<div class="item muted">目前沒有行程</div>';
  }
}
async function handleLogin() {
  if (loginInProgress) return;

  const accountInput = $("loginAccount");
  const passwordInput = $("loginPassword");
  const loginBtn = $("loginBtn");

  const account = accountInput?.value.trim() || "";
  const password = passwordInput?.value || "";

  if (!account) {
    setStatus("loginStatus", "請輸入帳號。", true);
    accountInput?.focus();
    return;
  }

  if (!password) {
    setStatus("loginStatus", "請輸入密碼。", true);
    passwordInput?.focus();
    return;
  }

  loginInProgress = true;

  if (loginBtn) {
    loginBtn.disabled = true;
    loginBtn.textContent = "登入中…";
  }

  setStatus("loginStatus", "正在登入，請稍候…");

  try {
    /*
      Supabase Auth 使用 Email + Password。
      因此「帳號」欄位目前直接接受 Email。
    */
    const { data, error } = await supabase.auth.signInWithPassword({
      email: account,
      password
    });

    if (error) {
      throw error;
    }

    if (!data?.session || !data?.user) {
      throw new Error("登入成功，但沒有取得有效的登入 Session。");
    }

    await enterApp(data.session);

    if (passwordInput) {
      passwordInput.value = "";
    }

  } catch (error) {
    console.error("登入錯誤：", error);

    show("appView", false);
    show("loginView", true);

    setStatus(
      "loginStatus",
      "登入失敗：" + friendlyError(error),
      true
    );

  } finally {
    loginInProgress = false;

    if (loginBtn) {
      loginBtn.disabled = false;
      loginBtn.textContent = "登入";
    }
  }
}


async function handleLogout() {
  try {
    if (supabase) {
      await supabase.auth.signOut();
    }
  } catch (error) {
    console.error("登出錯誤：", error);
  }

  currentUser = null;
  currentProfile = null;

  customers = [];
  cases = [];
  payments = [];
  expenses = [];
  schedules = [];

  show("appView", false);
  show("loginView", true);

  setStatus("loginStatus", "");

  const accountInput = $("loginAccount");
  const passwordInput = $("loginPassword");

  if (accountInput) accountInput.value = "";
  if (passwordInput) passwordInput.value = "";

  accountInput?.focus();
}


function switchTab(tabName) {
  /*
    目前 index.html 使用：
    <button data-tab="dashboard">
    而不是舊版的 .tab。
  */

  document.querySelectorAll("[data-tab]").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.tab === tabName
    );
  });

  document.querySelectorAll(
    "[data-panel], .tab-panel, .panel[data-section]"
  ).forEach(panel => {
    const panelName =
      panel.dataset.panel ||
      panel.dataset.section ||
      panel.id;

    if (!panelName) return;

    const normalized = panelName
      .replace(/Panel$/i, "")
      .replace(/^panel-/i, "");

    panel.style.display =
      normalized === tabName ? "" : "none";
  });

  /*
    相容目前 HTML 常見的區塊 ID。
  */
  const possiblePanels = {
    dashboard: [
      "dashboardView",
      "dashboardPanel",
      "dashboard"
    ],
    cases: [
      "casesView",
      "casesPanel",
      "cases"
    ],
    customers: [
      "customersView",
      "customersPanel",
      "customers"
    ],
    staff: [
      "staffView",
      "staffPanel",
      "staff"
    ],
    backup: [
      "backupView",
      "backupPanel",
      "backup"
    ],
    finance: [
      "financeView",
      "financePanel",
      "finance"
    ],
    schedules: [
      "schedulesView",
      "schedulesPanel",
      "schedules"
    ]
  };

  Object.entries(possiblePanels).forEach(([name, ids]) => {
    ids.forEach(id => {
      const el = $(id);
      if (!el) return;

      /*
        如果該元素本身就是 tab 按鈕，不處理。
      */
      if (el.matches("button,[data-tab]")) return;

      el.style.display =
        name === tabName ? "" : "none";
    });
  });
}


async function addCustomer() {
  if (!currentUser) {
    alert("請先登入。");
    return;
  }

  const name = prompt("請輸入客戶姓名：");
  if (!name?.trim()) return;

  const phone = prompt("請輸入聯絡電話：") || "";
  const address = prompt("請輸入地址：") || "";
  const relation = prompt("請輸入與亡者關係：") || "";
  const notes = prompt("請輸入備註：") || "";

  const { error } = await supabase
    .from("customers")
    .insert({
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim(),
      relation: relation.trim(),
      notes: notes.trim(),
      created_by: currentUser.id
    });

  if (error) {
    alert("新增客戶失敗：\n" + friendlyError(error));
    return;
  }

  alert("客戶新增成功。");
  await refreshAll();
}


async function addCase() {
  if (!currentUser) {
    alert("請先登入。");
    return;
  }

  if (!customers.length) {
    alert("目前沒有客戶資料，請先新增客戶。");
    return;
  }

  const customerName = prompt(
    "請輸入客戶姓名：\n\n" +
    customers.map((x, i) => `${i + 1}. ${x.name}`).join("\n")
  );

  if (!customerName?.trim()) return;

  const customer =
    customers.find(x => x.name === customerName.trim());

  if (!customer) {
    alert("找不到這位客戶。");
    return;
  }

  const caseNumber =
    prompt("請輸入案件編號：") || "";

  const deceasedName =
    prompt("請輸入亡者姓名：") || "";

  if (!deceasedName.trim()) {
    alert("亡者姓名不能空白。");
    return;
  }

  const status =
    prompt("請輸入案件狀態：", "進行中") ||
    "進行中";

  const contractAmount =
    Number(
      prompt("請輸入契約金額：", "0") || 0
    );

  const notes =
    prompt("請輸入案件備註：") || "";

  const { error } = await supabase
    .from("funeral_cases")
    .insert({
      customer_id: customer.id,
      case_number: caseNumber.trim(),
      deceased_name: deceasedName.trim(),
      status: status.trim(),
      contract_amount: contractAmount,
      notes: notes.trim(),
      created_by: currentUser.id
    });

  if (error) {
    alert("新增案件失敗：\n" + friendlyError(error));
    return;
  }

  alert("案件新增成功。");
  await refreshAll();
}


async function addPayment() {
  if (!currentUser) {
    alert("請先登入。");
    return;
  }

  const amount = Number(
    prompt("請輸入收款金額：", "0") || 0
  );

  if (!(amount > 0)) {
    alert("金額必須大於 0。");
    return;
  }

  const paymentDate =
    prompt(
      "請輸入收款日期：",
      new Date().toISOString().slice(0, 10)
    );

  const description =
    prompt("請輸入收款說明：") || "";

  const { error } = await supabase
    .from("payments")
    .insert({
      amount,
      payment_date: paymentDate,
      description: description.trim(),
      status: "completed",
      created_by: currentUser.id
    });

  if (error) {
    alert("新增收款失敗：\n" + friendlyError(error));
    return;
  }

  alert("收款資料新增成功。");
  await refreshAll();
}


async function addExpense() {
  if (!currentUser) {
    alert("請先登入。");
    return;
  }

  const amount = Number(
    prompt("請輸入支出金額：", "0") || 0
  );

  if (!(amount > 0)) {
    alert("金額必須大於 0。");
    return;
  }

  const expenseDate =
    prompt(
      "請輸入支出日期：",
      new Date().toISOString().slice(0, 10)
    );

  const description =
    prompt("請輸入支出說明：") || "";

  const { error } = await supabase
    .from("expenses")
    .insert({
      amount,
      expense_date: expenseDate,
      description: description.trim(),
      status: "completed",
      created_by: currentUser.id
    });

  if (error) {
    alert("新增支出失敗：\n" + friendlyError(error));
    return;
  }

  alert("支出資料新增成功。");
  await refreshAll();
}


async function addSchedule() {
  if (!currentUser) {
    alert("請先登入。");
    return;
  }

  const title =
    prompt("請輸入行程名稱：");

  if (!title?.trim()) return;

  const startAt =
    prompt(
      "請輸入開始時間：",
      new Date().toISOString().slice(0, 16)
    );

  const location =
    prompt("請輸入地點：") || "";

  const notes =
    prompt("請輸入備註：") || "";

  const { error } = await supabase
    .from("schedules")
    .insert({
      title: title.trim(),
      start_at: startAt,
      location: location.trim(),
      notes: notes.trim(),
      created_by: currentUser.id
    });

  if (error) {
    alert("新增行程失敗：\n" + friendlyError(error));
    return;
  }

  alert("行程新增成功。");
  await refreshAll();
}
function bindEvents() {
  /* 登入 */
  $("loginBtn")?.addEventListener("click", handleLogin);

  $("loginPassword")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleLogin();
    }
  });

  $("loginAccount")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      $("loginPassword")?.focus();
    }
  });

  /* 登出 */
  $("logoutBtn")?.addEventListener("click", handleLogout);

  /* 重新整理 */
  $("refreshBtn")?.addEventListener("click", async () => {
    try {
      await refreshAll();
    } catch (error) {
      alert("重新整理失敗：\n" + friendlyError(error));
    }
  });

  /* 分頁
     目前 HTML 使用 data-tab，不使用舊版 .tab
  */
  document.querySelectorAll("[data-tab]").forEach(button => {
    button.addEventListener("click", () => {
      const tab = button.dataset.tab;
      if (tab) switchTab(tab);
    });
  });

  /* 新增按鈕 */
  $("addCustomerBtn")?.addEventListener(
    "click",
    addCustomer
  );

  $("addCaseBtn")?.addEventListener(
    "click",
    addCase
  );

  $("addPaymentBtn")?.addEventListener(
    "click",
    addPayment
  );

  $("addExpenseBtn")?.addEventListener(
    "click",
    addExpense
  );

  $("addScheduleBtn")?.addEventListener(
    "click",
    addSchedule
  );
}


async function checkExistingSession() {
  try {
    const {
      data: { session },
      error
    } = await supabase.auth.getSession();

    if (error) {
      throw error;
    }

    if (!session?.user) {
      show("appView", false);
      show("loginView", true);
      return;
    }

    await enterApp(session);

  } catch (error) {
    console.error(
      "檢查登入 Session 失敗：",
      error
    );

    currentUser = null;
    currentProfile = null;

    show("appView", false);
    show("loginView", true);

    setStatus(
      "loginStatus",
      "登入狀態檢查失敗：" +
      friendlyError(error),
      true
    );
  }
}


async function initApp() {
  try {
    show("appView", false);
    show("loginView", true);

    setStatus(
      "loginStatus",
      "系統初始化中…"
    );

    await initSupabase();

    /*
      監聽 Supabase 登入狀態。
      避免 INITIAL_SESSION 與手動登入互相重複。
    */
    supabase.auth.onAuthStateChange(
      async (event, session) => {

        console.log(
          "Supabase Auth 狀態：",
          event
        );

        if (
          event === "SIGNED_OUT" ||
          !session
        ) {
          currentUser = null;
          currentProfile = null;

          show("appView", false);
          show("loginView", true);

          return;
        }

        if (
          event === "SIGNED_IN" &&
          session?.user
        ) {
          /*
            handleLogin 本身已經呼叫 enterApp。
            如果是重新整理頁面後取得 Session，
            則由 checkExistingSession 處理。
          */
          if (
            !currentUser ||
            currentUser.id !== session.user.id
          ) {
            try {
              await enterApp(session);
            } catch (error) {
              console.error(
                "Auth 狀態登入處理失敗：",
                error
              );
            }
          }
        }
      }
    );

    bindEvents();

    await checkExistingSession();

    if (!currentUser) {
      setStatus("loginStatus", "");
      $("loginAccount")?.focus();
    }

  } catch (error) {
    console.error(
      "瑞賢禮儀社系統初始化失敗：",
      error
    );

    show("appView", false);
    show("loginView", true);

    setStatus(
      "loginStatus",
      "系統初始化失敗：" +
      friendlyError(error),
      true
    );
  }
}


/*
  等待 HTML 完整載入後才啟動。
*/
if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initApp,
    { once: true }
  );
} else {
  initApp();
}
