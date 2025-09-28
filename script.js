import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBI_XbbC78cXCBmm6ue-h0HJ15dNsDAnzo",
  authDomain: "stampcard-project.firebaseapp.com",
  projectId: "stampcard-project",
  storageBucket: "stampcard-project.firebasestorage.app",
  messagingSenderId: "808808121881",
  appId: "1:808808121881:web:57f6d536d40fc2d30fcc88"
};
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

const nicknameInput = document.getElementById('nickname');
const passInput     = document.getElementById('password');
const signupBtn     = document.getElementById('signup');
const loginBtn      = document.getElementById('login');
const logoutBtn     = document.getElementById('logout');
const errorMsg      = document.getElementById('error-msg');

const secretSec     = document.getElementById('secret-section');
const secretQInput  = document.getElementById('secretQ');
const secretAInput  = document.getElementById('secretA');

const forgotLink    = document.getElementById('forgot-password');
const resetSection  = document.getElementById('reset-section');
const resetNickname = document.getElementById('reset-nickname');
const resetStartBtn = document.getElementById('reset-start');
const resetQuestion = document.getElementById('reset-question');
const showQuestion  = document.getElementById('show-question');
const resetAnswer   = document.getElementById('reset-answer');
const resetNewPass  = document.getElementById('reset-newpass');
const resetSubmit   = document.getElementById('reset-submit');

const keywordSec    = document.getElementById('keyword-section');
const keywordInput  = document.getElementById('keyword');
const stampBtn      = document.getElementById('stampBtn');

const cardContainer = document.getElementById('card-container');
const cardBg        = document.getElementById('card-bg');

let currentUser = null;

function msg(t, ok=false){
  errorMsg.textContent = t;
  errorMsg.style.color = ok ? "green":"red";
}

function h(p){ return sha256(p); }

/* ---------- 新規登録 ---------- */
signupBtn.onclick = async () => {
  if(secretSec.style.display==="none"){ 
    secretSec.style.display="block";
    msg("秘密の質問と答えを入力してください");
    return;
  }
  const n=nicknameInput.value.trim(), p=passInput.value,
        q=secretQInput.value.trim(), a=secretAInput.value.trim();
  if(!n||!p||!q||!a){ msg("すべて入力してください"); return; }

  const ref=doc(db,'users',n);
  if((await getDoc(ref)).exists()){ msg("そのニックネームは既に存在します"); return; }

  await setDoc(ref,{password:h(p),secretQ:q,secretA:a});
  currentUser=n;
  afterLogin();
  msg("登録成功",true);
};

/* ---------- ログイン ---------- */
loginBtn.onclick = async ()=>{
  const n=nicknameInput.value.trim(), p=passInput.value;
  if(!n||!p){ msg("入力してください"); return; }
  const snap=await getDoc(doc(db,'users',n));
  if(!snap.exists()){ msg("ユーザーがありません"); return; }
  if(snap.data().password!==h(p)){ msg("パスワードが違います"); return; }
  currentUser=n;
  afterLogin();
  msg("ログインしました",true);
};

/* ---------- ログアウト ---------- */
logoutBtn.onclick = ()=>{
  currentUser=null;
  document.getElementById('auth-section').style.display="block";
  logoutBtn.style.display="none";
  keywordSec.style.display="none";
  clearStamps();
  msg("");
};

/* ---------- ログイン後共通処理 ---------- */
function afterLogin(){
  document.getElementById('auth-section').style.display="none";
  logoutBtn.style.display="inline-block";   // ✅ ここで確実に表示
  keywordSec.style.display="block";
  loadStamps();
}

/* ---------- スタンプ押す ---------- */
stampBtn.onclick = async ()=>{
  if(!currentUser){ msg("ログインしてください"); return; }
  const key=keywordInput.value.trim();
  if(!key){ msg("合言葉を入力"); return; }

  const kwRef=doc(db,'keywords',key);
  const kwSnap=await getDoc(kwRef);
  if(!kwSnap.exists()){ msg("合言葉が無効です"); return; }

  await setDoc(doc(db,'users',currentUser),{[key]:true},{merge:true});
  msg("スタンプを押しました",true);
  loadStamps();
};

/* ---------- スタンプ描画 ---------- */
async function loadStamps(){
  clearStamps();
  const user=await getDoc(doc(db,'users',currentUser));
  if(!user.exists()) return;
  const data=user.data();

  // 背景画像ロード完了後に描画 (高さ0対策)
  if(!cardBg.complete){
    cardBg.onload=()=>draw(data);
  }else{
    draw(data);
  }
}

function draw(userData){
  const w=cardContainer.clientWidth;
  const h=cardContainer.clientHeight;
  Object.keys(userData).forEach(async k=>{
    if(["password","secretQ","secretA"].includes(k)) return;
    const kw=await getDoc(doc(db,'keywords',k));
    if(!kw.exists()) return;
    const d=kw.data();
    const img=new Image();
    img.src=d.img;
    img.className="stamp";
    img.style.left = (d.x*w) + "px";
    img.style.top  = (d.y*h) + "px";
    img.style.width= (d.widthPercent*w) + "px";
    img.style.position="absolute";
    img.style.transform="translate(-50%,-50%)";
    cardContainer.appendChild(img);
  });
}

function clearStamps(){
  document.querySelectorAll("#card-container .stamp").forEach(e=>e.remove());
}

/* ---------- パスワードリセット ---------- */
forgotLink.onclick=e=>{
  e.preventDefault();
  resetSection.style.display="block";
  resetQuestion.style.display="none";
};

resetStartBtn.onclick=async()=>{
  const n=resetNickname.value.trim();
  if(!n){ msg("ニックネーム入力"); return; }
  const snap=await getDoc(doc(db,'users',n));
  if(!snap.exists()){ msg("ユーザー無し"); return; }
  showQuestion.textContent=snap.data().secretQ;
  resetQuestion.style.display="block";
};

resetSubmit.onclick=async()=>{
  const n=resetNickname.value.trim(),
        a=resetAnswer.value.trim(),
        p=resetNewPass.value;
  const ref=doc(db,'users',n);
  const snap=await getDoc(ref);
  if(!snap.exists()){ msg("ユーザー無し"); return; }
  if(snap.data().secretA!==a){ msg("答えが違います"); return; }
  await setDoc(ref,{password:h(p)},{merge:true});
  msg("パスワード更新",true);
  resetSection.style.display="none";
};
