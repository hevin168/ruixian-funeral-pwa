alert("A：app.js開始");

const btn = document.getElementById("loginBtn");

alert("B：找到登入按鈕：" + !!btn);

btn.onclick = function () {
  alert("C：登入按鈕有反應");
};
