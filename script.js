// Firebase 初期化
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword, // ★ 追加
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// Firebase 設定
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

// DOM 取得
const emailInput   = document.getElementById('email');
const passInput    = document.getElementById('password');
const loginBtn     = document.getElementById('login');
const logoutBtn    = document.getElementById('logout');
const signupBtn    = document.getElementById('signup'); // ★ 新規登録ボタン
const errorMsg     = document.getElementById('error-msg');
const keywordSec   = document.getElementById('keyword-section');
const keywordInput = document.getElementById('keyword');
const stampBtn     = document.getElementById('stampBtn');
const cardContainer = document.getElementById('card-container');
const cardImg       = document.querySelector('.card-bg');

// スタンプ位置を比率で定義（x,yは0~1）
const stampPositions = [
  {x:0.09, y:0.541, img:'images/stamp1.png', widthPercent:0.14},
  {x:0.25, y:0.541, img:'images/stamp2.png', widthPercent:0.14},
  {x:0.42, y:0.541, img:'images/stamp3.png', widthPercent:0.14},
  {x:0.585, y:0.541, img:'images/stamp4.png', widthPercent:0.14},
  {x:0.75, y:0.541, img:'images/stamp5.png', widthPercent:0.14},
  {x:0.915, y:0.541, img:'images/stamp6.png', widthPercent:0.14},
  {x:0.09, y:0.655, img:'images/stamp7.png', widthPercent:0.14},
  {x:0.25, y:0.655, img:'images/stamp8.png', widthPercent:0.14},
  {x:0.42, y:0.655, img:'images/stamp9.png', widthPercent:0.14},
  {x:0.585, y:0.655, img:'images/stamp10.png', widthPercent:0.14},
  {x:0.75, y:0.655, img:'images/stamp11.png', widthPercent:0.14},
  {x:0.915, y:0.655, img:'images/stamp12.png', widthPercent:0.14},
  {x:0.332, y:0.405, img:'images/stamp13.png', widthPercent:0.16},
  {x:0.69, y:0.405, img:'images/stamp14.png', widthPercent:0.16},
];

// エラーを日本語化
function getErrorMessageJP(error){
  switch (error.code) {
    case 'auth/invalid-email':      return 'メールアドレスの形式が正しくありません。';
    case 'auth/user-not-found':     return 'メールアドレスまたはパスワードが正しくありません';
    case 'auth/wrong-password':     return 'メールアドレスまたはパスワードが正しくありません';
    case 'auth/email-already-in-use': return 'このメールアドレスは既に登録されています';
    default:                        return 'エラーが発生しました：' + error.message;
  }
}

function showMessage(msg){
  errorMsg.textContent = msg;
}

// ★ 新規登録処理
signupBtn.addEventListener('click', async () => {
  const email = emailInput.value.trim();
  const pass  = passInput.value.trim();
  if (pass.length < 6) {
    showMessage('パスワードは6文字以上で入力してください');
    return;
  }
  try {
    await createUserWithEmailAndPassword(auth, email, pass);
    showMessage('アカウントを作成しました');
  } catch (err) {
    console.error(err);
    showMessage(getErrorMessageJP(err));
  }
});

// ログイン処理
loginBtn.addEventListener('click', () => {
  signInWithEmailAndPassword(auth, emailInput.value.trim(), passInput.value.trim())
    .then(() => showMessage(''))
    .catch(err => showMessage(getErrorMessageJP(err)));
});

// ログアウト処理
logoutBtn.addEventListener('click', async () => {
  await signOut(auth);
});

// 認証状態の監視
onAuthStateChanged(auth, user => {
  if(user){
    emailInput.style.display = 'none';
    passInput.style.display = 'none';
    loginBtn.style.display   = 'none';
    signupBtn.style.display  = 'none';  // ログイン後は非表示
    logoutBtn.style.display  = 'inline-block';
    keywordSec.style.display = 'block';
    loadStamps(user.uid);
  } else {
    emailInput.style.display = 'inline-block';
    passInput.style.display  = 'inline-block';
    loginBtn.style.display   = 'inline-block';
    signupBtn.style.display  = 'inline-block';
    logoutBtn.style.display  = 'none';
    keywordSec.style.display = 'none';
    clearStampsFromUI();
  }
});

// 「スタンプを押す」処理
stampBtn.addEventListener('click', async () => {
  const user = auth.currentUser;
  if(!user){ alert('ログインしてください'); return; }

  const keyword = keywordInput.value.trim();
  if(!keyword){ alert('合言葉を入力してください'); return; }

  // Firebase keywords コレクションから取得
  const kwDocRef = doc(db,'keywords',keyword);
  const kwSnap = await getDoc(kwDocRef);
  if(!kwSnap.exists()){ alert('その合言葉は存在しません'); return; }

  // ユーザードキュメントに保存
  const userDocRef = doc(db,'users',user.uid);
  await setDoc(userDocRef,{ [keyword]: true }, {merge:true});

  loadStamps(user.uid);
});

// スタンプ描画
async function loadStamps(uid){
  clearStampsFromUI();
  const userDocRef = doc(db,'users',uid);
  const snap = await getDoc(userDocRef);
  if(!snap.exists()) return;
  const data = snap.data();

  function renderAllStamps(){
    Object.keys(data).forEach((keyword, idx)=>{
      const pos = stampPositions[idx % stampPositions.length];
      const img = document.createElement('img');
      img.src = pos.img;
      img.className = 'stamp';
      const w = cardContainer.clientWidth;
      const h = cardContainer.clientHeight;
      img.style.left  = pos.x * w + 'px';
      img.style.top   = pos.y * h + 'px';
      img.style.width = pos.widthPercent * w + 'px';
      cardContainer.appendChild(img);
    });
  }

  if(cardImg.complete){
    renderAllStamps();
  } else {
    cardImg.addEventListener('load', renderAllStamps, {once:true});
  }
}

// 既存スタンプをクリア
function clearStampsFromUI(){
  Array.from(cardContainer.querySelectorAll('.stamp')).forEach(n=>n.remove());
}
