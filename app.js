const SUPABASE_URL = "https://zjetemcqysvpbnyvpyma.supabase.co";
const SUPABASE_KEY = "sb_publishable_jdeKO7PxDMGjAg_qCFw5FA_wr5OJcei";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const loginBtn = document.getElementById("loginBtn");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const status = document.getElementById("loginStatus");

loginBtn.onclick = async function () {

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    status.textContent = "請輸入電子郵件和密碼";
    return;
  }

  status.textContent = "登入中……";

  const result = await supabaseClient.auth.signInWithPassword({
    email: email,
    password: password
  });

  if (result.error) {
    status.textContent = "登入失敗：" + result.error.message;
    return;
  }

  status.textContent = "登入成功！";

  document.getElementById("loginView").hidden = true;
  document.getElementById("mainView").hidden = false;

};
