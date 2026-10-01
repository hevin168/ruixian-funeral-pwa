const KEY="ruixian_funeral_data_v2",SESSION="ruixian_funeral_session_v2",OWNER="ruixian_owner_account_v1";
const DEF={customers:[],cases:[],payments:[],expenses:[],schedules:[],staff:[{id:"owner",name:"瑞賢禮儀社負責人",account:"owner",password:"123456",role:"負責人",active:true}]};
let data=(()=>{try{return {...DEF,...JSON.parse(localStorage.getItem(KEY))}}catch(e){return structuredClone(DEF)}})();
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const id=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const date=()=>new Date().toISOString().slice(0,10);
function owner(){try{let x=JSON.parse(localStorage.getItem(OWNER));if(x)return x}catch(e){}return{account:"owner",password:"123456"}}
function save(){localStorage.setItem(KEY,JSON.stringify(data));render()}
function login(){let a=document.getElementById("account").value.trim(),p=document.getElementById("password").value,o=owner(),s=data.staff.find(x=>x.active!==false&&x.account===a&&x.password===p);if(a===o.account&&p===o.password||s){localStorage.setItem(SESSION,"1");show()}else alert("帳號或密碼錯誤")}
function show(){document.getElementById("login").classList.add("hide");document.getElementById("app").classList.remove("hide");render()}
function logout(){localStorage.removeItem(SESSION);document.getElementById("app").classList.add("hide");document.getElementById("login").classList.remove("hide")}
function tab(x){["home","cases","customers","staff","backup"].forEach(y=>document.getElementById(y).classList.toggle("hide",y!==x));render()}
function openM(t,h){document.getElementById("mt").textContent=t;document.getElementById("mf").innerHTML=h;document.getElementById("modal").classList.remove("hide")}
function closeM(){document.getElementById("modal").classList.add("hide")}
function newCase(customerId="",caseId=""){
 let c=caseId?data.cases.find(x=>x.id===caseId):null,u=c?data.customers.find(x=>x.id===c.customerId):data.customers.find(x=>x.id===customerId);
 openM(c?"編輯案件":"新增案件",`<div class="hint">由新增案件直接建立完整客戶資料。<br>不包含身分證字號欄位。</div>
 <label>既有客戶（可不選）</label><select id="u">${`<option value="">＋建立新客戶</option>`+data.customers.map(x=>`<option value="${x.id}" ${u?.id===x.id?"selected":""}>${esc(x.name)}｜${esc(x.phone)}</option>`).join("")}</select>
 <div class="grid"><div><label>案件編號</label><input id="no" value="${esc(c?.caseNo||"")}"></div><div><label>案件日期</label><input id="dt" type="date" value="${esc(c?.date||date())}"></div>
 <div><label>客戶姓名</label><input id="name" value="${esc(u?.name||c?.name||"")}"></div><div><label>聯絡電話</label><input id="phone" value="${esc(u?.phone||"")}"></div>
 <div class="full"><label>客戶地址</label><input id="addr" value="${esc(u?.address||"")}"></div><div><label>家屬／關係人</label><input id="family" value="${esc(c?.family||"")}"></div>
 <div><label>案件狀態</label><select id="status">${["洽談中","服務中","已完成","已取消"].map(x=>`<option ${c?.status===x?"selected":""}>${x}</option>`).join("")}</select></div>
 <div class="full"><label>客戶備註</label><textarea id="cn">${esc(u?.note||"")}</textarea></div><div class="full"><label>案件備註</label><textarea id="note">${esc(c?.note||"")}</textarea></div></div>
 <button onclick="closeM()">取消</button><button class="mainbtn" onclick="saveCase('${caseId}')">儲存案件</button>`);
 document.getElementById("u").onchange=()=>{let x=data.customers.find(z=>z.id===document.getElementById("u").value);if(x){name.value=x.name;phone.value=x.phone;addr.value=x.address;cn.value=x.note}}
}
function saveCase(caseId){
 let name=document.getElementById("name").value.trim();if(!name)return alert("請輸入客戶姓名");
 let cid=document.getElementById("u").value,u=data.customers.find(x=>x.id===cid);
 if(!u){u={id:id(),name,phone:phone.value.trim(),address:addr.value.trim(),note:cn.value.trim()};data.customers.push(u)}
 else{u.name=name;u.phone=phone.value.trim();u.address=addr.value.trim();u.note=cn.value.trim()}
 let x={id:caseId||id(),customerId:u.id,caseNo:no.value.trim()||"案件-"+Date.now(),name:u.name,family:family.value.trim(),date:dt.value,status:status.value,note:note.value.trim()};
 let i=data.cases.findIndex(z=>z.id===caseId);if(i>=0)data.cases[i]=x;else data.cases.unshift(x);save();closeM();tab("cases")
}
function render(){
 stats.innerHTML=`<div class="stat">案件總數<b>${data.cases.length}</b></div><div class="stat">客戶總數<b>${data.customers.length}</b></div><div class="stat">服務中<b>${data.cases.filter(x=>x.status==="服務中").length}</b></div>`;
 let q=(caseQ?.value||"").toLowerCase();caseRows.innerHTML=data.cases.filter(x=>{let u=data.customers.find(z=>z.id===x.customerId)||{};return (x.caseNo+" "+u.name+" "+u.phone+" "+u.address).toLowerCase().includes(q)}).map(x=>{let u=data.customers.find(z=>z.id===x.customerId)||{};return `<tr><td>${esc(x.caseNo)}</td><td>${esc(u.name||x.name)}</td><td>${esc(u.phone)}</td><td>${esc(u.address)}</td><td>${esc(x.date)}</td><td>${esc(x.status)}</td><td><button onclick="newCase('','${x.id}')">編輯</button><button onclick="delCase('${x.id}')">刪除</button></td></tr>`}).join("")||"<tr><td colspan=7>目前沒有案件</td></tr>";
 let cq=(custQ?.value||"").toLowerCase();custRows.innerHTML=data.customers.filter(x=>(x.name+" "+x.phone+" "+x.address).toLowerCase().includes(cq)).map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.phone)}</td><td>${esc(x.address)}</td><td>${esc(x.note)}</td><td>${data.cases.filter(c=>c.customerId===x.id).length}</td><td><button onclick="newCase('${x.id}')">新增案件</button></td></tr>`).join("")||"<tr><td colspan=6>目前沒有客戶</td></tr>";
 staffRows.innerHTML=data.staff.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.account)}</td><td>${esc(x.role)}</td></tr>`).join("");
}
function delCase(x){if(confirm("確定刪除案件？")){data.cases=data.cases.filter(c=>c.id!==x);save()}}
function exportCSV(){
 let r=[["客戶姓名","聯絡電話","地址","客戶備註","案件編號","案件日期","家屬／關係人","案件狀態","案件備註"]];
 data.customers.forEach(u=>{let cs=data.cases.filter(c=>c.customerId===u.id);if(!cs.length)r.push([u.name,u.phone,u.address,u.note,"","","","",""]);else cs.forEach(c=>r.push([u.name,u.phone,u.address,u.note,c.caseNo,c.date,c.family,c.status,c.note]))});
 let csv="\uFEFF"+r.map(a=>a.map(x=>`"${String(x??"").replace(/"/g,'""')}"`).join(",")).join("\r\n"),a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));a.download="瑞賢禮儀社_全部客戶資料.csv";a.click()
}
function changeOwner(){
 let o=owner();openM("修改負責人帳號／密碼",`<label>新帳號</label><input id="oa" value="${esc(o.account)}"><label>目前密碼</label><input id="oc" type="password"><label>新密碼</label><input id="on" type="password"><label>確認新密碼</label><input id="on2" type="password"><button onclick="closeM()">取消</button><button class="mainbtn" onclick="saveOwner()">儲存</button>`)
}
function saveOwner(){let o=owner(),a=oa.value.trim(),c=oc.value,n=on.value;if(c!==o.password||!a||n.length<6||n!==on2.value)return alert("請確認目前密碼、帳號及新密碼（至少6碼）");localStorage.setItem(OWNER,JSON.stringify({account:a,password:n}));let s=data.staff.find(x=>x.id==="owner");if(s){s.account=a;s.password=n}save();closeM();alert("負責人帳號與密碼已更新")}
function newStaff(){openM("新增員工",`<label>姓名</label><input id="sn"><label>帳號</label><input id="sa"><label>密碼</label><input id="sp" type="password"><label>角色</label><select id="sr"><option>員工</option><option>主管</option></select><button onclick="closeM()">取消</button><button class="mainbtn" onclick="saveStaff()">儲存</button>`)}
function saveStaff(){if(!sn.value||!sa.value||!sp.value)return alert("請完整填寫");data.staff.push({id:id(),name:sn.value,account:sa.value,password:sp.value,role:sr.value,active:true});save();closeM()}
function backup(){let a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));a.download="瑞賢禮儀社_完整備份.json";a.click()}
function restore(e){let f=e.target.files[0];if(!f)return;let r=new FileReader();r.onload=()=>{try{let x=JSON.parse(r.result);if(!x.customers||!x.cases)throw 0;data={...DEF,...x};save();alert("匯入完成")}catch(e){alert("備份格式錯誤")}};r.readAsText(f)}
if(localStorage.getItem(SESSION))show();else document.getElementById("account").focus();
document.getElementById("password").onkeydown=e=>{if(e.key==="Enter")login()};
