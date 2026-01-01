import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

/* ======================
   Firebase 初期化
====================== */
const firebaseConfig = {
  apiKey: "AIzaSyBI_XbbC78cXCBmm6ue-h0HJ15dNsDAnzo",
  authDomain: "stampcard-project.firebaseapp.com",
  projectId: "stampcard-project"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ======================
   DOM取得
====================== */
const nicknameInput = document.getElementById("nickname");
const passInput = document.getElementById("password");
const loginBtn = document.getElementById("login");
const signupBtn = document.getElementById("signup");
const logoutBtn = document.getElementById("logout");
const keywordSec = document.getElementById("keyword-section");

const dispNick = document.getElementById("display-nickname");
const dispColor = document.getElementById("display-colorsing");
const dispTotal = document.getElementById("display-total");

const passwordMsg = document.getElementById("password-msg");
const cardContainer = document.getElementById("card-container");

/* ======================
   共通関数
====================== */
async function hashPassword(str) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(str)
  );
  return [...new Uint8Array(buf)]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

/* ======================
   ログイン処理
====================== */
loginBtn.onclick = async () => {
  const nick = nicknameInput.value.trim();
  const pw = passInput.value;

  if (!nick || !pw) {
    alert("入力してください");
    return;
  }

  const userRef = doc(db, "users", nick);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    alert("ユーザーが存在しません");
    return;
  }

  const hashed = await hashPassword(pw);
  if (hashed !== snap.data().password) {
    alert("パスワードが違います");
    return;
  }

  /* UI切替（確実に不要表示を消す） */
  nicknameInput.style.display = "none";
  passInput.style.display = "none";
  loginBtn.style.display = "none";
  signupBtn.style.display = "none";
  passwordMsg.style.display = "none";

  logoutBtn.style.display = "inline-block";
  keywordSec.style.display = "block";

  await loadUserTexts(nick);
  await loadStamps(nick);
};

/* ======================
   ユーザー表示テキスト
====================== */
async function loadUserTexts(nick) {
  const snap = await getDoc(doc(db, "users", nick));
  if (!snap.exists()) return;

  const d = snap.data();

  dispNick.textContent = nick;
  dispColor.textContent = `colorsing: ${Number(d.colorsingPoint || 0)}`;
  dispTotal.textContent = `total: ${Number(d.totalPoint || 0)}`;
}

/* ======================
   スタンプ描画（完全修正版）
====================== */
async function loadStamps(nick) {
  /* 既存スタンプ削除 */
  cardContainer.querySelectorAll(".stamp").forEach(e => e.remove());

  const userSnap = await getDoc(doc(db, "users", nick));
  if (!userSnap.exists()) return;

  const userData = userSnap.data();

  /* keywords コレクションを基準にする（安全） */
  for (const key of Object.keys(userData)) {
    if (userData[key] !== true) continue;

    const kwSnap = await getDoc(doc(db, "keywords", key));
    if (!kwSnap.exists()) continue;

    const d = kwSnap.data();

    const img = document.createElement("img");
    img.className = "stamp";
    img.src = d.img;
    img.style.position = "absolute";
    img.style.left = (d.x * 500) + "px";
    img.style.top = (d.y * 500) + "px";
    img.style.width = (d.widthPercent * 500) + "px";

    cardContainer.appendChild(img);
  }
}
