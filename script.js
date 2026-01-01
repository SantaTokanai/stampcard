// script.js (module / 完全版)

// ================================
// Firebase SDK
// ================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// ================================
// Firebase config（そのまま）
// ================================
const firebaseConfig = {
  apiKey: "AIzaSyBI_XbbC78cXCBmm6ue-h0HJ15dNsDAnzo",
  authDomain: "stampcard-project.firebaseapp.com",
  projectId: "stampcard-project",
  storageBucket: "stampcard-project.firebasestorage.app",
  messagingSenderId: "808808121881",
  appId: "1:808808121881:web:57f6d536d40fc2d30fcc88"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ================================
// 表示調整用定数（後で変更可能）
// ================================
const NICKNAME_TOP_PX = 16;
const NICKNAME_FONT_SIZE = "20px";

const POINT_BOTTOM_PX = 16;
const POINT_FONT_SIZE = "16px";

// ================================
// DOM
// ================================
const $ = (id) => document.getElementById(id);

const loginPanel   = $("login-panel");
const cardArea     = $("card-area");
const cardContainer= $("card-container");

const emailInput   = $("email");
const passwordInput= $("password");
const loginBtn     = $("login");
const logoutBtn    = $("logout");

const nicknameEl   = $("nickname");
const point1El     = $("point1");
const point2El     = $("point2");

// ================================
// 初期化
// ================================
window.addEventListener("DOMContentLoaded", () => {
  loginBtn?.addEventListener("click", onLogin);
  logoutBtn?.addEventListener("click", onLogout);

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      showLoginUI();
      return;
    }

    hideLoginUI();

    // ※ users のドキュメントIDは nickname（例: yu）
    // Firebase Auth の uid は使っていない前提
    const nickname = user.email?.split("@")[0] || "yu";

    await loadUserAndRender(nickname);
  });
});

// ================================
// UI制御
// ================================
function showLoginUI() {
  loginPanel.style.display = "block";
  cardArea.style.display = "none";
}

function hideLoginUI() {
  loginPanel.style.display = "none";
  cardArea.style.display = "block";
}

function clearStamps() {
  cardContainer.querySelectorAll(".stamp").forEach(e => e.remove());
}

// ================================
// 認証
// ================================
async function onLogin() {
  const email = emailInput.value.trim();
  const pw    = passwordInput.value;

  if (!email || !pw) return;

  await signInWithEmailAndPassword(auth, email, pw);
}

async function onLogout() {
  await signOut(auth);
}

// ================================
// メイン処理（最重要）
// ================================
async function loadUserAndRender(userDocId) {
  clearStamps();

  // ---------- users ----------
  const userRef = doc(db, "users", userDocId);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return;

  const userData = userSnap.data();

  // ---------- 表示 ----------
  nicknameEl.textContent = userDocId;
  nicknameEl.style.top = NICKNAME_TOP_PX + "px";
  nicknameEl.style.fontSize = NICKNAME_FONT_SIZE;

  point1El.textContent = `colorsingPoint: ${userData.coloringPoint ?? userData.colorsingPoint ?? 0}`;
  point2El.textContent = `totalPoint: ${userData.totalPoint ?? 0}`;

  point1El.style.bottom = POINT_BOTTOM_PX + "px";
  point2El.style.bottom = (POINT_BOTTOM_PX + 20) + "px";
  point1El.style.fontSize = POINT_FONT_SIZE;
  point2El.style.fontSize = POINT_FONT_SIZE;

  // ---------- keywords ----------
  const kwSnap = await getDocs(collection(db, "keywords"));

  kwSnap.forEach((kwDoc) => {
    const key = kwDoc.id;

    // users 側が true のものだけ描画
    if (userData[key] !== true) return;

    const { img, x, y, widthPercent } = kwDoc.data();
    if (!img || x == null || y == null || widthPercent == null) return;

    renderStamp(img, x, y, widthPercent);
  });
}

// ================================
// スタンプ描画（ここが核心）
// ================================
function renderStamp(imgPath, x, y, widthPercent) {
  const img = document.createElement("img");
  img.className = "stamp";
  img.src = imgPath;

  const w = cardContainer.clientWidth;
  const h = cardContainer.clientHeight;

  img.style.position = "absolute";
  img.style.width = (w * widthPercent) + "px";
  img.style.left  = (w * x) + "px";
  img.style.top   = (h * y) + "px";

  cardContainer.appendChild(img);
}
