// Firebase 初期化（モジュール版）
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
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
const loginMessageDiv = document.createElement('div');
loginMessageDiv.style.color = 'red';
loginBtn.insertAdjacentElement('afterend', loginMessageDiv);

const logoutBtn  = document.createElement('button');
logoutBtn.textContent = "ログアウト";
logoutBtn.style.display = 'none';
document.body.insertBefore(logoutBtn, document.getElementById('keyword-section'));

const keywordSec = document.getElementById('keyword-section');
const keywordInput = document.getElementById('keyword');
const stampBtn = document.getElementById('stampBtn');
const cardContainer = document.getElementById('card-container');

/* ===== エラーメッセージ日本語化 ===== */
function getErrorMessageJP(error){
  return 'メールアドレスまたはパスワードが正しくありません';
}

function showLoginMessage(msg){
  loginMessageDiv.textContent = msg;
}

function showMessage(msg){
  alert(msg); // スタンプ押下時などは alert で通知
}

/* ===== Firebase Auth イベント ===== */
signupBtn.addEventListener('click', () => {
  createUserWithEmailAndPassword(auth, emailInput.value, passInput.value)
    .then(() => showLoginMessage('登録完了！'))
    .catch(err => showLoginMessage(getErrorMessageJP(err)));
});

loginBtn.addEventListener('click', () => {
  signInWithEmailAndPassword(auth, emailInput.value, passInput.value)
    .then(() => showLoginMessage('ログインしました'))
    .catch(err => showLoginMessage(getErrorMessageJP(err)));
});

logoutBtn.addEventListener('click', () => {
  signOut(auth).then(() => {
    showLoginMessage('ログアウトしました');
    logoutBtn.style.display = 'none';
    stampBtn.style.display = 'none';
  });
});

onAuthStateChanged(auth, user => {
  if(user){
    keywordSec.style.display = 'block';
    logoutBtn.style.display = 'inline-block';
    stampBtn.style.display = 'inline-block';
    loadStamps(user.uid);
  } else {
    keywordSec.style.display = 'none';
    logoutBtn.style.display = 'none';
    stampBtn.style.display = 'none';
    clearStampsFromUI();
  }
});

/* ===== スタンプ情報 ===== */
let stampPositions = [
  {img:'images/stamp1.png', left:'20%', top:'25%', width:'60px'},
  {img:'images/stamp2.png', left:'50%', top:'25%', width:'60px'},
  {img:'images/stamp3.png', left:'80%', top:'25%', width:'60px'}
];

/* ===== スタンプ押下処理 ===== */
stampBtn.addEventListener('click', async () => {
  const user = auth.currentUser;
  if(!user) { alert('ログインしてください'); return; }

  const keyword = keywordInput.value.trim();
  const today = new Date().toISOString().slice(0,10);

  if(keyword !== "apple") {
    alert("合言葉が違います");
    return;
  }

  const userDocRef = doc(db, "users", user.uid);

  const snap = await getDoc(userDocRef);
  const data = snap.exists() ? snap.data() : {};
  if(data[today]){
    alert("本日は既にスタンプ済みです");
    return;
  }

  await setDoc(userDocRef, { [today]: true }, { merge:true });
  placeStamp(today);
});

/* ===== スタンプ描画 ===== */
function placeStamp(today){
  const idx = Object.keys(stampPositions).length % stampPositions.length;
  const pos = stampPositions[idx];
  renderStamp(pos);
  showMessage('スタンプを押しました！');
}

function loadStamps(uid){
  clearStampsFromUI();
  const userDocRef = doc(db, "users", uid);
  getDoc(userDocRef).then(snap => {
    if(snap.exists()){
      const data = snap.data();
      Object.keys(data).forEach((date, idx) => {
        if(data[date] === true){
          const pos = stampPositions[idx % stampPositions.length];
          renderStamp(pos);
        }
      });
    }
  });
}

function renderStamp(pos){
  const img = document.createElement('img');
  img.src = pos.img;
  img.className = 'stamp';
  img.style.position = 'absolute';
  img.style.left = pos.left;
  img.style.top = pos.top;
  img.style.width = pos.width;
  cardContainer.appendChild(img);
}

function clearStampsFromUI(){
  Array.from(cardContainer.querySelectorAll('.stamp')).forEach(n=>n.remove());
}
