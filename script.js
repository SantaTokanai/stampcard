// script.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

/* ===== Firebase Config ===== */
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

/* ===== DOM ===== */
const cardContainer = document.getElementById("card-container");

/* ===== 表示設定（後から調整可能） ===== */
const DISPLAY_CONFIG = {
  nickname: {
    topPercent: 0.05,
    fontSize: "20px"
  },
  points: {
    topPercent: 0.92,
    fontSize: "16px",
    gapPx: 20
  }
};

/* ===== 初期化 ===== */
window.addEventListener("DOMContentLoaded", async () => {
  // 確認用：yu 固定（今まで通り）
  await renderUserCard("yu");
});

/* ===== メイン処理 ===== */
async function renderUserCard(nickname) {
  clearStamps();

  const userRef = doc(db, "users", nickname);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return;

  const userData = userSnap.data();

  renderNickname(nickname);
  renderPoints(userData);

  for (const key of Object.keys(userData)) {
    if (userData[key] === true) {
      await renderStampByKeyword(key);
    }
  }
}

/* ===== スタンプ描画 ===== */
async function renderStampByKeyword(keywordId) {
  const kwRef = doc(db, "keywords", keywordId);
  const kwSnap = await getDoc(kwRef);
  if (!kwSnap.exists()) return;

  const { img, x, y, widthPercent } = kwSnap.data();

  const cardW = cardContainer.clientWidth;
  const cardH = cardContainer.clientHeight;

  if (!cardW || !cardH) return;

  const size = cardW * widthPercent;
  const left = cardW * x - size / 2;
  const top = cardH * y - size / 2;

  const stamp = document.createElement("img");
  stamp.src = img;
  stamp.className = "stamp";
  stamp.style.position = "absolute";
  stamp.style.width = `${size}px`;
  stamp.style.left = `${left}px`;
  stamp.style.top = `${top}px`;

  cardContainer.appendChild(stamp);
}

/* ===== ニックネーム ===== */
function renderNickname(name) {
  const el = document.createElement("div");
  el.textContent = name;
  el.style.position = "absolute";
  el.style.top = `${DISPLAY_CONFIG.nickname.topPercent * 100}%`;
  el.style.width = "100%";
  el.style.textAlign = "center";
  el.style.fontSize = DISPLAY_CONFIG.nickname.fontSize;
  el.style.fontWeight = "bold";
  cardContainer.appendChild(el);
}

/* ===== ポイント ===== */
function renderPoints(data) {
  const values = [
    data.totalPoint ?? 0,
    data.coloringPoint ?? data.colorsingPoint ?? 0
  ];

  values.forEach((val, idx) => {
    const el = document.createElement("div");
    el.textContent = val;
    el.style.position = "absolute";
    el.style.top = `${DISPLAY_CONFIG.points.topPercent * 100}%`;
    el.style.left = `calc(50% + ${(idx - 0.5) * DISPLAY_CONFIG.points.gapPx}px)`;
    el.style.transform = "translateX(-50%)";
    el.style.fontSize = DISPLAY_CONFIG.points.fontSize;
    cardContainer.appendChild(el);
  });
}

/* ===== クリア ===== */
function clearStamps() {
  cardContainer.querySelectorAll(".stamp, div
