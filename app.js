/* 瑞賢禮儀社 PWA - 完整修正版 app.js */
"use strict";

const SUPABASE_URL = "https://zjetemcqysvpbnyvpyma.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_jdeKO7PxDMGjAg_qCFw5FA_wr5OJcei";

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
  return error.message || error.error_description || error.code || JSON.stringify(error);
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

if (!window.supabase || !window.supabase.createClient) {
  setStatus("loginStatus", "系統初始化失敗：Supabase 尚未載入，請重新整理頁面。", true);
  throw new Error("Supabase SDK 未載入");
}

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

let currentUser = null;
let currentProfile = null;
let customers = [], cases = [], payments = [], expenses = [], schedules = [];
let loginInProgress = false;
let enteringApp = false;

function roleText(role) {
  return ({ owner: "負責人", manager: "主管", counselor: "禮儀師", accounting: "會計", staff: "一般員工" })[role] || role || "員工";
}

async function loadProfile(userId) {
  const { data, error } = await supabase.from("staff_profiles")
    .select("user_id,name,email,role,active,created_at")
    .eq("user_id", userId).maybeSingle();
  if (error) throw new Error("員工資料讀取失敗：" + friendlyError(error));
  if (!data) throw new Error("登入成功，但找不到對應的員工資料。請確認 staff_profiles 已建立此帳號。");
  if (!data.active) throw new Error("這個員工帳號目前已停用。");
  return data;
}

async function enterApp(session) {
  if (enteringApp) return;
  if (!session?.user) throw new Error("沒有取得有效的登入工作階段。");
  enteringApp = true;
  try {
    currentUser = session.user;
    currentProfile = await loadProfile(currentUser.id);
    const userInfo = $("userInfo");
    if (userInfo) userInfo.textContent = `${currentProfile.name}｜${roleText(currentProfile.role)}｜${currentProfile.email}`;
    show("loginView", false);
    show("mainView", true);
    setStatus("loginStatus", "");
    try { await refreshAll(); }
    catch (error) {
      console.error("資料載入失敗：", error);
      setStatus("dashboardStatus", "登入成功，但部分雲端資料無法讀取：" + friendlyError(error), true);
    }
    switchTab("dashboard");
  } catch (error) {
    console.error("進入系統失敗：", error);
    currentUser = null; currentProfile = null;
    show("mainView", false); show("loginView", true);
    setStatus("loginStatus", "登入失敗：" + friendlyError(error), true);
  } finally { enteringApp = false; }
}

async function refreshAll() {
  const results = await Promise.all([
    supabase.from("customers").select("*").order("created_at", { ascending: false }),
    supabase.from("funeral_cases").select("*").order("created_at", { ascending: false }),
    supabase.from("payments").select("*").order("payment_date", { ascending: false }),
    supabase.from("expenses").select("*").order("expense_date", { ascending: false }),
    supabase.from("schedules").select("*").order("start_at", { ascending: true })
  ]);
  const names = ["customers", "funeral_cases", "payments", "expenses", "schedules"];
  for (let i = 0; i < results.length; i++) if (results[i].error) throw new Error(`${names[i]} 讀取失敗：${friendlyError(results[i].error)}`);
  customers = results[0].data || []; cases = results[1].data || []; payments = results[2].data || []; expenses = results[3].data || []; schedules = results[4].data || [];
  render();
}

function render() {
  if ($("customerCount")) $("customerCount").textContent = customers.length;
  if ($("caseCount")) $("caseCount").textContent = cases.length;
  if ($("pendingFinanceCount")) $("pendingFinanceCount").textContent = payments.filter(x => x.status === "pending").length + expenses.filter(x => x.status === "pending").length;

  if ($("customerList")) $("customerList").innerHTML = customers.map(x => `<div class="item"><div class="item-title">${esc(x.name)}</div><div class="item-meta">電話：${esc(x.phone)}<br>地址：${esc(x.address)}<br>關係：${esc(x.relation)}<br>備註：${esc(x.notes)}</div></div>`).join("") || '<div class="item muted">目前沒有客戶資料</div>';
  if ($("caseList")) {
    $("caseList").innerHTML = cases.map(x => `<div class="item case-item" data-case-id="${esc(x.id)}" style="cursor:pointer"><div class="item-title">${esc(x.case_number)}｜${esc(x.deceased_name)}</div><div class="item-meta">案件日期：${esc(x.case_date || "")}<br>狀態：${esc(x.status)}<br>性別：${esc(x.deceased_gender || "")}<br>出生：${esc(x.birth_calendar || "")} ${x.birth_roc_year ? `民國 ${esc(x.birth_roc_year)} 年` : ""}${x.birth_month ? `${esc(x.birth_month)} 月` : ""}${x.birth_day ? `${esc(x.birth_day)} 日` : ""}<br>死亡：${esc(x.death_calendar || "")} ${x.death_roc_year ? `民國 ${esc(x.death_roc_year)} 年` : ""}${x.death_month ? `${esc(x.death_month)} 月` : ""}${x.death_day ? `${esc(x.death_day)} 日` : ""}<br>契約金額：${Number(x.contract_amount || 0).toLocaleString()} 元<br>備註：${esc(x.notes)}</div><div style="margin-top:8px;font-size:13px;color:#2563eb">點擊查看／編輯案件</div></div>`).join("") || '<div class="item muted">目前沒有案件資料</div>';
    document.querySelectorAll(".case-item").forEach(item => item.addEventListener("click", () => openCaseEditor(item.dataset.caseId)));
  }
  if ($("paymentList")) $("paymentList").innerHTML = payments.map(x => `<div class="item"><div class="item-title">付款 ${Number(x.amount || 0).toLocaleString()} 元</div><div class="item-meta">日期：${esc(x.payment_date)}｜狀態：${esc(x.status)}<br>${esc(x.description)}</div></div>`).join("") || '<div class="item muted">目前沒有付款</div>';
  if ($("expenseList")) $("expenseList").innerHTML = expenses.map(x => `<div class="item"><div class="item-title">支出 ${Number(x.amount || 0).toLocaleString()} 元</div><div class="item-meta">日期：${esc(x.expense_date)}｜狀態：${esc(x.status)}<br>${esc(x.description)}</div></div>`).join("") || '<div class="item muted">目前沒有支出</div>';
  if ($("scheduleList")) $("scheduleList").innerHTML = schedules.map(x => `<div class="item"><div class="item-title">${esc(x.title)}</div><div class="item-meta">${esc(x.start_at)}｜${esc(x.location)}<br>${esc(x.notes)}</div></div>`).join("") || '<div class="item muted">目前沒有行程</div>';
}

function switchTab(tab) {
  document.querySelectorAll(".tab").forEach(button => button.classList.toggle("active", button.dataset.tab === tab));
  ["dashboard", "customers", "cases", "finance", "schedules", "staff"].forEach(id => show(id, id === tab));
  if (tab === "staff") loadStaff();
}

async function loadStaff() {
  if (!currentProfile || !["owner", "manager"].includes(currentProfile.role)) {
    if ($("staffList")) $("staffList").innerHTML = '<div class="item">目前帳號沒有查看員工名單的權限。</div>';
    return;
  }
  const { data, error } = await supabase.from("staff_profiles").select("name,email,role,active,created_at").order("created_at", { ascending: false });
  if (error) { if ($("staffList")) $("staffList").innerHTML = `<div class="item danger">${esc(friendlyError(error))}</div>`; return; }
  if ($("staffList")) $("staffList").innerHTML = (data || []).map(x => `<div class="item"><div class="item-title">${esc(x.name)}｜${esc(roleText(x.role))}</div><div class="item-meta">${esc(x.email)}｜${x.active ? "啟用" : "停用"}</div></div>`).join("") || '<div class="item muted">目前沒有員工資料</div>';
}

async function handleLogin() {
  if (loginInProgress) return;
  const email = $("email")?.value.trim() || "";
  const password = $("password")?.value || "";
  setStatus("loginStatus", "");
  if (!email) return setStatus("loginStatus", "請輸入電子郵件。", true);
  if (!password) return setStatus("loginStatus", "請輸入密碼。", true);
  loginInProgress = true;
  const button = $("loginBtn");
  if (button) { button.disabled = true; button.textContent = "登入中…"; }
  setStatus("loginStatus", "正在連線驗證帳號…");
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data?.session) throw new Error("帳號驗證成功，但沒有取得登入 Session。");
    setStatus("loginStatus", "帳號驗證成功，正在進入系統…");
    await enterApp(data.session);
  } catch (error) {
    console.error("登入錯誤：", error);
    setStatus("loginStatus", "登入失敗：" + friendlyError(error), true);
  } finally {
    loginInProgress = false;
    if (button) { button.disabled = false; button.textContent = "登入"; }
  }
}

async function handleLogout() {
  try { await supabase.auth.signOut(); } catch (error) { console.error("登出失敗：", error); }
  currentUser = null; currentProfile = null; show("mainView", false); show("loginView", true);
}

async function addCustomer() {
  if (!currentUser) return alert("請先登入。");
  const name = prompt("客戶姓名"); if (!name) return;
  const phone = prompt("電話（可留空）") || "";
  const address = prompt("地址（可留空）") || "";
  const relation = prompt("與亡者關係（可留空）") || "";
  const notes = prompt("備註（可留空）") || "";
  const { error } = await supabase.from("customers").insert({ name, phone, address, relation, notes, created_by: currentUser.id });
  if (error) return alert("新增客戶失敗：" + friendlyError(error));
  await refreshAll();
}

const FAMILY_RELATIONS = ["配偶","父親","母親","兒子","女兒","兄弟","姊妹","祖父","祖母","孫子","孫女","外孫","外孫女","其他"];

function caseCalendarOptions(selected) {
  return `<option value="國曆" ${selected === "國曆" ? "selected" : ""}>國曆</option><option value="農曆" ${selected === "農曆" ? "selected" : ""}>農曆</option>`;
}

function createFamilyRow(data = {}) {
  const row=document.createElement("div"); row.className="family-row";
  row.style.cssText="border:1px solid #ddd;border-radius:10px;padding:12px;margin-bottom:10px;background:#fafafa";
  row.innerHTML=`<div style="display:grid;gap:8px"><input class="familyName" placeholder="家屬姓名" value="${esc(data.family_name||"")}"><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><input class="familyYear" type="number" min="1" max="200" placeholder="出生民國年" value="${esc(data.birth_roc_year||"")}"><select class="familyRelation"><option value="">請選擇關係</option>${FAMILY_RELATIONS.map(r=>`<option value="${esc(r)}" ${data.relationship===r?"selected":""}>${esc(r)}</option>`).join("")}</select></div><input class="familyPhone" placeholder="電話" value="${esc(data.phone||"")}"><input class="familyAddress" placeholder="地址" value="${esc(data.address||"")}"><textarea class="familyNote" rows="2" placeholder="備註">${esc(data.notes||"")}</textarea><button type="button" class="removeFamilyBtn">刪除這位家屬</button></div>`;
  row.querySelector(".removeFamilyBtn").style.cssText="background:#dc2626;color:white;border:0;padding:8px;border-radius:8px";
  row.querySelector(".removeFamilyBtn").onclick=()=>row.remove(); return row;
}

async function loadCaseFamilyMembers(caseId) {
  const {data,error}=await supabase.from("case_family_members").select("*").eq("case_id",caseId).order("created_at",{ascending:true});
  if(error) throw new Error("家屬資料讀取失敗："+friendlyError(error)); return data||[];
}

async function saveCaseFamilyMembers(caseId, container) {
  const {error:de}=await supabase.from("case_family_members").delete().eq("case_id",caseId);
  if(de) throw new Error("舊家屬資料清除失敗："+friendlyError(de));
  const members=[...container.querySelectorAll(".family-row")].map(row=>({case_id:caseId,family_name:row.querySelector(".familyName")?.value.trim()||"",birth_roc_year:Number(row.querySelector(".familyYear")?.value||0)||null,relationship:row.querySelector(".familyRelation")?.value||null,phone:row.querySelector(".familyPhone")?.value.trim()||"",address:row.querySelector(".familyAddress")?.value.trim()||"",notes:row.querySelector(".familyNote")?.value.trim()||"",created_by:currentUser.id})).filter(x=>x.family_name);
  if(!members.length)return; const {error}=await supabase.from("case_family_members").insert(members); if(error)throw new Error("家屬資料儲存失敗："+friendlyError(error));
}

async function openCaseEditor(caseId="", customerId="") {
  if(!currentUser)return alert("請先登入。");
  let existingCase=null, family=[];
  if(caseId){existingCase=cases.find(x=>x.id===caseId);if(!existingCase)return alert("找不到這筆案件資料。");try{family=await loadCaseFamilyMembers(caseId)}catch(e){return alert(e.message)}}
  const modal=document.createElement("div"); modal.style.cssText="position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);overflow:auto;padding:20px";
  modal.innerHTML=`<div style="max-width:720px;margin:20px auto;background:#fff;border-radius:16px;padding:20px;box-shadow:0 10px 40px rgba(0,0,0,.25)"><h2>${caseId?"編輯案件":"新增案件"}</h2><div style="display:grid;gap:12px">
<label>案件編號<input id="ceNo" style="width:100%" value="${esc(existingCase?.case_number||"")}"></label>
<label>案件日期<input id="ceDate" type="date" style="width:100%" value="${esc(existingCase?.case_date||"")}"></label>
<label>委託客戶<select id="ceCustomer" style="width:100%"><option value="">請選擇客戶</option>${customers.map(c=>`<option value="${esc(c.id)}" ${(existingCase?.customer_id||customerId)===c.id?"selected":""}>${esc(c.name)}</option>`).join("")}</select></label>
<label>亡者姓名<input id="ceName" style="width:100%" value="${esc(existingCase?.deceased_name||"")}"></label>
<label>亡者性別<select id="ceGender" style="width:100%"><option value="">請選擇</option><option value="男" ${existingCase?.deceased_gender==="男"?"selected":""}>男</option><option value="女" ${existingCase?.deceased_gender==="女"?"selected":""}>女</option><option value="其他" ${existingCase?.deceased_gender==="其他"?"selected":""}>其他</option></select></label>
<div style="border:1px solid #ddd;border-radius:10px;padding:12px"><b>亡者出生日期</b><div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-top:8px"><select id="ceBC">${caseCalendarOptions(existingCase?.birth_calendar||"國曆")}</select><input id="ceBY" type="number" min="1" max="200" placeholder="民國年" value="${esc(existingCase?.birth_roc_year||"")}"><input id="ceBM" type="number" min="1" max="12" placeholder="月" value="${esc(existingCase?.birth_month||"")}"><input id="ceBD" type="number" min="1" max="31" placeholder="日" value="${esc(existingCase?.birth_day||"")}"></div></div>
<div style="border:1px solid #ddd;border-radius:10px;padding:12px"><b>亡者死亡日期</b><div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-top:8px"><select id="ceDC">${caseCalendarOptions(existingCase?.death_calendar||"國曆")}</select><input id="ceDY" type="number" min="1" max="200" placeholder="民國年" value="${esc(existingCase?.death_roc_year||"")}"><input id="ceDM" type="number" min="1" max="12" placeholder="月" value="${esc(existingCase?.death_month||"")}"><input id="ceDD" type="number" min="1" max="31" placeholder="日" value="${esc(existingCase?.death_day||"")}"></div></div>
<label>案件狀態<select id="ceStatus" style="width:100%"><option value="pending" ${existingCase?.status==="pending"?"selected":""}>處理中</option><option value="active" ${existingCase?.status==="active"?"selected":""}>進行中</option><option value="completed" ${existingCase?.status==="completed"?"selected":""}>已完成</option><option value="cancelled" ${existingCase?.status==="cancelled"?"selected":""}>已取消</option></select></label>
<label>契約金額<input id="ceAmount" type="number" min="0" style="width:100%" value="${esc(existingCase?.contract_amount||0)}"></label>
<div style="border:1px solid #ddd;border-radius:10px;padding:12px"><div style="display:flex;justify-content:space-between;align-items:center"><b>家屬資料</b><button type="button" id="ceAddFamily">＋新增家屬</button></div><div id="ceFamily" style="margin-top:12px"></div></div>
<label>案件備註<textarea id="ceNotes" rows="4" style="width:100%">${esc(existingCase?.notes||"")}</textarea></label>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><button type="button" id="ceCancel">取消</button><button type="button" id="ceSave">${caseId?"儲存修改":"新增案件"}</button></div><div id="ceStatusMsg"></div></div></div>`;
  document.body.appendChild(modal);
  const box=modal.querySelector("#ceFamily"); family.forEach(x=>box.appendChild(createFamilyRow(x)));
  modal.querySelector("#ceAddFamily").onclick=()=>box.appendChild(createFamilyRow());
  modal.querySelector("#ceCancel").onclick=()=>modal.remove();
  modal.querySelector("#ceSave").onclick=async()=>{
    const msg=modal.querySelector("#ceStatusMsg"), btn=modal.querySelector("#ceSave");
    const case_number=modal.querySelector("#ceNo").value.trim(), deceased_name=modal.querySelector("#ceName").value.trim();
    if(!case_number)return msg.textContent="請輸入案件編號。"; if(!deceased_name)return msg.textContent="請輸入亡者姓名。";
    btn.disabled=true;btn.textContent="儲存中…";
    try{
      const payload={case_number,customer_id:modal.querySelector("#ceCustomer").value||null,deceased_name,status:modal.querySelector("#ceStatus").value,contract_amount:Number(modal.querySelector("#ceAmount").value||0),notes:modal.querySelector("#ceNotes").value.trim(),case_date:modal.querySelector("#ceDate").value||null,deceased_gender:modal.querySelector("#ceGender").value||null,birth_calendar:modal.querySelector("#ceBC").value||null,birth_roc_year:Number(modal.querySelector("#ceBY").value||0)||null,birth_month:Number(modal.querySelector("#ceBM").value||0)||null,birth_day:Number(modal.querySelector("#ceBD").value||0)||null,death_calendar:modal.querySelector("#ceDC").value||null,death_roc_year:Number(modal.querySelector("#ceDY").value||0)||null,death_month:Number(modal.querySelector("#ceDM").value||0)||null,death_day:Number(modal.querySelector("#ceDD").value||0)||null};
      let id=caseId;
      if(caseId){const {error}=await supabase.from("funeral_cases").update(payload).eq("id",caseId);if(error)throw error}else{payload.created_by=currentUser.id;const {data,error}=await supabase.from("funeral_cases").insert(payload).select("id").single();if(error)throw error;id=data.id}
      await saveCaseFamilyMembers(id,box); await refreshAll(); modal.remove();
    }catch(e){msg.textContent="儲存失敗："+friendlyError(e);msg.style.color="#b91c1c";btn.disabled=false;btn.textContent=caseId?"儲存修改":"新增案件"}
  };
}

async function addCase(){await openCaseEditor();}

async function addPayment() {
  if (!currentUser) return alert("請先登入。");
  if (!cases.length) return alert("請先新增案件。");
  const amount = Number(prompt("付款金額") || 0); if (!amount) return;
  const description = prompt("付款說明") || "";
  const { error } = await supabase.from("payments").insert({ case_id: cases[0].id, amount, payment_date: new Date().toISOString().slice(0, 10), description, status: "pending", created_by: currentUser.id });
  if (error) return alert("新增付款失敗：" + friendlyError(error));
  await refreshAll();
}

async function addExpense() {
  if (!currentUser) return alert("請先登入。");
  if (!cases.length) return alert("請先新增案件。");
  const amount = Number(prompt("支出金額") || 0); if (!amount) return;
  const description = prompt("支出說明") || "";
  const { error } = await supabase.from("expenses").insert({ case_id: cases[0].id, amount, expense_date: new Date().toISOString().slice(0, 10), description, status: "pending", created_by: currentUser.id });
  if (error) return alert("新增支出失敗：" + friendlyError(error));
  await refreshAll();
}

async function addSchedule() {
  if (!currentUser) return alert("請先登入。");
  if (!cases.length) return alert("請先新增案件。");
  const title = prompt("行程名稱"); if (!title) return;
  const start_at = prompt("日期時間，例如 2026-09-30 10:00"); if (!start_at) return;
  const location = prompt("地點") || "";
  const notes = prompt("備註") || "";
  const { error } = await supabase.from("schedules").insert({ case_id: cases[0].id, title, start_at, location, notes, created_by: currentUser.id });
  if (error) return alert("新增行程失敗：" + friendlyError(error));
  await refreshAll();
}

function bindEvents() {
  $("loginBtn")?.addEventListener("click", handleLogin);
  $("password")?.addEventListener("keydown", event => { if (event.key === "Enter") handleLogin(); });
  $("logoutBtn")?.addEventListener("click", handleLogout);
  $("refreshBtn")?.addEventListener("click", async () => { try { await refreshAll(); setStatus("dashboardStatus", "雲端資料已更新。"); } catch (error) { setStatus("dashboardStatus", friendlyError(error), true); } });
  document.querySelectorAll(".tab").forEach(button => button.addEventListener("click", () => switchTab(button.dataset.tab)));
  $("addCustomerBtn")?.addEventListener("click", addCustomer);
  $("addCaseBtn")?.addEventListener("click", addCase);
  $("addPaymentBtn")?.addEventListener("click", addPayment);
  $("addExpenseBtn")?.addEventListener("click", addExpense);
  $("addScheduleBtn")?.addEventListener("click", addSchedule);
}

supabase.auth.onAuthStateChange((event) => {
  console.log("Auth event:", event);
  if (event === "SIGNED_OUT") {
    currentUser = null; currentProfile = null; show("mainView", false); show("loginView", true);
  }
});

async function initializeApp() {
  console.log("瑞賢禮儀社 PWA 啟動");
  bindEvents();
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (data?.session && !currentUser) await enterApp(data.session);
    else { show("mainView", false); show("loginView", true); }
  } catch (error) {
    console.error("初始化失敗：", error);
    show("mainView", false); show("loginView", true);
    setStatus("loginStatus", "系統初始化失敗：" + friendlyError(error), true);
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initializeApp);
else initializeApp();
