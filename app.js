const SUPABASE_URL = "https://zjetemcqysvpbnyvpyma.supabase.co";
const SUPABASE_KEY = "sb_publishable_jdeKO7PxDMGjAg_qCFw5FA_wr5OJcei";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const loginBtn = document.getElementById("loginBtn");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginStatus = document.getElementById("loginStatus");

loginBtn.onclick = async function () {

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    loginStatus.textContent = "請輸入電子郵件和密碼";
    return;
  }

  loginBtn.disabled = true;
  loginStatus.textContent = "登入中……";

  try {

    const result = await supabaseClient.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (result.error) {
      loginStatus.textContent =
        "登入失敗：" + result.error.message;
      loginBtn.disabled = false;
      return;
    }

    loginStatus.textContent = "登入成功！";

    document.getElementById("loginView").hidden = true;
    document.getElementById("mainView").hidden = false;

  } catch (error) {

    loginStatus.textContent =
      "系統錯誤：" + error.message;

  }

  loginBtn.disabled = false;
};
