"use strict";

alert("① app.js 已載入");

const SUPABASE_URL = "https://zjetemcqysvpbnyvpyma.supabase.co";

const SUPABASE_KEY = "sb_publishable_jdeKO7PxDMGjAg_qCFw5FA_wr5OJcei";

alert("② 準備建立 Supabase");

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

alert("③ Supabase 建立成功");

document.addEventListener("DOMContentLoaded", function () {

  alert("④ 網頁初始化成功");

  const button = document.getElementById("loginBtn");

  if (!button) {
    alert("⑤ 找不到登入按鈕");
    return;
  }

  alert("⑤ 已找到登入按鈕");

  button.addEventListener("click", async function () {

    alert("⑥ 已按下登入");

    const email =
      document.getElementById("email").value.trim();

    const password =
      document.getElementById("password").value;

    alert(
      "⑦ 已取得帳號密碼\n\nEmail：" +
      email
    );

    try {

      alert("⑧ 開始連線 Supabase");

      const result =
        await supabase.auth.signInWithPassword({
          email: email,
          password: password
        });

      alert("⑨ Supabase 已回應");

      if (result.error) {

        alert(
          "登入失敗：\n\n" +
          result.error.message
        );

        return;
      }

      if (!result.data.session) {

        alert(
          "登入失敗：沒有取得 Session"
        );

        return;
      }

      alert(
        "⑩ 登入成功！\n\n" +
        "User ID：\n" +
        result.data.session.user.id
      );

    } catch (error) {

      alert(
        "發生錯誤：\n\n" +
        error.message
      );

    }

  });

});
