// Firebase 初期化
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  query,
  collection,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

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

let currentUser = null;

// SHA-256 ハッシュ化
async function hashPassword(password){
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2,'0'))
    .join('');
}

// メッセージ表示
function showMessage(msg, type='error'){
  errorMsg.textContent = msg;
  errorMsg.className = type === 'error' ? 'error' : 'success';
}

// ------------------
// 認証処理
// ------------------
signupBtn.addEventListener('click', async () => {
  const nickname = nicknameInput.value.trim();
  const password = passInput.value;

  if(!nickname){
    showMessage('ニックネームを入力してください');
    return;
  }
  if(password.length < 6){
    showMessage('パスワードは6文字以上です');
    return;
  }

  // 重複チェック
  const q = query(collection(db,'users'), where('nickname','==',nickname));
  const snap = await getDocs(q);
  if(!snap.empty){
    showMessage('そのニックネームは既に使われています');
    return;
  }

  const passwordHash = await hashPassword(password);
  const userRef = doc(db,'users',nickname);
  await setDoc(userRef, { nickname, passwordHash });
  showMessage('新規登録完了。ログインしました', 'success');
  currentUser = nickname;
  updateUI();
  loadStamps(nickname);
});

loginBtn.addEventListener('click', async () => {
  const nickname = nicknameInput.value.trim();
  const password = passInput.value;
  if(!nickname || !password){
    showMessage('ニックネームとパスワードを入力してください');
    return;
  }

  const userRef = doc(db,'users',nickname);
  const userSnap = await getDoc(userRef);
  if(!userSnap.exists()){
    showMessage('ユーザーが存在しません');
    return;
  }

  const passwordHash = await hashPassword(password);
  if(passwordHash !== userSnap.data().passwordHash){
    showMessage('パスワードが違います');
    return;
  }

  showMessage('ログインしました', 'success');
  currentUser = nickname;
  updateUI();
  loadStamps(nickname);
});

logoutBtn.addEventListener('click', () => {
  currentUser = null;
  showMessage('');
  updateUI();
  clearStampsFromUI();
});

// UI更新
function updateUI(){
  if(currentUser){
    nicknameInput.style.display = 'none';
    passInput.style.display  = 'none';
    loginBtn.style.display   = 'none';
    signupBtn.style.display  = 'none';
    logoutBtn.style.display  = 'inline-block';
    passwordMsg.style.display= 'none';
    keywordSec.style.display = 'block';
  } else {
    nicknameInput.style.display = 'inline-block';
    passInput.style.display  = 'inline-block';
    loginBtn.style.display   = 'inline-block';
    signupBtn.style.display  = 'inline-block';
    logoutBtn.style.display  = 'none';
    passwordMsg.style.display= 'block';
    keywordSec.style.display = 'none';
  }
}

// ------------------
// スタンプ押下
// ------------------
stampBtn.addEventListener('click', async () => {
  if(!currentUser){
    showMessage('ログインしてください');
    return;
  }

  const keyword = keywordInput.value.trim();
  if(!keyword){
    showMessage('合言葉を入力してください');
    return;
  }

  const kwRef = doc(db,'keywords',keyword);
  const kwSnap = await getDoc(kwRef);
  if(!kwSnap.exists()){
    showMessage('その合言葉は存在しません');
    return;
  }
  const data = kwSnap.data();
  const img = cleanImgField(data);

  const userRef = doc(db,'users',currentUser);
  await setDoc(userRef,{ [keyword]: true },{ merge:true });
  showMessage('スタンプを押しました', 'success');
  loadStamps(currentUser);
});

// ------------------
// スタンプ描画
// ------------------
function cleanImgField(docData){
  if(!docData) return '';
  if(typeof docData.img === 'string') return docData.img.replace(/^['"]+|['"]+$/g,'').trim();
  const keys = Object.keys(docData);
  for(const k of keys){
    if(k.toLowerCase().includes('img') && typeof docData[k] === 'string'){
      return docData[k].replace(/^['"]+|['"]+$/g,'').trim();
    }
  }
  return '';
}

async function loadStamps(nickname){
  clearStampsFromUI();
  const userSnap = await getDoc(doc(db,'users',nickname));
  if(!userSnap.exists()) return;
  const userData = userSnap.data();

  const w = cardContainer.clientWidth;
  const h = cardContainer.clientHeight;

  for(const keyword of Object.keys(userData)){
    if(keyword === 'nickname' || keyword === 'passwordHash') continue;
    const kwSnap = await getDoc(doc(db,'keywords',keyword));
    if(!kwSnap.exists()) continue;

    const d = kwSnap.data();
    const src = cleanImgField(d);
    const xPos = Number(d.x);
    const yPos = Number(d.y);
    const wPercent = Number(d.widthPercent);

    const img = new Image();
    img.className = 'stamp';
    img.style.position = 'absolute';
    img.style.transform = 'translate(-50%, -50%)';
    img.style.left  = (xPos * w) + 'px';
    img.style.top   = (yPos * h) + 'px';
    img.style.width = (wPercent * w) + 'px';
    img.onload  = () => cardContainer.appendChild(img);
    img.onerror = () => console.warn(`画像が見つかりません: ${img.src}`);
    img.src = src;
  }
}

function clearStampsFromUI(){
  document.querySelectorAll('#card-container .stamp').forEach(e=>e.remove());
}
