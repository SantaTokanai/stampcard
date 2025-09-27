// Firebase 初期化
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// Firebase 設定
const firebaseConfig = {
  apiKey: "AIzaSyBI_XbbC78cXCBmm6ue-h0HJ15dNsDAnzo",
  authDomain: "stampcard-project.firebaseapp.com",
  projectId: "stampcard-project",
  storageBucket: "stampcard-project.firebasestorage.app",
  messagingSenderId: "808808121881",
  appId: "1:808808121881:web:57f6d536d40fc2d30fcc88"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// DOM
const nicknameInput = document.getElementById('email'); // 旧 emailInput
const passInput = document.getElementById('password');
const loginBtn = document.getElementById('login');
const signupBtn = document.getElementById('signup');
const logoutBtn = document.getElementById('logout');
const errorMsg = document.getElementById('error-msg');
const keywordSec = document.getElementById('keyword-section');
const keywordInput = document.getElementById('keyword');
const stampBtn = document.getElementById('stampBtn');
const cardContainer = document.getElementById('card-container');
const passwordMsg = document.getElementById('password-msg');

// メッセージ表示
function showMessage(msg, type='error'){
  errorMsg.textContent = msg;
  errorMsg.className = type === 'error' ? 'error' : 'success';
}

// 文字列のクリーニング（余計な引用符を削除）
function cleanString(s){
  return (typeof s === "string") ? s.trim().replace(/^['"]+|['"]+$/g,'') : s;
}

// Firestore から img フィールドを取得
function extractImgField(docData){
  if(!docData) return "";
  if(typeof docData.img === "string") return cleanString(docData.img);
  const keys = Object.keys(docData);
  for(const k of keys){
    const nk = k.trim().replace(/^['"]+|['"]+$/g,'').toLowerCase();
    if(nk === "img" && typeof docData[k] === "string") return cleanString(docData[k]);
  }
  for(const k of keys){
    const v = docData[k];
    if(typeof v === "string" && v.includes("images/")) return cleanString(v);
  }
  return "";
}

// -------------------------------------------------
// ユーザー管理（Firestoreのみ）
// -------------------------------------------------
let currentUser = null;

loginBtn.addEventListener('click', async () => {
  const nick = nicknameInput.value.trim();
  const pw   = passInput.value;
  if(!nick || !pw) { showMessage('ニックネームとパスワードを入力してください'); return; }
  try{
    const userDoc = await getDoc(doc(db,'users',nick));
    if(!userDoc.exists()){ showMessage('ユーザーが存在しません'); return; }
    const data = userDoc.data();
    if(data.password !== pw){ showMessage('パスワードが違います'); return; }
    currentUser = nick;
    loginStateChange();
  }catch(err){
    console.error(err);
    showMessage('ログイン処理でエラーが発生しました');
  }
});

signupBtn.addEventListener('click', async () => {
  const nick = nicknameInput.value.trim();
  const pw   = passInput.value;
  if(!nick || !pw) { showMessage('ニックネームとパスワードを入力してください'); return; }
  if(pw.length<6){ showMessage('パスワードは6文字以上です'); return; }
  try{
    const userDocRef = doc(db,'users',nick);
    const userSnap = await getDoc(userDocRef);
    if(userSnap.exists()){ showMessage('そのニックネームは既に使われています'); return; }
    await setDoc(userDocRef,{password: pw});
    currentUser = nick;
    loginStateChange();
  }catch(err){
    console.error(err);
    showMessage('登録処理でエラーが発生しました');
  }
});

logoutBtn.addEventListener('click', () => {
  currentUser = null;
  loginStateChange();
});

// UI 更新
function loginStateChange(){
  const loggedIn = !!currentUser;
  nicknameInput.style.display = loggedIn ? 'none' : 'inline-block';
  passInput.style.display = loggedIn ? 'none' : 'inline-block';
  loginBtn.style.display = loggedIn ? 'none' : 'inline-block';
  signupBtn.style.display = loggedIn ? 'none' : 'inline-block';
  logoutBtn.style.display = loggedIn ? 'inline-block' : 'none';
  passwordMsg.style.display = loggedIn ? 'none' : 'block';
  keywordSec.style.display = loggedIn ? 'block' : 'none';
  if(loggedIn) loadStamps(currentUser);
  else clearStampsFromUI();
  showMessage('');
}

// -------------------------------------------------
// スタンプ押下
// -------------------------------------------------
stampBtn.addEventListener('click', async () => {
  if(!currentUser){ showMessage('ログインしてください'); return; }
  const keyword = keywordInput.value.trim();
  if(!keyword){ showMessage('合言葉を入力してください'); return; }
  try{
    const kwDocRef = doc(db,'keywords',keyword);
    const kwSnap = await getDoc(kwDocRef);
    if(!kwSnap.exists()){ showMessage('その合言葉は存在しません'); return; }

    const userDocRef = doc(db,'users',currentUser);
    await setDoc(userDocRef,{[keyword]: true},{merge:true});
    showMessage('スタンプを押しました','success');
    loadStamps(currentUser);
  }catch(err){
    console.error(err);
    showMessage('スタンプ押下に失敗しました');
  }
});

// -------------------------------------------------
// スタンプ描画
// -------------------------------------------------
async function loadStamps(uid){
  clearStampsFromUI();
  const userSnap = await getDoc(doc(db,'users',uid));
  if(!userSnap.exists()) return;
  const userData = userSnap.data();

  const w = cardContainer.clientWidth;
  const h = cardContainer.clientHeight;

  // card-bgを横幅いっぱいに調整
  const bg = cardContainer.querySelector('.card-bg');
  if(bg){
    bg.style.width = '100%';
    bg.style.height = 'auto';
  }

  const promises = Object.keys(userData).filter(k=>k!=='password').map(async keyword=>{
    const kwSnap = await getDoc(doc(db,'keywords',keyword));
    if(!kwSnap.exists()) return;
    const raw = kwSnap.data();
    const norm = {};
    for(const k of Object.keys(raw)){
      const cleanKey = k.replace(/^['"]+|['"]+$/g,''); 
      norm[cleanKey] = raw[k];
    }
    const imgPath = extractImgField(norm);
    if(!imgPath) return;
    const xPos = Number(norm.x);
    const yPos = Number(norm.y);
    const wPercent = Number(norm.widthPercent);

    const img = new Image();
    img.className = 'stamp';
    img.style.position = 'absolute';
    img.style.transform = 'translate(-50%, -50%)';
    img.style.left  = (xPos * w) + 'px';
    img.style.top   = (yPos * h) + 'px';
    img.style.width = (wPercent * w) + 'px';
    img.src = imgPath;
    img.onload  = ()=>cardContainer.appendChild(img);
    img.onerror = ()=>console.warn(`画像が見つかりません: ${img.src}`);
  });

  await Promise.all(promises);
}

function clearStampsFromUI(){
  document.querySelectorAll('#card-container .stamp').forEach(e=>e.remove());
}

// 初期化
loginStateChange();
