// Firebase 初期化
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
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

// DOM
const emailInput = document.getElementById('email');
const passInput  = document.getElementById('password');
const passwordMsg = document.getElementById('password-msg');
const loginBtn   = document.getElementById('login');
const logoutBtn  = document.getElementById('logout');
const errorMsg   = document.getElementById('error-msg');
const keywordSec = document.getElementById('keyword-section');
const keywordInput = document.getElementById('keyword');
const stampBtn = document.getElementById('stampBtn');
const cardContainer = document.getElementById('card-container');
const cardImg = document.querySelector('.card-bg');

// スタンプ位置を比率で定義（x,yは0~1）
const stampPositions = [
  {x:0.09, y:0.55, img:'images/stamp1.png', widthPercent:0.14},
  {x:0.25, y:0.55, img:'images/stamp2.png', widthPercent:0.14},
  {x:0.42, y:0.55, img:'images/stamp3.png', widthPercent:0.14},
  {x:0.2, y:0.5, img:'images/stamp4.png', widthPercent:0.15},
  {x:0.5, y:0.5, img:'images/stamp5.png', widthPercent:0.15},
  {x:0.8, y:0.5, img:'images/stamp6.png', widthPercent:0.15},
  {x:0.2, y:0.8, img:'images/stamp7.png', widthPercent:0.15},
  {x:0.5, y:0.8, img:'images/stamp8.png', widthPercent:0.15},
  {x:0.8, y:0.8, img:'images/stamp9.png', widthPercent:0.15},
  {x:0.35, y:0.35, img:'images/stamp10.png', widthPercent:0.15},
  {x:0.65, y:0.35, img:'images/stamp11.png', widthPercent:0.15},
  {x:0.35, y:0.65, img:'images/stamp12.png', widthPercent:0.15},
  {x:0.65, y:0.65, img:'images/stamp13.png', widthPercent:0.15},
  {x:0.5, y:0.65, img:'images/stamp14.png', widthPercent:0.15},
];

// エラー日本語化
function getErrorMessageJP(error){
  switch (error.code) {
    case 'auth/invalid-email':      return 'メールアドレスの形式が正しくありません。';
    case 'auth/user-not-found':     
    case 'auth/wrong-password':     return 'メールアドレスまたはパスワードが正しくありません';
    default:                        return 'エラーが発生しました：' + error.message;
  }
}

function showMessage(msg){
  errorMsg.textContent = msg;
}

// ログイン
loginBtn.addEventListener('click', () => {
  if(passInput.value.length < 6){
    passwordMsg.style.color = 'red';
    passwordMsg.textContent = 'パスワードは6文字以上入力してください';
    return;
  } else {
    passwordMsg.style.color = 'gray';
    passwordMsg.textContent = 'パスワードは6文字以上です';
  }

  signInWithEmailAndPassword(auth, emailInput.value, passInput.value)
    .then(() => showMessage(''))
    .catch(err => showMessage(getErrorMessageJP(err)));
});

// ログアウト
logoutBtn.addEventListener('click', async () => {
  await signOut(auth);
});

// 認証状態監視
onAuthStateChanged(auth, user => {
  if(user){
    emailInput.style.display = 'none';
    passInput.style.display = 'none';
    passwordMsg.style.display = 'none';
    loginBtn.style.display = 'none';
    logoutBtn.style.display = 'inline-block';
    keywordSec.style.display = 'block';
    loadStamps(user.uid);
  } else {
    emailInput.style.display = 'inline-block';
    passInput.style.display = 'inline-block';
    passwordMsg.style.display = 'block';
    loginBtn.style.display = 'inline-block';
    logoutBtn.style.display = 'none';
    keywordSec.style.display = 'none';
    clearStampsFromUI();
  }
});

// スタンプ押下
stampBtn.addEventListener('click', async () => {
  const user = auth.currentUser;
  if(!user){ alert('ログインしてください'); return; }

  const keyword = keywordInput.value.trim();
  if(!keyword){ alert('合言葉を入力してください'); return; }

  // Firebase の keywords コレクションから取得
  const kwDocRef = doc(db,'keywords',keyword);
  const kwSnap = await getDoc(kwDocRef);
  if(!kwSnap.exists()){ alert('その合言葉は存在しません'); return; }
  const data = kwSnap.data();

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
      img.style.left = pos.x * w + 'px';
      img.style.top  = pos.y * h + 'px';
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

function clearStampsFromUI(){
  Array.from(cardContainer.querySelectorAll('.stamp')).forEach(n=>n.remove());
}
