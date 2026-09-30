/* 瑞賢禮儀社 PWA 登入測試版 */

“use strict”;

const SUPABASE_URL = “https://zjetemcqysvpbnyvpyma.supabase.co”;

const SUPABASE_KEY = “sb_publishable_jdeKO7PxDMGjAg_qCFw5FA_wr5OJcei”;

const supabase = window.supabase.createClient(
SUPABASE_URL,
SUPABASE_KEY
);

const $ = (id) => document.getElementById(id);

function status(text, error = false) {
const el = $(“loginStatus”);

if (!el) return;

el.textContent = text;
el.style.color = error ? “red” : “#b45309”;
}

async function login() {

const email = $(“email”)?.value.trim();
const password = $(“password”)?.value;

if (!email) {
status(“請輸入 Email”, true);
return;
}

if (!password) {
status(“請輸入密碼”, true);
return;
}

const btn = $(“loginBtn”);

if (btn) {
btn.disabled = true;
btn.textContent = “登入中…”;
}

status(“① 正在登入 Supabase…”);

try {

const result =
  await supabase.auth.signInWithPassword({
    email: email,
    password: password
  });
if (result.error) {
  throw result.error;
}
const session = result.data.session;
if (!session) {
  throw new Error("沒有取得 Session");
}
status("② 登入成功，正在確認員工資料...");
const userId = session.user.id;
console.log("User ID:", userId);
const profileResult =
  await supabase
    .from("staff_profiles")
    .select("user_id,name,email,role,active")
    .eq("user_id", userId)
    .maybeSingle();
console.log(
  "staff_profiles:",
  profileResult
);
if (profileResult.error) {
  throw new Error(
    "staff_profiles 錯誤：" +
    profileResult.error.message
  );
}
if (!profileResult.data) {
  throw new Error(
    "找不到這個帳號的員工資料"
  );
}
if (profileResult.data.active !== true) {
  throw new Error(
    "員工帳號目前是停用狀態"
  );
}
status("③ 員工資料確認成功！");
console.log(
  "員工：",
  profileResult.data
);
/*
 * 登入成功
 */
const loginView = $("loginView");
const mainView = $("mainView");
if (loginView) {
  loginView.hidden = true;
}
if (mainView) {
  mainView.hidden = false;
}
if ($("userInfo")) {
  $("userInfo").textContent =
    profileResult.data.name +
    "｜" +
    profileResult.data.role +
    "｜" +
    profileResult.data.email;
}
status("");
alert(
  "登入成功！\n\n" +
  profileResult.data.name +
  "\n權限：" +
  profileResult.data.role
);

} catch (error) {

console.error(
  "登入錯誤：",
  error
);
status(
  "登入失敗：" +
  (error.message || error),
  true
);

} finally {

if (btn) {
  btn.disabled = false;
  btn.textContent = "登入";
}

}
}

function logout() {

supabase.auth.signOut();

if ($(“mainView”)) {
$(“mainView”).hidden = true;
}

if ($(“loginView”)) {
$(“loginView”).hidden = false;
}
}

function start() {

console.log(
“瑞賢禮儀社 PWA 啟動”
);

const loginBtn = $(“loginBtn”);

if (loginBtn) {

loginBtn.addEventListener(
  "click",
  login
);

}

const logoutBtn = $(“logoutBtn”);

if (logoutBtn) {

logoutBtn.addEventListener(
  "click",
  logout
);

}

const password = $(“password”);

if (password) {

password.addEventListener(
  "keydown",
  function(event) {
    if (event.key === "Enter") {
      login();
    }
  }
);

}
}

if (
document.readyState === “loading”
) {

document.addEventListener(
“DOMContentLoaded”,
start
);

} else {

start();
}
