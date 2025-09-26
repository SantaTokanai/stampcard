// Firebase 初期化（モジュール版）
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

/* ===== Firebase 設定 ===== */
const firebaseConfig = {
  apiKey: "AIzaSyBI_XbbC78cXCBmm6ue-h0HJ15dNsDAnzo",
  authDomain: "stampcard-project.firebaseapp.com",
  projectId: "stampcard-project",
  storageBucket: "stampcard-project.firebasestorage.app",
  messagingSenderId: "808808121881",
  appId: "1:808808121881:web:57f6d536d40fc2d30fcc88"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore();

/* ===== DOM参照 ===== */
const emailInput = document.getElementById('email');
const passInput  = document.getElementById('password');
const signupBtn  = document.getElementById('signup');
const loginBtn   = document.getElementById('login');
const keywordSec = document.getElementById('keyword-section');
const keywordInput = document.getElementById('keyword');
const stampBtn = document.getElementById('stampBtn');
const cardContainer = document.getElementById('card-container');
const messageDiv = document.getElementById('message');

/* ===== エラーメッセージ日本語化 ===== */
function getErrorMessageJP(error){
  switch (error.code) {
    case 'auth/invalid-email':      return 'メールアドレスの形式が正しくありません。';
    case 'auth/user-not-found':     return 'ユーザーが見つかりません。';
    case 'auth/wrong-password':     return 'パスワードが違います。';
    case 'auth/email-already-in-use': return 'このメールアドレスは既に登録されています。';
    default:                        return 'エラーが発生しました：' + error.message;
  }
}

function showMessage(msg){
  messageDiv.textContent = msg;
}

/* ===== Firebase Auth イベント ===== */
signupBtn.addEventListener('click', () => {
  createUserWithEmailAndPassword(auth, emailInput.value, passInput.value)
    .then(() => showMessage('登録完了！'))
    .catch(err => showMessage(getErrorMessageJP(err)));
});

loginBtn.addEventListener('click', () => {
  signInWithEmailAndPassword(auth, emailInput.value, passInput.value)
    .then(() => showMessage('ログインしました'))
    .catch(err => showMessage(getErrorMessageJP(err)));
});

onAuthStateChanged(auth, user => {
  if(user){
    keywordSec.style.display = 'block';
    loadStamps(user.uid);
  } else {
    keywordSec.style.display = 'none';
    clearStampsFromUI();
  }
});

/* ===== スタンプ情報 ===== */
// 位置と大きさを管理する配列
let stampPositions = [
  {img:'images/stamp1.png', left:'20%', top:'25%', width:'60px'},
  {img:'images/stamp2.png', left:'50%', top:'25%', width:'60px'},
  {img:'images/stamp3.png', left:'80%', top:'25%', width:'60px'}
];

/* スタンプ押下処理 */
stampBtn.addEventListener('click', async () => {
  const user = auth.currentUser;
  if(!user) { alert('ログインしてください'); return; }

  const keyword = keywordInput.value.trim();
  const today = new Date().toISOString().slice(0,10);

  // ここで合言葉判定（例：固定値 "apple"）
  if(keyword !== "apple") {
    alert("合言葉が違います");
    return;
  }

  const userDocRef = doc(db, "users", user.uid);
  await setDoc(userDocRef, { [today]: true }, { merge:true });

  placeStamp(today);
});

/* スタンプ読み込み */
async function loadStamps(uid){
  clearStampsFromUI();
  const userDocRef = doc(db, "users", uid);
  const snap = await getDoc(userDocRef);
  if(snap.exists()){
    const data = snap.data();
    Object.keys(data).forEach((date, idx) => {
      if(data[date] === true){
        const pos = stampPositions[idx % stampPositions.length];
        renderStamp(pos);
      }
    });
  }
}

/* スタンプ描画 */
function renderStamp(pos){
  const img = document.createElement('img');
  img.src = pos.img;
  img.className = 'stamp';
  img.style.left = pos.left;
  img.style.top = pos.top;
  img.style.width = pos.width;
  cardContainer.appendChild(img);
}

function clearStampsFromUI(){
  Array.from(cardContainer.querySelectorAll('.stamp')).forEach(n=>n.remove());
}
