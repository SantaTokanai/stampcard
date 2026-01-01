// script.js（完全版）

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInAnonymously,
  signOut
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

/* ===== Firebase ===== */
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

/* ===== DOM ===== */
const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");
const loginBtn = document.getElementById("login");
const anonBtn = document.getElementById("anon");
const logoutBtn = document.getElementById("logout");

const loginPanel = document.getElementById("login-panel");
const cardArea = document.getElementById("card-area");
const cardContainer = document.getElementById("card-container");

/* ===== 表示設定（後で変更可） ===== */
const DISPLAY = {
  nicknameTop: 0.05,
  nicknameSize: "20px",
  pointTop: 0.92,
  pointSize: "16px",
  pointGap: 30
};

/* ===== イベント ===== */
loginBtn.addEventListener("click", async () => {
  await signInWithEmailAndPassword(
    auth,
    emailEl.value.trim(),
    passwordEl.value
  );
});

anonBtn.addEventListener("click", async () => {
  await signInAnonymously(auth);
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

/* ===== 認証監視 ===== */
onAuthStateChanged(auth, async user => {
  if (!user) {
    loginPanel.style.display = "block";
    cardArea.style.display = "none";
    clearCard();
    return;
  }

  loginPanel.style.display = "none";
  cardArea.style.display = "block";

  // ★ users の Document ID = ニックネーム
  // email ログインの場合、users に email 名が無い前提
  // → 表示確認用に "yu" を使用（既存仕様）
  await renderCard("yu");
});

/* ===== メイン描画 ===== */
async function renderCard(nickname) {
  clearCard();

  const userSnap = await getDoc(doc(db, "users", nickname));
  if (!userSnap.exists()) return;

  const data = userSnap.data();

  renderNickname(nickname);
  renderPoints(data);

  for (const key in data) {
    if (data[key] === true) {
      await renderStamp(key);
    }
  }
}

/* ===== スタンプ ===== */
async function renderStamp(keywordId) {
  const kwSnap = await getDoc(doc(db, "keywords", keywordId));
  if (!kwSnap.exists()) return;

  const { img, x, y, widthPercent } = kwSnap.data();
  const w = cardContainer.clientWidth;
  const h = cardContainer.clientHeight;
  if (!w || !h) return;

  const size = w * widthPercent;
  const left = w * x - size / 2;
  const top = h * y - size / 2;

  const imgEl = document.createElement("img");
  imgEl.src = img;
  imgEl.className = "stamp";
  imgEl.style.position = "absolute";
  imgEl.style.width = `${size}px`;
  imgEl.style.left = `${left}px`;
  imgEl.style.top = `${top}px`;

  cardContainer.appendChild(imgEl);
}

/* ===== ニックネーム ===== */
function renderNickname(name) {
  const el = document.createElement("div");
  el.textContent = name;
  el.style.position = "absolute";
  el.style.top = `${DISPLAY.nicknameTop * 100}%`;
  el.style.width = "100%";
  el.style.textAlign = "center";
  el.style.fontSize = DISPLAY.nicknameSize;
  el.style.fontWeight = "bold";
  cardContainer.appendChild(el);
}

/* ===== ポイント ===== */
function renderPoints(data) {
  const points = [
    data.totalPoint ?? 0,
    data.colorsingPoint ?? 0
  ];

  points.forEach((val, i) => {
    const el = document.createElement("div");
    el.textContent = val;
    el.style.position = "absolute";
    el.style.top = `${DISPLAY.pointTop * 100}%`;
    el.style.left = `calc(50% + ${(i - 0.5) * DISPLAY.pointGap}px)`;
    el.style.transform = "translateX(-50%)";
    el.style.fontSize = DISPLAY.pointSize;
    cardContainer.appendChild(el);
  });
}

/* ===== クリア ===== */
function clearCard() {
  cardContainer.innerHTML = "";
}
