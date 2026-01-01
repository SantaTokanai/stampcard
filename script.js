import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

/* Firebase */
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

/* DOM */
const nicknameInput = document.getElementById('nickname');
const passInput = document.getElementById('password');
const loginBtn = document.getElementById('login');
const signupBtn = document.getElementById('signup');
const logoutBtn = document.getElementById('logout');
const keywordSec = document.getElementById('keyword-section');
const stampBtn = document.getElementById('stampBtn');
const keywordInput = document.getElementById('keyword');
const errorMsg = document.getElementById('error-msg');

const cardContainer = document.getElementById('card-container');
const cardBg = document.getElementById('card-bg');

const nicknameDisplay = document.getElementById('nickname-display');
const totalPointEl = document.getElementById('total-point');
const colorPointEl = document.getElementById('color-point');

/* ログイン */
loginBtn.onclick = async () => {
  const nick = nicknameInput.value.trim();
  const pass = passInput.value;
  const snap = await getDoc(doc(db, 'users', nick));
  if (!snap.exists()) return errorMsg.textContent = 'ユーザーが存在しません';

  const d = snap.data();
  if (!d.password) return;
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pass));
  const hex = Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');
  if (hex !== d.password) return errorMsg.textContent = 'パスワードが違います';

  nicknameInput.style.display = 'none';
  passInput.style.display = 'none';
  loginBtn.style.display = 'none';
  signupBtn.style.display = 'none';
  logoutBtn.style.display = 'inline-block';
  keywordSec.style.display = 'block';

  nicknameDisplay.textContent = nick;
  totalPointEl.textContent = d.totalPoint ?? 0;
  colorPointEl.textContent = d.colorsingPoint ?? 0;

  await loadStamps(nick);
};

/* スタンプ描画（最重要） */
async function loadStamps(nick) {
  clearStamps();

  const userSnap = await getDoc(doc(db, 'users', nick));
  if (!userSnap.exists()) return;
  const userData = userSnap.data();

  // 背景画像の読み込み完了を待つ
  if (!cardBg.complete) {
    await new Promise(resolve => cardBg.onload = resolve);
  }

  const w = cardBg.offsetWidth;
  const h = cardBg.offsetHeight;

  for (const key of Object.keys(userData)) {
    if (userData[key] !== true) continue;

    const kwSnap = await getDoc(doc(db, 'keywords', key));
    if (!kwSnap.exists()) continue;

    const k = kwSnap.data();
    const img = new Image();
    img.className = 'stamp';
    img.src = k.img;

    img.style.left = (k.x * w) + 'px';
    img.style.top = (k.y * h) + 'px';
    img.style.width = (k.widthPercent * w) + 'px';

    cardContainer.appendChild(img);
  }
}

function clearStamps() {
  cardContainer.querySelectorAll('.stamp').forEach(e => e.remove());
}
