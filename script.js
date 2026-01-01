import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBI_XbbC78cXCBmm6ue-h0HJ15dNsDAnzo",
  authDomain: "stampcard-project.firebaseapp.com",
  projectId: "stampcard-project"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ===== DOM ===== */
const nicknameInput = document.getElementById('nickname');
const passInput = document.getElementById('password');
const loginBtn = document.getElementById('login');
const signupBtn = document.getElementById('signup');
const logoutBtn = document.getElementById('logout');
const keywordSec = document.getElementById('keyword-section');

const dispNick = document.getElementById('display-nickname');
const dispColor = document.getElementById('display-colorsing');
const dispTotal = document.getElementById('display-total');

const cardContainer = document.getElementById('card-container');
const passwordMsg = document.getElementById('password-msg');

/* ===== HASH ===== */
async function hashPassword(str){
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(str)
  );
  return [...new Uint8Array(buf)]
    .map(b => b.toString(16).padStart(2,'0'))
    .join('');
}

/* ===== LOGIN ===== */
loginBtn.onclick = async () => {
  const nick = nicknameInput.value.trim();
  const pw = passInput.value;

  const snap = await getDoc(doc(db,'users',nick));
  if(!snap.exists()) {
    alert('ユーザーが存在しません');
    return;
  }

  if(await hashPassword(pw) !== snap.data().password) {
    alert('パスワードが違います');
    return;
  }

  /* UI 切り替え */
  nicknameInput.style.display = 'none';
  passInput.style.display = 'none';
  loginBtn.style.display = 'none';
  signupBtn.style.display = 'none';
  passwordMsg.style.display = 'none';

  logoutBtn.style.display = 'inline-block';
  keywordSec.style.display = 'block';

  await loadUserTexts(nick);
  await loadStamps(nick);
};

/* ===== USER TEXT ===== */
async function loadUserTexts(nick){
  const snap = await getDoc(doc(db,'users',nick));
  if(!snap.exists()) return;

  const d = snap.data();
  dispNick.textContent = nick;
  dispColor.textContent = `colorsing: ${Number(d.colorsingPoint || 0)}`;
  dispTotal.textContent = `total: ${Number(d.totalPoint || 0)}`;
}

/* ===== STAMP RENDER ===== */
async function loadStamps(uid){
  cardContainer.querySelectorAll('.stamp').forEach(e => e.remove());

  const userSnap = await getDoc(doc(db,'users',uid));
  if(!userSnap.exists()) return;

  const userData = userSnap.data();
  const rect = cardContainer.getBoundingClientRect();
  const baseSize = rect.width;

  for(const key of Object.keys(userData)){
    /* 明示的に除外するフィールド */
    if([
      'password',
      'secretQuestion',
      'secretAnswerHash',
      'colorsingPoint',
      'totalPoint'
    ].includes(key)) continue;

    /* keywords に存在するものだけ描画 */
    const kwSnap = await getDoc(doc(db,'keywords',key));
    if(!kwSnap.exists()) continue;

    const d = kwSnap.data();

    const img = document.createElement('img');
    img.className = 'stamp';
    img.src = d.img;

    img.style.left  = (d.x * baseSize) + 'px';
    img.style.top   = (d.y * baseSize) + 'px';
    img.style.width = (d.widthPercent * baseSize) + 'px';

    cardContainer.appendChild(img);
  }
}
