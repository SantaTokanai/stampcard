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
  getDoc,
  setDoc,
  updateDoc
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
const loginMessage = document.getElementById('login-message');
const logoutBtn  = document.getElementById('logout-btn');
const keywordSection = document.getElementById('keyword-section');
const keywordInput = document.getElementById('keyword');
const stampBtn = document.getElementById('stamp-btn');
const cardContainer = document.getElementById('card-container');

/* ===== 合言葉とスタンプ位置の対応 ===== */
const stampMapping = {
  "Apple": {img:'images/stamp1.png', x:0.2, y:0.25, widthPercent:0.15},
  "Banana": {img:'images/stamp2.png', x:0.5, y:0.25, widthPercent:0.15},
  "Cherry": {img:'images/stamp3.png', x:0.8, y:0.25, widthPercent:0.15}
};

/* ===== 認証 ===== */
function showLoginError(msg){
  loginMessage.textContent = msg;
}

signupBtn.addEventListener('click', async () => {
  try {
    await createUserWithEmailAndPassword(auth, emailInput.value, passInput.value);
    showLoginError('');
  } catch(e){
    showLoginError('メールアドレスまたはパスワードが正しくありません');
  }
});

loginBtn.addEventListener('click', async () => {
  try {
    await signInWithEmailAndPassword(auth, emailInput.value, passInput.value);
    showLoginError('');
  } catch(e){
    showLoginError('メールアドレスまたはパスワードが正しくありません');
  }
});

logoutBtn.addEventListener('click', async () => {
  await signOut(auth);
});

/* ===== 認証状態監視 ===== */
onAuthStateChanged(auth, user => {
  if(user){
    // UI制御
    document.getElementById('auth-section').style.display = 'none';
    logoutBtn.style.display = 'inline-block';
    keywordSection.style.display = 'block';

    // 既存スタンプ読み込み
    loadStamps(user.uid);
  } else {
    document.getElementById('auth-section').style.display = 'block';
    logoutBtn.style.display = 'none';
    keywordSection.style.display = 'none';
    clearStampsFromUI();
  }
});

/* ===== スタンプ押下 ===== */
stampBtn.addEventListener('click', async () => {
  const user = auth.currentUser;
  if(!user) return;

  const keyword = keywordInput.value.trim();
  if(!stampMapping[keyword]){
    alert('合言葉が正しくありません');
    return;
  }

  const pos = stampMapping[keyword];
  renderStamp(pos);

  // Firebaseに保存
  const userDocRef = doc(db,'users',user.uid);
  const snap = await getDoc(userDocRef);
  const data = snap.exists() ? snap.data() : {};
  data[keyword] = true; // 日付なし
  await setDoc(userDocRef, data);
});

/* ===== スタンプ描画 ===== */
function renderStamp(pos){
  const img = document.createElement('img');
  img.src = pos.img;
  img.className = 'stamp';

  const w = cardContainer.clientWidth;
  const h = cardContainer.clientHeight;

  img.style.left = (pos.x * w) + 'px';
  img.style.top  = (pos.y * h) + 'px';
  img.style.width = (pos.widthPercent * w) + 'px';

  cardContainer.appendChild(img);
}

async function loadStamps(uid){
  clearStampsFromUI();
  const userDocRef = doc(db,'users',uid);
  const snap = await getDoc(userDocRef);
  if(snap.exists()){
    const data = snap.data();
    Object.keys(data).forEach(key => {
      if(data[key] && stampMapping[key]){
        renderStamp(stampMapping[key]);
      }
    });
  }
}

function clearStampsFromUI(){
  Array.from(cardContainer.querySelectorAll('.stamp')).forEach(n=>n.remove());
}
