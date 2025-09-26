// Firebase 初期化
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
  setDoc,
  getDoc
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
const loginBtn   = document.getElementById('login');
const signupBtn  = document.createElement('button');
signupBtn.textContent = '新規登録';
signupBtn.id = 'signup';
signupBtn.style.marginLeft = '5px';
loginBtn.after(signupBtn);

const logoutBtn  = document.getElementById('logout');
const errorMsg   = document.getElementById('error-msg');
const passwordMsg = document.getElementById('password-msg');
const keywordSec = document.getElementById('keyword-section');
const keywordInput = document.getElementById('keyword');
const stampBtn = document.getElementById('stampBtn');
const cardContainer = document.getElementById('card-container');
const cardImg = document.querySelector('.card-bg');

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

// エラー日本語化
function getErrorMessageJP(error){
  switch (error.code) {
    case 'auth/invalid-email':      return 'メールアドレスの形式が正しくありません。';
    case 'auth/user-not-found':     return 'メールアドレスまたはパスワードが正しくありません';
    case 'auth/wrong-password':     return 'メールアドレスまたはパスワードが正しくありません';
    case 'auth/email-already-in-use': return 'このメールアドレスは既に登録されています。';
    default:                        return 'エラーが発生しました：' + error.message;
  }
}

function showMessage(msg){
  errorMsg.textContent = msg;
}

// 新規登録
signupBtn.addEventListener('click', async () => {
  if(passInput.value.length < 6){
    showMessage('パスワードは6文字以上で入力してください');
    return;
  }
  try{
    await createUserWithEmailAndPassword(auth, emailInput.value, passInput.value);
    showMessage('ログインしました'); // 登録後すぐログイン扱い
    const user = auth.currentUser;
    if(user){
      const userDocRef = doc(db,'users',user.uid);
      await setDoc(userDocRef,{}, {merge:true});
    }
  } catch(err){
    showMessage(getErrorMessageJP(err));
  }
});

// ログイン
loginBtn.addEventListener('click', async () => {
  try{
    await signInWithEmailAndPassword(auth,emailInput.value,passInput.value);
    showMessage('ログインしました');
  } catch(err){
    showMessage(getErrorMessageJP(err));
  }
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
    loginBtn.style.display = 'none';
    signupBtn.style.display = 'none';
    logoutBtn.style.display = 'inline-block';
    passwordMsg.style.display = 'none';
    keywordSec.style.display = 'block';
    loadStamps(user.uid);
  } else {
    emailInput.style.display = 'inline-block';
    passInput.style.display = 'inline-block';
    loginBtn.style.display = 'inline-block';
    signupBtn.style.display = 'inline-block';
    logoutBtn.style.display = 'none';
    passwordMsg.style.display = 'block';
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
    let idx = 0;
    Object.keys(data).forEach(keyword=>{
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
      idx++;
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
