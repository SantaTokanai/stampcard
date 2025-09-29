import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ---- Firebase設定（あなたのプロジェクト用）----
const firebaseConfig = {
  apiKey: "AIzaSyBI_XbbC78cXCBmm6ue-h0HJ15dNsDAnzo",
  authDomain: "stampcard-project.firebaseapp.com",
  projectId: "stampcard-project",
  storageBucket: "stampcard-project.appspot.com",
  messagingSenderId: "808808121881",
  appId: "1:808808121881:web:57f6d536d40fc2d30fcc88"
};
// -----------------------------------------------

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- DOM要素 ---
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
const cardContainer = document.getElementById('card-container');

let currentUser = null;

// ---- 画面切り替え ----
function showMain() {
  document.getElementById('auth-section').style.display = 'none';
  document.getElementById('logout').style.display = 'block';
  document.getElementById('keyword-section').style.display = 'block';
}

function showAuth() {
  document.getElementById('auth-section').style.display = 'flex';
  document.getElementById('logout').style.display = 'none';
  document.getElementById('keyword-section').style.display = 'none';
}

// ---- サインアップ処理 ----
signupBtn.onclick = () => {
  secretSection.style.display = 'flex'; // 質問欄を表示
};

// 秘密の質問＋登録
secretAInput.addEventListener('keypress', async (e) => {
  if (e.key === 'Enter') await registerUser();
});

async function registerUser() {
  const nickname = nicknameInput.value.trim();
  const password = passwordInput.value.trim();
  const secretQ = secretQInput.value.trim();
  const secretA = secretAInput.value.trim();
  if (!nickname || !password || !secretQ || !secretA) {
    alert("全て入力してください");
    return;
  }

  const ref = doc(db, "users", nickname);
  await setDoc(ref, { password, secretQ, secretA });
  currentUser = nickname;
  showMain();
  loadStamps();
}

// ---- ログイン ----
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

// ---- ログアウト ----
logoutBtn.onclick = () => {
  currentUser = null;
  showAuth();
  clearStampsFromUI();
};

// ---- スタンプ押印 ----
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

// ---- UIクリア ----
function clearStampsFromUI() {
  document.querySelectorAll('.stamp').forEach(el => el.remove());
}

// ---- スタンプ読込 ----
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
    imgEl.style.position = 'absolute';
    imgEl.style.transform = 'translate(-50%, -50%)';
    cardContainer.appendChild(imgEl);
  }
}

// ---- 初期表示 ----
showAuth();
