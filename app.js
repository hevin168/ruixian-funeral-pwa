/* 瑞賢禮儀社 PWA - 完整修正版 app.js */

"use strict";

const SUPABASE_URL = "https://zjetemcqysvpbnyvpyma.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_jdeKO7PxDMGjAg_qCFw5FA_wr5OJcei";

const $ = (id) => document.getElementById(id);

function show(id, visible) {
  const el = $(id);
  if (el) el.hidden = !visible;
}

function setStatus(id, message, error = false) {
  const el = $(id);
  if (!el) return;

  el.textContent = message || "";
  el.style.color = error ? "#b91c1c" : "#b45309";
}

function friendlyError(error) {
  if (!error) return "未知錯誤";

  return (
    error.message ||
    error.error_description ||
    error.code ||
    JSON.stringify(error)
  );
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c];
  });
}

if (!window.supabase || !window.supabase.createClient) {
  setStatus(
    "loginStatus",
    "系統初始化失敗：Supabase 尚未載入，請重新整理頁面。",
    true
  );

  throw new Error("Supabase SDK 未載入");
}

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

let currentUser = null;
let currentProfile = null;

let customers = [];
let cases = [];
let payments = [];
let expenses = [];
let schedules = [];

let loginInProgress = false;
let enteringApp = false;

function roleText(role) {
  return (
    {
      owner: "負責人",
      manager: "主管",
      counselor: "禮儀師",
      accounting: "會計",
      staff: "一般員工",
    }[role] ||
    role ||
    "員工"
  );
}

/* =========================
   讀取員工資料
========================= */

async function loadProfile(userId) {
  const { data, error } = await supabase
    .from("staff_profiles")
    .select("user_id,name,email,role,active,created_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(
      "員工資料讀取失敗：" + friendlyError(error)
    );
  }

  if (!data) {
    throw new Error(
      "登入成功，但找不到對應的員工資料。請確認此帳號已建立 staff_profiles 資料。"
    );
  }

  if (!data.active) {
    throw new Error("這個員工帳號目前已停用。");
  }

  return data;
}

/* =========================
   進入主系統
========================= */

async function enterApp(session) {
  if (enteringApp) return;

  if (!session || !session.user) {
    throw new Error("沒有取得有效的登入工作階段。");
  }

  enteringApp = true;

  try {
    currentUser = session.user;

    currentProfile = await loadProfile(currentUser.id);

    const userInfo = $("userInfo");

    if (userInfo) {
      userInfo.textContent =
        `${currentProfile.name}｜` +
        `${roleText(currentProfile.role)}｜` +
        `${currentProfile.email}`;
    }

    show("loginView", false);
    show("mainView", true);

    setStatus("loginStatus", "");

    /*
      即使資料表有問題，
      也不要把已經成功登入的使用者踢回登入頁。
    */

    try {
      await refreshAll();
    } catch (error) {
      console.error("資料載入失敗：", error);

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

    show("mainView", false);
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

/* =========================
   重新讀取所有資料
========================= */

async function refreshAll() {
  const results = await Promise.all([
    supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false }),

    supabase
      .from("funeral_cases")
      .select("*")
      .order("created_at", { ascending: false }),

    supabase
      .from("payments")
      .select("*")
      .order("payment_date", { ascending: false }),

    supabase
      .from("expenses")
      .select("*")
      .order("expense_date", { ascending: false }),

    supabase
      .from("schedules")
      .select("*")
      .order("start_at", { ascending: true }),
  ]);

  const names = [
    "customers",
    "funeral_cases",
    "payments",
    "expenses",
    "schedules",
  ];

  for (let i = 0; i < results.length; i++) {
    if (results[i].error) {
      throw new Error(
        `${names[i]} 讀取失敗：` +
          friendlyError(results[i].error)
      );
    }
  }

  customers = results[0].data || [];
  cases = results[1].data || [];
  payments = results[2].data || [];
  expenses = results[3].data || [];
  schedules = results[4].data || [];

  render();
}

/* =========================
   畫面資料
========================= */

function render() {
  if ($("customerCount")) {
    $("customerCount").textContent = customers.length;
  }

  if ($("caseCount")) {
    $("caseCount").textContent = cases.length;
  }

  if ($("pendingFinanceCount")) {
    const pending =
      payments.filter((x) => x.status === "pending").length +
      expenses.filter((x) => x.status === "pending").length;

    $("pendingFinanceCount").textContent = pending;
  }

  /* 客戶 */

  if ($("customerList")) {
    $("customerList").innerHTML =
      customers
        .map(
          (x) => `
        <div class="item">
          <div class="item-title">
            ${esc(x.name)}
          </div>

          <div class="item-meta">
            電話：${esc(x.phone)}<br>
            地址：${esc(x.address)}<br>
            關係：${esc(x.relation)}<br>
            備註：${esc(x.notes)}
          </div>
        </div>
      `
        )
        .join("") ||
      '<div class="item muted">目前沒有客戶資料</div>';
  }

  /* 案件 */

  if ($("caseList")) {
    $("caseList").innerHTML =
      cases
        .map(
          (x) => `
        <div class="item">

          <div class="item-title">
            ${esc(x.case_number)}｜
            ${esc(x.deceased_name)}
          </div>

          <div class="item-meta">
            狀態：${esc(x.status)}<br>
            契約金額：
            ${Number(
              x.contract_amount || 0
            ).toLocaleString()} 元<br>
            備註：${esc(x.notes)}
          </div>

        </div>
      `
        )
        .join("") ||
      '<div class="item muted">目前沒有案件資料</div>';
  }

  /* 收款 */

  if ($("paymentList")) {
    $("paymentList").innerHTML =
      payments
        .map(
          (x) => `
        <div class="item">

          <div class="item-title">
            付款
            ${Number(
              x.amount || 0
            ).toLocaleString()} 元
          </div>

          <div class="item-meta">
            日期：${esc(x.payment_date)}｜
            狀態：${esc(x.status)}<br>
            ${esc(x.description)}
          </div>

        </div>
      `
        )
        .join("") ||
      '<div class="item muted">目前沒有付款</div>';
  }

  /* 支出 */

  if ($("expenseList")) {
    $("expenseList").innerHTML =
      expenses
        .map(
          (x) => `
        <div class="item">

          <div class="item-title">
            支出
            ${Number(
              x.amount || 0
            ).toLocaleString()} 元
          </div>

          <div class="item-meta">
            日期：${esc(x.expense_date)}｜
            狀態：${esc(x.status)}<br>
            ${esc(x.description)}
          </div>

        </div>
      `
        )
        .join("") ||
      '<div class="item muted">目前沒有支出</div>';
  }

  /* 行程 */

  if ($("scheduleList")) {
    $("scheduleList").innerHTML =
      schedules
        .map(
          (x) => `
        <div class="item">

          <div class="item-title">
            ${esc(x.title)}
          </div>

          <div class="item-meta">
            ${esc(x.start_at)}｜
            ${esc(x.location)}<br>
            ${esc(x.notes)}
          </div>

        </div>
      `
        )
        .join("") ||
      '<div class="item muted">目前沒有行程</div>';
  }
}

/* =========================
   分頁
========================= */

function switchTab(tab) {
  document.querySelectorAll(".tab").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.tab === tab
    );
  });

  [
    "dashboard",
    "customers",
    "cases",
    "finance",
    "schedules",
    "staff",
  ].forEach((id) => {
    show(id, id === tab);
  });

  if (tab === "staff") {
    loadStaff();
  }
}

/* =========================
   員工
========================= */

async function loadStaff() {
  if (
    !currentProfile ||
    !["owner", "manager"].includes(
      currentProfile.role
    )
  ) {
    if ($("staffList")) {
      $("staffList").innerHTML =
        '<div class="item">目前帳號沒有查看員工名單的權限。</div>';
    }

    return;
  }

  const { data, error } = await supabase
    .from("staff_profiles")
    .select(
      "name,email,role,active,created_at"
    )
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    $("staffList").innerHTML =
      `<div class="item danger">
        ${esc(friendlyError(error))}
      </div>`;

    return;
  }

  $("staffList").innerHTML =
    (data || [])
      .map(
        (x) => `
      <div class="item">

        <div class="item-title">
          ${esc(x.name)}｜
          ${esc(roleText(x.role))}
        </div>

        <div class="item-meta">
          ${esc(x.email)}｜
          ${x.active ? "啟用" : "停用"}
        </div>

      </div>
    `
      )
      .join("") ||
    '<div class="item muted">目前沒有員工資料</div>';
}

/* =========================
   登入
========================= */

async function handleLogin() {
  if (loginInProgress) return;

  const email =
    $("email")?.value.trim() || "";

  const password =
    $("password")?.value || "";

  setStatus("loginStatus", "");

  if (!email) {
    setStatus(
      "loginStatus",
      "請輸入電子郵件。",
      true
    );

    return;
  }

  if (!password) {
    setStatus(
      "loginStatus",
      "請輸入密碼。",
      true
    );

    return;
  }

  loginInProgress = true;

  const button = $("loginBtn");

  if (button) {
    button.disabled = true;
    button.textContent = "登入中…";
  }

  setStatus(
    "loginStatus",
    "正在連線驗證帳號…"
  );

  try {
    const { data, error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (error) {
      throw error;
    }

    if (!data || !data.session) {
      throw new Error(
        "帳號驗證成功，但沒有取得登入 Session。"
      );
    }

    setStatus(
      "loginStatus",
      "帳號驗證成功，正在進入系統…"
    );

    await enterApp(data.session);
  } catch (error) {
    console.error("登入錯誤：", error);

    setStatus(
      "loginStatus",
      "登入失敗：" +
        friendlyError(error),
      true
    );
  } finally {
    loginInProgress = false;

    if (button) {
      button.disabled = false;
      button.textContent = "登入";
    }
  }
}

/* =========================
   登出
========================= */

async function handleLogout() {
  try {
    await supabase.auth.signOut();
  } catch (error) {
    console.error(
      "登出失敗：",
      error
    );
  }

  currentUser = null;
  currentProfile = null;

  show("mainView", false);
  show("loginView", true);
}

/* =========================
   新增客戶
========================= */

async function addCustomer() {
  if (!currentUser) {
    alert("請先登入。");
    return;
  }

  const name = prompt("客戶姓名");

  if (!name) return;

  const phone =
    prompt("電話（可留空）") || "";

  const address =
    prompt("地址（可留空）") || "";

  const relation =
    prompt("與亡者關係（可留空）") || "";

  const notes =
    prompt("備註（可留空）") || "";

  const { error } =
    await supabase
      .from("customers")
      .insert({
        name,
        phone,
        address,
        relation,
        notes,
        created_by: currentUser.id,
      });

  if (error) {
    alert(
      "新增客戶失敗：" +
        friendlyError(error)
    );

    return;
  }

  await refreshAll();
}

/* =========================
   新增案件
========================= */

async function addCase() {
  if (!currentUser) {
    alert("請先登入。");
    return;
  }

  if (!customers.length) {
    alert("請先新增客戶。");
    return;
  }

  const customer = customers[0];

  const deceased_name =
    prompt("亡者姓名");

  if (!deceased_name) return;

  const case_number =
    prompt("案件編號");

  if (!case_number) return;

  const contract_amount = Number(
    prompt("契約金額（數字）") || 0
  );

  const { error } =
    await supabase
      .from("funeral_cases")
      .insert({
        case_number,
        customer_id: customer.id,
        deceased_name,
        status: "pending",
        contract_amount,
        notes: "",
        created_by: currentUser.id,
      });

  if (error) {
    alert(
      "新增案件失敗：" +
        friendlyError(error)
    );

    return;
  }

  await refreshAll();
}

/* =========================
   新增付款
========================= */

async function addPayment() {
  if (!currentUser) {
    alert("請先登入。");
    return;
  }

  if (!cases.length) {
    alert("請先新增案件。");
    return;
  }

  const amount = Number(
    prompt("付款金額") || 0
  );

  if (!amount) return;

  const description =
    prompt("付款說明") || "";

  const { error } =
    await supabase
      .from("payments")
      .insert({
        case_id: cases[0].id,
        amount,
        payment_date:
          new Date()
            .toISOString()
            .slice(0, 10),
        description,
        status: "pending",
        created_by: currentUser.id,
      });

  if (error) {
    alert(
      "新增付款失敗：" +
        friendlyError(error)
    );

    return;
  }

  await refreshAll();
}

/* =========================
   新增支出
========================= */

async function addExpense() {
  if (!currentUser) {
    alert("請先登入。");
    return;
  }

  if (!cases.length) {
    alert("請先新增案件。");
    return;
  }

  const amount = Number(
    prompt("支出金額") || 0
  );

  if (!amount) return;

  const description =
    prompt("支出說明") || "";

  const { error } =
    await supabase
      .from("expenses")
      .insert({
        case_id: cases[0].id,
        amount,
        expense_date:
          new Date()
            .toISOString()
            .slice(0, 10),
        description,
        status: "pending",
        created_by: currentUser.id,
      });

  if (error) {
    alert(
      "新增支出失敗：" +
        friendlyError(error)
    );

    return;
  }

  await refreshAll();
}

/* =========================
   新增行程
========================= */

async function addSchedule() {
  if (!currentUser) {
    alert("請先登入。");
    return;
  }

  if (!cases.length) {
    alert("請先新增案件。");
    return;
  }

  const title =
    prompt("行程名稱");

  if (!title) return;

  const start_at =
    prompt(
      "日期時間，例如 2026-09-30 10:00"
    );

  if (!start_at) return;

  const location =
    prompt("地點") || "";

  const notes =
    prompt("備註") || "";

  const { error } =
    await supabase
      .from("schedules")
      .insert({
        case_id: cases[0].id,
        title,
        start_at,
        location,
        notes,
        created_by: currentUser.id,
      });

  if (error) {
    alert(
      "新增行程失敗：" +
        friendlyError(error)
    );

    return;
  }

  await refreshAll();
}

/* =========================
   綁定按鈕
========================= */

function bindEvents() {
  $("loginBtn")?.addEventListener(
    "click",
    handleLogin
  );

  $("password")?.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Enter") {
        handleLogin();
      }
    }
  );

  $("logoutBtn")?.addEventListener(
    "click",
    handleLogout
  );

  $("refreshBtn")?.addEventListener(
    "click",
    async () => {
      try {
        await refreshAll();

        setStatus(
          "dashboardStatus",
          "雲端資料已更新。"
        );
      } catch (error) {
        setStatus(
          "dashboardStatus",
          friendlyError(error),
          true
        );
      }
    }
  );

  document
    .querySelectorAll(".tab")
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          switchTab(
            button.dataset.tab
          );
        }
      );
    });

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

/* =========================
   Supabase 登入狀態
========================= */

supabase.auth.onAuthStateChange(
  (event, session) => {
    console.log(
      "Auth event:",
      event,
      !!session
    );

    if (event === "SIGNED_OUT") {
      currentUser = null;
      currentProfile = null;

      show("mainView", false);
      show("loginView", true);
    }
  }
);

/* =========================
   啟動
========================= */

async function initializeApp() {
  console.log(
    "瑞賢禮儀社 PWA 啟動"
  );

  bindEvents();

  try {
    const {
      data,
      error,
    } = await supabase.auth.getSession();

    if (error) {
      throw error;
    }

    if (
      data?.session &&
      !currentUser
    ) {
      await enterApp(
        data.session
      );
    } else {
      show("mainView", false);
      show("loginView", true);
    }
  } catch (error) {
    console.error(
      "初始化失敗：",
      error
    );

    show("mainView", false);
    show("loginView", true);

    setStatus(
      "loginStatus",
      "系統初始化失敗：" +
        friendlyError(error),
      true
    );
  }
}

if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    initializeApp
  );
} else {
  initializeApp();
}
