import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  // あなたの Firebase 設定
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const nicknameInput = document.getElementById('nickname');
const passwordInput = document.getElementById('password');
const signupBtn = document.getElementById('signup');
const loginBtn = document.getElementById('login');
const logoutBtn = document.getElementById('logout');
const keywordInput = document.getElementById('keyword');
const stampBtn = document.getElementById('stampBtn');
const secretSection = document.getElementById('secret-section');
const secretQInput = document.getElementById('secretQ');
const secretAInput = document.getElementById('secretA');
const registerSecretBtn = document.getElementById('registerSecret');
const cardContainer = document.getElementById('card-container');

let currentUser = null;

function showMain() {
  document.getElementById('auth-section').classList.add('hidden');
  document.getElementById('main-section').classList.remove('hidden');
}

function showAuth() {
  document.getElementById('main-section').classList.add('hidden');
  document.getElementById('auth-section').classList.remove('hidden');
}

signupBtn.onclick = () => {
  secretSection.classList.remove('hidden');
};

registerSecretBtn.onclick = async () => {
  const nickname = nicknameInput.value.trim();
  const password = passwordInput.value.trim();
  const secretQ = secretQInput.value.trim();
  const secretA = secretAInput.value.trim();
  if (!nickname || !password || !secretQ || !secretA) return alert("全て入力してください");

  const ref = doc(db, "users", nickname);
  await setDoc(ref, { password, secretQ, secretA });
  currentUser = nickname;
  showMain();
  loadStamps();
};

loginBtn.onclick = async () => {
  const nickname = nicknameInput.value.trim();
  const password = passwordInput.value.trim();
  if (!nickname || !password) return alert("入力してください");

  const ref = doc(db, "users", nickname);
  const snap = await getDoc(ref);
  if (!snap.exists() || snap.data().password !== password) {
    alert("認証失敗");
    return;
  }
  currentUser = nickname;
  showMain();
  loadStamps();
};

logoutBtn.onclick = () => {
  currentUser = null;
  showAuth();
  clearStampsFromUI();
};

function clearStampsFromUI() {
  document.querySelectorAll('.stamp').forEach(el => el.remove());
}

stampBtn.onclick = async () => {
  if (!currentUser) return;
  const kw = keywordInput.value.trim();
  if (!kw) return;
  const kwSnap = await getDoc(doc(db, "keywords", kw));
  if (!kwSnap.exists()) {
    alert("キーワードがありません");
    return;
  }
  await updateDoc(doc(db, "users", currentUser), { [kw]: true });
  loadStamps();
};

async function loadStamps() {
  if (!currentUser) return;
  clearStampsFromUI();
  const userSnap = await getDoc(doc(db, "users", currentUser));
  if (!userSnap.exists()) return;

  const userData = userSnap.data();
  const cardWidth = cardContainer.clientWidth;
  const cardHeight = cardContainer.clientHeight;

  for (const key of Object.keys(userData)) {
    if (['password', 'secretQ', 'secretA'].includes(key)) continue;

    const kwSnap = await getDoc(doc(db, 'keywords', key));
    if (!kwSnap.exists()) continue;

    const kwData = kwSnap.data();
    // ✅ Firestoreの数値フィールドを安全に取得
    const imgSrc = kwData.img;
    const x = parseFloat(kwData.x);
    const y = parseFloat(kwData.y);
    const wPct = parseFloat(kwData.widthPercent);

    if (isNaN(x) || isNaN(y) || isNaN(wPct) || !imgSrc) {
      console.warn("無効なスタンプデータ:", key, kwData);
      continue;
    }

    const imgEl = document.createElement('img');
    imgEl.src = imgSrc;
    imgEl.className = 'stamp';
    imgEl.style.width = `${wPct * cardWidth}px`;
    imgEl.style.left  = `${x * cardWidth}px`;
    imgEl.style.top   = `${y * cardHeight}px`;
    cardContainer.appendChild(imgEl);
  }
}

// 初期表示
showAuth();
