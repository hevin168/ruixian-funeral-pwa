const SUPABASE_URL = "https://zjetemcqysvpbnyvpyma.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_jdeKO7PxDMGjAg_qCFw5FA_wr5OJcei";

const { createClient } = window.supabase;
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

let currentUser = null;
let currentProfile = null;
let customers = [];
let cases = [];
let payments = [];
let expenses = [];
let schedules = [];
let booting = false;

const $ = id => document.getElementById(id);
const show = (id, yes) => $(id).hidden = !yes;
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function status(el, msg, error=false) {
  el.textContent = msg || "";
  el.style.color = error ? "#b91c1c" : "#b45309";
}

function friendlyError(error) {
  if (!error) return "未知錯誤";
  return error.message || error.error_description || error.code || JSON.stringify(error);
}

async function loadProfile(userId) {
  const { data, error } = await supabase
    .from("staff_profiles")
    .select("user_id,name,email,role,active,created_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`員工資料讀取失敗：${friendlyError(error)}`);
  if (!data) throw new Error("登入帳號已驗證，但找不到 staff_profiles 員工資料。請確認這個帳號已有「負責人」員工資料。");
  if (!data.active) throw new Error("這個員工帳號目前已停用，無法進入系統。");
  return data;
}

async function enterApp(session) {
  if (booting) return;
  booting = true;
  try {
    if (!session?.user) throw new Error("沒有取得有效登入工作階段。");
    currentUser = session.user;
    currentProfile = await loadProfile(currentUser.id);

    $("userInfo").textContent = `${currentProfile.name}｜${roleText(currentProfile.role)}｜${currentProfile.email}`;
    show("loginView", false);
    show("mainView", true);
    await refreshAll();
    switchTab("dashboard");
  } catch (e) {
    console.error(e);
    await supabase.auth.signOut({ scope: "local" }).catch(()=>{});
    currentUser = null;
    currentProfile = null;
    show("mainView", false);
    show("loginView", true);
    status($("loginStatus"), `登入失敗：${e.message}`, true);
  } finally {
    booting = false;
  }
}

function roleText(r) {
  return ({owner:"負責人",manager:"主管",counselor:"禮儀師",accounting:"會計",staff:"一般員工"})[r] || r;
}

async function refreshAll() {
  const queries = await Promise.all([
    supabase.from("customers").select("*").order("created_at",{ascending:false}),
    supabase.from("funeral_cases").select("*").order("created_at",{ascending:false}),
    supabase.from("payments").select("*").order("payment_date",{ascending:false}),
    supabase.from("expenses").select("*").order("expense_date",{ascending:false}),
    supabase.from("schedules").select("*").order("start_at",{ascending:true})
  ]);
  const names = ["customers","funeral_cases","payments","expenses","schedules"];
  for (let i=0;i<queries.length;i++) if (queries[i].error) throw new Error(`${names[i]} 讀取失敗：${friendlyError(queries[i].error)}`);
  customers=queries[0].data||[];
  cases=queries[1].data||[];
  payments=queries[2].data||[];
  expenses=queries[3].data||[];
  schedules=queries[4].data||[];
  render();
}

function render() {
  $("customerCount").textContent=customers.length;
  $("caseCount").textContent=cases.length;
  $("pendingFinanceCount").textContent=payments.filter(x=>x.status==="pending").length+expenses.filter(x=>x.status==="pending").length;
  $("customerList").innerHTML=customers.map(x=>`<div class="item"><div class="item-title">${esc(x.name)}</div><div class="item-meta">電話：${esc(x.phone)}\n地址：${esc(x.address)}\n關係：${esc(x.relation)}\n備註：${esc(x.notes)}</div></div>`).join("")||'<div class="item muted">目前沒有客戶資料</div>';
  $("caseList").innerHTML=cases.map(x=>`<div class="item"><div class="item-title">${esc(x.case_number)}｜${esc(x.deceased_name)}</div><div class="item-meta">狀態：${esc(x.status)}\n契約金額：${Number(x.contract_amount||0).toLocaleString()} 元\n備註：${esc(x.notes)}</div></div>`).join("")||'<div class="item muted">目前沒有案件資料</div>';
  $("paymentList").innerHTML=payments.map(x=>`<div class="item"><div class="item-title">付款 ${Number(x.amount||0).toLocaleString()} 元</div><div class="item-meta">日期：${esc(x.payment_date)}｜狀態：${esc(x.status)}\n${esc(x.description)}</div></div>`).join("")||'<div class="item muted">目前沒有付款</div>';
  $("expenseList").innerHTML=expenses.map(x=>`<div class="item"><div class="item-title">支出 ${Number(x.amount||0).toLocaleString()} 元</div><div class="item-meta">日期：${esc(x.expense_date)}｜狀態：${esc(x.status)}\n${esc(x.description)}</div></div>`).join("")||'<div class="item muted">目前沒有支出</div>';
  $("scheduleList").innerHTML=schedules.map(x=>`<div class="item"><div class="item-title">${esc(x.title)}</div><div class="item-meta">${esc(x.start_at)}｜${esc(x.location)}\n${esc(x.notes)}</div></div>`).join("")||'<div class="item muted">目前沒有行程</div>';
}

function switchTab(tab) {
  document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
  ["dashboard","customers","cases","finance","schedules","staff"].forEach(id=>show(id,id===tab));
  if(tab==="staff") loadStaff();
}

async function loadStaff() {
  if (!currentProfile || !["owner","manager"].includes(currentProfile.role)) {
    $("staffList").innerHTML='<div class="item">目前帳號沒有查看員工名單的權限。</div>';
    return;
  }
  const {data,error}=await supabase.from("staff_profiles").select("name,email,role,active,created_at").order("created_at",{ascending:false});
  if(error){$("staffList").innerHTML=`<div class="item danger">${esc(friendlyError(error))}</div>`;return;}
  $("staffList").innerHTML=(data||[]).map(x=>`<div class="item"><div class="item-title">${esc(x.name)}｜${esc(roleText(x.role))}</div><div class="item-meta">${esc(x.email)}｜${x.active?"啟用":"停用"}</div></div>`).join("")||'<div class="item muted">目前沒有員工資料</div>';
}

$("loginBtn").addEventListener("click", async ()=>{
  const email=$("email").value.trim(), password=$("password").value;
  status($("loginStatus"),"");
  if(!email||!password){status($("loginStatus"),"請輸入電子郵件與密碼",true);return;}
  $("loginBtn").disabled=true;
  $("loginBtn").textContent="登入中…";
  try {
    const {data,error}=await supabase.auth.signInWithPassword({email,password});
    if(error) throw error;
    if(!data.session) throw new Error("Supabase 沒有回傳有效工作階段。");
    await enterApp(data.session);
  } catch(e) {
    console.error(e);
    status($("loginStatus"),`登入失敗：${friendlyError(e)}`,true);
  } finally {
    $("loginBtn").disabled=false;
    $("loginBtn").textContent="登入";
  }
});

$("password").addEventListener("keydown",e=>{if(e.key==="Enter")$("loginBtn").click();});
$("logoutBtn").addEventListener("click",async()=>{await supabase.auth.signOut();});
$("refreshBtn").addEventListener("click",async()=>{try{await refreshAll();status($("dashboardStatus"),"雲端資料已更新。");}catch(e){status($("dashboardStatus"),e.message,true);}});
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.tab)));

$("addCustomerBtn").addEventListener("click",async()=>{
  const name=prompt("客戶姓名"); if(!name)return;
  const phone=prompt("電話（可留空）")||"", address=prompt("地址（可留空）")||"", relation=prompt("與亡者關係（可留空）")||"", notes=prompt("備註（可留空）")||"";
  const {error}=await supabase.from("customers").insert({name,phone,address,relation,notes,created_by:currentUser.id});
  if(error) alert("新增客戶失敗："+friendlyError(error)); else await refreshAll();
});

$("addCaseBtn").addEventListener("click",async()=>{
  if(!customers.length){alert("請先新增客戶。");return;}
  const customer=customers[0];
  const deceased_name=prompt("亡者姓名"); if(!deceased_name)return;
  const case_number=prompt("案件編號"); if(!case_number)return;
  const contract_amount=Number(prompt("契約金額（數字）")||0);
  const {error}=await supabase.from("funeral_cases").insert({case_number,customer_id:customer.id,deceased_name,status:"pending",contract_amount,notes:"",created_by:currentUser.id});
  if(error) alert("新增案件失敗："+friendlyError(error)); else await refreshAll();
});

$("addPaymentBtn").addEventListener("click",async()=>{
  if(!cases.length){alert("請先新增案件。");return;}
  const amount=Number(prompt("付款金額")||0); if(!amount)return;
  const description=prompt("付款說明")||"";
  const {error}=await supabase.from("payments").insert({case_id:cases[0].id,amount,payment_date:new Date().toISOString().slice(0,10),description,status:"pending",created_by:currentUser.id});
  if(error) alert("新增付款失敗："+friendlyError(error)); else await refreshAll();
});

$("addExpenseBtn").addEventListener("click",async()=>{
  if(!cases.length){alert("請先新增案件。");return;}
  const amount=Number(prompt("支出金額")||0); if(!amount)return;
  const description=prompt("支出說明")||"";
  const {error}=await supabase.from("expenses").insert({case_id:cases[0].id,amount,expense_date:new Date().toISOString().slice(0,10),description,status:"pending",created_by:currentUser.id});
  if(error) alert("新增支出失敗："+friendlyError(error)); else await refreshAll();
});

$("addScheduleBtn").addEventListener("click",async()=>{
  if(!cases.length){alert("請先新增案件。");return;}
  const title=prompt("行程名稱"); if(!title)return;
  const start_at=prompt("日期時間，例如 2026-09-30 10:00"); if(!start_at)return;
  const location=prompt("地點")||"", notes=prompt("備註")||"";
  const {error}=await supabase.from("schedules").insert({case_id:cases[0].id,title,start_at,location,notes,created_by:currentUser.id});
  if(error) alert("新增行程失敗："+friendlyError(error)); else await refreshAll();
});

supabase.auth.onAuthStateChange((event, session)=>{
  console.log("Auth event:", event, !!session);
  if(event==="SIGNED_OUT"){
    currentUser=null; currentProfile=null;
    show("mainView",false); show("loginView",true);
    status($("loginStatus"),"已登出。");
  } else if((event==="INITIAL_SESSION" || event==="SIGNED_IN") && session && !currentUser){
    enterApp(session);
  }
});

(async()=>{
  try{
    const {data,error}=await supabase.auth.getSession();
    if(error) throw error;
    if(data.session) await enterApp(data.session);
  }catch(e){
    console.error("初始化失敗",e);
    status($("loginStatus"),`系統初始化失敗：${friendlyError(e)}`,true);
  }
})();
