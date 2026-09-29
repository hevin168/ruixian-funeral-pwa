瑞賢禮儀社｜0元安全版 PWA 修正版
=================================

這個版本針對 GitHub Pages + Supabase 登入卡在登入畫面的問題重新處理。

修正內容：
1. 使用 Supabase signInWithPassword。
2. 使用 onAuthStateChange 管理 INITIAL_SESSION / SIGNED_IN / SIGNED_OUT。
3. 登入後明確讀取 staff_profiles。
4. staff_profiles 找不到、停用、RLS 讀取失敗時，會顯示明確錯誤，不再無限停留。
5. 啟用 persistSession / autoRefreshToken。
6. 不含身分證字號欄位。
7. 不把 Supabase Secret Key 放在前端。

目前連線：
Supabase URL 已寫入 app.js。
瀏覽器只使用 Publishable Key；請勿把 Secret Key 放進前端。

部署方式：
GitHub Pages → Deploy from a branch → main → /(root)

重要：
GitHub Pages Repository 只放程式碼，不放客戶資料、密碼或 Secret Key。
案件資料由 Supabase 儲存並由 RLS 控制。

如果登入仍失敗：
請直接看登入畫面顯示的「登入失敗：……」完整訊息。
不要提供密碼給任何人。
