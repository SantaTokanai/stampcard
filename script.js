// script.js (module)
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

// DOM 要素
const authSection = document.getElementById('auth-section');
const nicknameInput = document.getElementById('nickname');
const passInput = document.getElementById('password');
const signupBtn = document.getElementById('signup');
const loginBtn = document.getElementById('login');
const logoutBtn = document.getElementById('logout');
const errorMsg = document.getElementById('error-msg');

const secretSec = document.getElementById('secret-section');
const secretQInput = document.getElementById('secretQ');
const secretAInput = document.getElementById('secretA');

const forgotLink = document.getElementById('forgot-password');
const resetSection = document.getElementById('reset-section');
const resetNickname = document.getElementById('reset-nickname');
const resetStartBtn = document.getElementById('reset-start');
const resetQuestionDiv = document.getElementById('reset-question');
const showQuestionDiv = document.getElementById('show-question');
const resetAnswerInput = document.getElementById('reset-answer');
const resetNewPass = document.getElementById('reset-newpass');
const resetSubmitBtn = document.getElementById('reset-submit');

const keywordSec = document.getElementById('keyword-section');
const keywordInput = document.getElementById('keyword');
const stampBtn = document.getElementById('stampBtn');

const cardContainer = document.getElementById('card-container');
const cardBg = document.querySelector('.card-bg');

let currentUser = null;

// ユーティリティ
function showMessage(msg = '', type = 'error') {
  errorMsg.textContent = msg;
  if (type === 'success') errorMsg.classList.add('success');
  else errorMsg.classList.remove('success');
}

function hashPassword(pw) {
  return (typeof sha256 === 'function') ? sha256(pw) : '';
}

function clearStamps() {
  document.querySelectorAll('#card-container .stamp').forEach(e => e.remove());
}

async function waitForCardReady(timeout = 2000, interval = 50) {
  const start = performance.now();
  while (cardContainer.clientHeight === 0 && (performance.now() - start) < timeout) {
    await new Promise(r => setTimeout(r, interval));
  }
}

// ---------------- 新規登録 ----------------
signupBtn.addEventListener('click', async () => {
  if (!secretSec || secretSec.style.display === 'none' || secretSec.style.display === '') {
    secretSec.style.display = 'flex';
    showMessage('秘密の質問と答えを入力してから再度「新規登録」を押してください');
    return;
  }
  const nickname = nicknameInput.value.trim();
  const password = passInput.value;
  const secretQ = secretQInput.value.trim();
  const secretA = secretAInput.value.trim();
  if (!nickname || !password || !secretQ || !secretA) { showMessage('全て入力してください'); return; }

  const userRef = doc(db, 'users', nickname);
  const snap = await getDoc(userRef);
  if (snap.exists()) { showMessage('そのニックネームは既に使用されています'); return; }

  await setDoc(userRef, {
    password: hashPassword(password),
    secretQ, secretA
  }, { merge: true });

  currentUser = nickname;
  authSection.style.display = 'none';
  logoutBtn.style.display = 'inline-block';
  keywordSec.style.display = 'block';
  secretSec.style.display = 'none';
  showMessage('登録しました', 'success');
  loadStamps(currentUser);
});

// ---------------- ログイン ----------------
loginBtn.addEventListener('click', async () => {
  const nickname = nicknameInput.value.trim();
  const password = passInput.value;
  if (!nickname || !password) { showMessage('ニックネームとパスワードを入力'); return; }

  const userRef = doc(db, 'users', nickname);
  const snap = await getDoc(userRef);
  if (!snap.exists()) { showMessage('ユーザーが存在しません'); return; }

  const data = snap.data();
  if (data.password !== hashPassword(password)) { showMessage('パスワードが違います'); return; }

  currentUser = nickname;
  authSection.style.display = 'none';
  logoutBtn.style.display = 'inline-block';
  keywordSec.style.display = 'block';
  secretSec.style.display = 'none';
  showMessage('ログインしました', 'success');
  loadStamps(currentUser);
});

// ---------------- ログアウト ----------------
logoutBtn.addEventListener('click', () => {
  currentUser = null;
  authSection.style.display = 'flex';
  logoutBtn.style.display = 'none';
  keywordSec.style.display = 'none';
  secretSec.style.display = 'none';
  resetSection.style.display = 'none';
  resetQuestionDiv.style.display = 'none';
  clearStamps();
  showMessage('');
});

// ---------------- パスワードリセット ----------------
forgotLink.addEventListener('click', e => {
  e.preventDefault();
  resetSection.style.display = 'block';
  resetQuestionDiv.style.display = 'none';
});

resetStartBtn.addEventListener('click', async () => {
  const nick = resetNickname.value.trim();
  if (!nick) { showMessage('ニックネームを入力してください'); return; }
  const userSnap = await getDoc(doc(db, 'users', nick));
  if (!userSnap.exists()) { showMessage('ユーザーが存在しません'); return; }
  const data = userSnap.data();
  showQuestionDiv.textContent = data.secretQ;
  resetQuestionDiv.style.display = 'block';
});

resetSubmitBtn.addEventListener('click', async () => {
  const nick = resetNickname.value.trim();
  const ans = resetAnswerInput.value.trim();
  const newPass = resetNewPass.value;
  if (!nick || !ans || !newPass) { showMessage('すべて入力してください'); return; }
  const userRef = doc(db, 'users', nick);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) { showMessage('ユーザーが存在しません'); return; }
  const data = userSnap.data();
  if (data.secretA !== ans) { showMessage('答えが違います'); return; }
  await setDoc(userRef, { password: hashPassword(newPass) }, { merge: true });
  showMessage('パスワードを更新しました', 'success');
  resetSection.style.display = 'none';
  resetQuestionDiv.style.display = 'none';
});

// ---------------- スタンプ押下 ----------------
stampBtn.addEventListener('click', async () => {
  if (!currentUser) { showMessage('ログインしてください'); return; }
  const keyword = keywordInput.value.trim();
  if (!keyword) { showMessage('合言葉を入力してください'); return; }

  const kwRef = doc(db, 'keywords', keyword);
  const kwSnap = await getDoc(kwRef);
  if (!kwSnap.exists()) { showMessage('その合言葉は存在しません'); return; }

  await setDoc(doc(db, 'users', currentUser), { [keyword]: true }, { merge: true });
  showMessage('スタンプを押しました', 'success');
  loadStamps(currentUser);
});

// ---------------- スタンプ描画（位置・サイズ修正） ----------------
async function loadStamps(uid) {
  clearStamps();
  if (!uid) return;

  await waitForCardReady();

  const w = cardContainer.clientWidth;
  const h = cardContainer.clientHeight;

  const userSnap = await getDoc(doc(db, 'users', uid));
  if (!userSnap.exists()) return;
  const userData = userSnap.data();

  for (const key of Object.keys(userData)) {
    if (['password', 'secretQ', 'secretA'].includes(key)) continue;

    const kwSnap = await getDoc(doc(db, 'keywords', key));
    if (!kwSnap.exists()) continue;
    const d = kwSnap.data();

    const imgSrc = d.img;
    const wPercent = Number(d.widthPercent);
    const x = Number(d.x);
    const y = Number(d.y);
    if (!imgSrc || isNaN(wPercent) || isNaN(x) || isNaN(y)) continue;

    const img = new Image();
    img.className = 'stamp';
    img.style.position = 'absolute';
    img.style.transform = 'translate(-50%, -50%)';
    img.style.left = `${x * w}px`;      // ← ここが重要
    img.style.top  = `${y * h}px`;      // ← ここが重要
    img.style.width = `${wPercent * w}px`;

    img.onload = () => cardContainer.appendChild(img);
    img.src = imgSrc;
  }
}
