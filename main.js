// main.js (module)
// ---------- Firebase SDK のモジュールを読み込む ----------
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signInAnonymously,
  signOut
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

/* ====== ここに Firebase コンソールで取得した config オブジェクトを貼ってください ======
例:
const firebaseConfig = {
  apiKey: "XXXXXXXXXXXX",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};
==================================================================================== */
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

/* ---------- DOM参照 ---------- */
const emailInput = () => document.getElementById('email');
const passwordInput = () => document.getElementById('password');
const signupBtn = () => document.getElementById('signup');
const loginBtn = () => document.getElementById('login');
const anonBtn = () => document.getElementById('anon');
const logoutBtn = () => document.getElementById('logout');
const cardArea = () => document.getElementById('card-area');
const cardContainer = () => document.getElementById('card-container');
const keywordInput = () => document.getElementById('keyword');
const stampBtn = () => document.getElementById('stampBtn');
const messageDiv = () => document.getElementById('message');

window.addEventListener('DOMContentLoaded', () => {
  // ボタンイベント
  signupBtn().addEventListener('click', onSignup);
  loginBtn().addEventListener('click', onLogin);
  anonBtn().addEventListener('click', onAnon);
  logoutBtn().addEventListener('click', onLogout);
  stampBtn().addEventListener('click', onStamp);

  onAuthStateChanged(auth, user => {
    if (user) {
      showMessage('ログイン中: ' + (user.email || '(匿名)'));
      showCardArea(true);
      loadStamps(user.uid).catch(e => showMessage(e.message));
      logoutBtn().style.display = 'inline-block';
    } else {
      showMessage('未ログイン');
      showCardArea(false);
      logoutBtn().style.display = 'none';
      clearStampsFromUI();
    }
  });
});

/* ---------- UI 関数 ---------- */
function showMessage(msg) { messageDiv().textContent = msg; }
function showCardArea(show) {
  document.getElementById('login-panel').style.display = show ? 'none' : 'block';
  cardArea().style.display = show ? 'block' : 'none';
}

/* ---------- 認証処理 ---------- */
async function onSignup() {
  const email = emailInput().value.trim();
  const pw = passwordInput().value;
  if (!email || !pw) { alert('メールとパスワードを入力してください'); return; }
  try {
    await createUserWithEmailAndPassword(auth, email, pw);
    showMessage('新規登録に成功しました');
  } catch (e) {
    showMessage('登録エラー: ' + e.message);
  }
}

async function onLogin() {
  const email = emailInput().value.trim();
  const pw = passwordInput().value;
  if (!email || !pw) { alert('メールとパスワードを入力してください'); return; }
  try {
    await signInWithEmailAndPassword(auth, email, pw);
    showMessage('ログイン成功');
  } catch (e) {
    showMessage('ログイン失敗: ' + e.message);
  }
}

async function onAnon() {
  try {
    await signInAnonymously(auth);
    showMessage('匿名で利用中');
  } catch (e) {
    showMessage('匿名ログイン失敗: ' + e.message);
  }
}

async function onLogout() {
  await signOut(auth);
  showMessage('ログアウトしました');
}

/* ---------- スタンプ処理 ---------- */
function yyyyMMdd(d = new Date()) {
  return d.toISOString().slice(0,10);
}

async function onStamp() {
  const user = auth.currentUser;
  if (!user) { alert('ログインしてください'); return; }
  const kw = keywordInput().value.trim();
  if (!kw) { alert('合言葉を入力してください'); return; }

  const today = yyyyMMdd();
  // keywords コレクションから今日の合言葉を取得
  const kwDocRef = doc(db, 'keywords', today);
  const kwSnap = await getDoc(kwDocRef);
  if (!kwSnap.exists()) {
    alert('本日の合言葉が未設定です（管理者が設定してください）');
    return;
  }
  const data = kwSnap.data();
  if ((data.keyword || '') !== kw) {
    alert('合言葉が違います');
    return;
  }

  // 既に同日スタンプがあるかチェック
  const stampDocRef = doc(db, 'users', user.uid, 'stamps', today);
  const stampSnap = await getDoc(stampDocRef);
  if (stampSnap.exists()) { alert('本日はすでにスタンプ済みです'); return; }

  // 登録するスタンプ画像名（keywordsドキュメントに stamp フィールドがあればそれを使う）
  const stampImage = data.stamp || 'stamp1.png';

  // 保存（シンプルに client 時刻を使う）
  await setDoc(stampDocRef, {
    image: stampImage,
    date: today,
    createdAt: (new Date()).toISOString()
  });

  // UI 更新
  await loadStamps(user.uid);
  showMessage('スタンプを押しました！');
}

/* ---------- スタンプの読み込みと描画 ---------- */
async function loadStamps(uid) {
  clearStampsFromUI();
  const colRef = collection(db, 'users', uid, 'stamps');
  const snaps = await getDocs(colRef);
  const docs = [];
  snaps.forEach(d => docs.push({ id: d.id, data: d.data() }));
  // 日付順にソート（idがYYYY-MM-DDの形式であれば文字列ソートでOK）
  docs.sort((a,b) => a.id.localeCompare(b.id));
  if (docs.length === 0) return;
  // レイアウト：5列で配置
  const cols = 5;
  const total = docs.length;
  const rows = Math.ceil(total / cols);
  const container = cardContainer();
  const w = container.clientWidth;
  const h = container.clientHeight;
  const stampSize = Math.min(80, Math.floor(w / (cols + 1)));
  const spacingX = (w - cols * stampSize) / (cols + 1);
  const spacingY = (h - rows * stampSize) / (rows + 1);

  docs.forEach((docObj, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const left = Math.round(spacingX + col * (stampSize + spacingX));
    const top  = Math.round(spacingY + row * (stampSize + spacingY));
    renderStamp(left, top, stampSize, docObj.data.image);
  });
}

function renderStamp(left, top, size, filename) {
  const img = document.createElement('img');
  img.className = 'stamp';
  img.src = 'images/' + filename;
  img.style.left = left + 'px';
  img.style.top = top + 'px';
  img.style.width = size + 'px';
  img.style.height = size + 'px';
  cardContainer().appendChild(img);
}

function clearStampsFromUI() {
  const container = cardContainer();
  Array.from(container.querySelectorAll('.stamp')).forEach(n => n.remove());
}
