import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
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
const auth = getAuth(app);
const db = getFirestore(app);

// DOM
const nicknameInput = document.getElementById('nickname');
const passInput = document.getElementById('password');
const loginBtn = document.getElementById('login');
const signupBtn = document.getElementById('signup');
const logoutBtn = document.getElementById('logout');
const errorMsg = document.getElementById('error-msg');
const passwordMsg = document.getElementById('password-msg');
const keywordSec = document.getElementById('keyword-section');
const keywordInput = document.getElementById('keyword');
const stampBtn = document.getElementById('stampBtn');
const cardContainer = document.getElementById('card-container');
const cardBg = document.querySelector('.card-bg');

// メッセージ表示
function showMessage(msg, type='error'){
  errorMsg.textContent = msg;
  errorMsg.className = type === 'error' ? 'error' : 'success';
}

// --------------------------------------------
// ヘルパー：Firestoreの img フィールド取得
// --------------------------------------------
function cleanString(s){
  return (typeof s === "string") ? s.trim().replace(/^['"]+|['"]+$/g,'') : s;
}

function extractImgField(docData){
  if(!docData) return "";
  if(typeof docData.img === "string") return cleanString(docData.img);
  const keys = Object.keys(docData);
  for(const k of keys){
    const nk = k.trim().replace(/^['"]+|['"]+$/g,'').toLowerCase();
    if(nk === "img" && typeof docData[k]==="string") return cleanString(docData[k]);
  }
  for(const k of keys){
    const v = docData[k];
    if(typeof v==="string" && v.includes("images/")) return cleanString(v);
  }
  return "";
}

// --------------------------------------------
// 認証処理
// --------------------------------------------
signupBtn.addEventListener('click', async () => {
  if(passInput.value.length < 6){
    showMessage('パスワードは6文字以上です');
    return;
  }
  try {
    // ニックネームを uid としてユーザー管理（Firebase Authenticationは使わない）
    const userDocRef = doc(db,'users',nicknameInput.value.trim());
    await setDoc(userDocRef, {});
    showMessage('新規登録しました。自動でログインしました', 'success');
    handleLogin();
  } catch(err) {
    showMessage('登録処理でエラーが発生しました：' + err.message);
    console.error(err);
  }
});

loginBtn.addEventListener('click', handleLogin);

async function handleLogin(){
  const nickname = nicknameInput.value.trim();
  if(!nickname){ showMessage('ニックネームを入力してください'); return; }
  // 実質「ログイン」はユーザドキュメントの存在チェック
  try {
    const userSnap = await getDoc(doc(db,'users',nickname));
    if(!userSnap.exists()){ showMessage('ユーザーが存在しません'); return; }
    showMessage('ログインしました', 'success');
    nicknameInput.style.display = 'none';
    passInput.style.display = 'none';
    loginBtn.style.display = 'none';
    signupBtn.style.display = 'none';
    logoutBtn.style.display = 'inline-block';
    passwordMsg.style.display = 'none';
    keywordSec.style.display = 'block';
    loadStamps(nickname);
  } catch(err){
    showMessage('ログイン処理でエラーが発生しました：' + err.message);
  }
}

logoutBtn.addEventListener('click', () => {
  nicknameInput.style.display = 'inline-block';
  passInput.style.display = 'inline-block';
  loginBtn.style.display = 'inline-block';
  signupBtn.style.display = 'inline-block';
  logoutBtn.style.display = 'none';
  passwordMsg.style.display = 'block';
  keywordSec.style.display = 'none';
  clearStampsFromUI();
  showMessage('');
});

// --------------------------------------------
// スタンプ処理
// --------------------------------------------
stampBtn.addEventListener('click', async () => {
  const nickname = nicknameInput.value.trim();
  if(!nickname){ showMessage('ログインしてください'); return; }

  const keyword = keywordInput.value.trim();
  if(!keyword){ showMessage('合言葉を入力してください'); return; }

  try{
    const kwSnap = await getDoc(doc(db,'keywords',keyword));
    if(!kwSnap.exists()){ showMessage('その合言葉は存在しません'); return; }
    const data = kwSnap.data();

    const userDocRef = doc(db,'users',nickname);
    await setDoc(userDocRef,{[keyword]:true},{merge:true});
    showMessage('スタンプを押しました', 'success');
    loadStamps(nickname);
  } catch(err){
    showMessage('スタンプ押下に失敗しました：' + err.message);
    console.error(err);
  }
});

// --------------------------------------------
// スタンプ描画
// --------------------------------------------
async function loadStamps(uid){
  clearStampsFromUI();
  const userSnap = await getDoc(doc(db,'users',uid));
  if(!userSnap.exists()) return;
  const userData = userSnap.data();

  const w = cardContainer.clientWidth;
  const h = cardContainer.clientHeight;

  const promises = Object.keys(userData).map(async keyword=>{
    const kwSnap = await getDoc(doc(db,'keywords',keyword));
    if(!kwSnap.exists()) return;
    const d = kwSnap.data();

    const norm = {};
    for(const k of Object.keys(d)){
      const cleanKey = k.replace(/^['"]+|['"]+$/g,'');
      norm[cleanKey] = d[k];
    }

    const src = extractImgField(norm);
    if(!src) return;
    const xPos = Number(norm.x);
    const yPos = Number(norm.y);
    const wPercent = Number(norm.widthPercent);

    const img = new Image();
    img.className = 'stamp';
    img.style.position = 'absolute';
    img.style.transform = 'translate(-50%, -50%)';
    img.style.left = (xPos*w)+'px';
    img.style.top = (yPos*h)+'px';
    img.style.width = (wPercent*w)+'px';

    img.onload = ()=> cardContainer.appendChild(img);
    img.onerror = ()=> console.warn(`画像が見つかりません: ${img.src}`);
    img.src = src;
  });

  await Promise.all(promises);
}

function clearStampsFromUI(){
  document.querySelectorAll('#card-container .stamp').forEach(e=>e.remove());
}
