"use strict";

const SUPABASE_URL = "https://zjetemcqysvpbnyvpyma.supabase.co";

const SUPABASE_KEY = "sb_publishable_jdeKO7PxDMGjAg_qCFw5FA_wr5OJcei";

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

function get(id) {
  return document.getElementById(id);
}

function showStatus(message, error) {
  const box = get("loginStatus");

  if (!box) {
    alert(message);
    return;
  }

  box.textContent = message;
  box.style.display = "block";
  box.style.color = error ? "red" : "#b45309";
}

async function login() {

  const emailBox = get("email");
  const passwordBox = get("password");
  const button = get("loginBtn");

  const email = emailBox ? emailBox.value.trim() : "";
  const password = passwordBox ? passwordBox.value : "";

  if (!email) {
    showStatus("請輸入電子郵件", true);
    return;
  }

  if (!password) {
    showStatus("請輸入密碼", true);
    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent = "登入中...";
  }

  showStatus("正在登入...");

  try {

    const result = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (result.error) {
      throw result.error;
    }

    if (!result.data.session) {
      throw new Error("登入成功，但沒有取得登入 Session");
    }

    showStatus("登入成功，正在確認員工資料...");

    const userId = result.data.session.user.id;

    const profile = await supabase
      .from("staff_profiles")
      .select("user_id,name,email,role,active")
      .eq("user_id", userId)
      .maybeSingle();

    if (profile.error) {
      throw new Error(
        "讀取員工資料失敗：" + profile.error.message
      );
    }

    if (!profile.data) {
      throw new Error(
        "找不到此登入帳號的員工資料"
      );
    }

    if (profile.data.active !== true) {
      throw new Error(
        "此員工帳號目前已停用"
      );
    }

    const loginView = get("loginView");
    const mainView = get("mainView");
    const userInfo = get("userInfo");

    if (loginView) {
      loginView.hidden = true;
    }

    if (mainView) {
      mainView.hidden = false;
    }

    if (userInfo) {
      userInfo.textContent =
        profile.data.name +
        "｜" +
        profile.data.role;
    }

    showStatus("");

    alert(
      "登入成功！\n\n" +
      profile.data.name +
      "\n權限：" +
      profile.data.role
    );

  } catch (error) {

    console.error(error);

    showStatus(
      "登入失敗：" +
      (error.message || String(error)),
      true
    );

  } finally {

    if (button) {
      button.disabled = false;
      button.textContent = "登入";
    }

  }
}

async function logout() {

  await supabase.auth.signOut();

  const loginView = get("loginView");
  const mainView = get("mainView");

  if (mainView) {
    mainView.hidden = true;
  }

  if (loginView) {
    loginView.hidden = false;
  }
}

function start() {

  const loginButton = get("loginBtn");

  if (loginButton) {
    loginButton.addEventListener(
      "click",
      login
    );
  }

  const logoutButton = get("logoutBtn");

  if (logoutButton) {
    logoutButton.addEventListener(
      "click",
      logout
    );
  }

  const passwordBox = get("password");

  if (passwordBox) {
    passwordBox.addEventListener(
      "keydown",
      function(event) {
        if (event.key === "Enter") {
          login();
        }
      }
    );
  }
}

if (document.readyState === "loading") {

  document.addEventListener(
    "DOMContentLoaded",
    start
  );

} else {

  start();

}
