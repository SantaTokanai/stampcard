// Firebase 初期化
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
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
const loginBtn   = document.getElementById('login');
const signupBtn  = document.getElementById('signup');
const logoutBtn  = document.getElementById('logout');
const errorMsg   = document.getElementById('error-msg');
const passwordMsg = document.getElementById('password-msg');

const keywordSec = document.getElementById('keyword-section');
const keywordInput = document.getElementById('keyword');
const stampBtn = document.getElementById('stampBtn');
const cardContainer = document.getElementById('card-container');
const cardImg = document.querySelector('.card-bg');

// メッセージ表示関数
function showMessage(msg, type='error'){
  errorMsg.textContent = msg;
  if(type==='success'){
    errorMsg.classList.remove('error');
    errorMsg.classList.add('success');
  } else {
    errorMsg.classList.remove('success');
    errorMsg.classList.add('error');
  }
}

// エラー日本語化
function getErrorMessageJP(error){
  switch(error.code){
    case 'auth/invalid-email': return 'メールアドレスの形式が正しくありません。';
    case 'auth/user-not-found':
    case 'auth/wrong-password': return 'メールアドレスまたはパスワードが正しくありません。';
    case 'auth/email-already-in-use': return 'このメールアドレスはすでに登録されています。';
    case 'auth/weak-password': return 'パスワードは6文字以上にしてください。';
    default: return 'エラーが発生しました。もう一度お試しください。';
  }
}

// ログイン
loginBtn.addEventListener('click', async ()=>{
  try{
    await signInWithEmailAndPassword(auth, emailInput.value, passInput.value);
    showMessage('ログインしました', 'success');
  } catch(err){
    showMessage(getErrorMessageJP(err));
  }
});

// 新規登録
signupBtn.addEventListener('click', async ()=>{
  try{
    const userCredential = await createUserWithEmailAndPassword(auth, emailInput.value, passInput.value);
    // 新規ユーザーの Firestore ドキュメント初期化
    const userDocRef = doc(db,'users',userCredential.user.uid);
    await setDoc(userDocRef, {});
    showMessage('新規登録が完了しました。ログインしました', 'success');
  } catch(err){
    showMessage(getErrorMessageJP(err));
  }
});

// ログアウト
logoutBtn.addEventListener('click', async ()=>{
  await signOut(auth);
});

// 認証状態監視
onAuthStateChanged(auth, user=>{
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
    showMessage('');
  }
});

// スタンプ押下
stampBtn.addEventListener('click', async ()=>{
  const user = auth.currentUser;
  if(!user){ showMessage('ログインしてください'); return; }

  const keyword = keywordInput.value.trim();
  if(!keyword){ showMessage('合言葉を入力してください'); return; }

  // Firestore からキーワード取得
  const kwDocRef = doc(db,'keywords',keyword);
  const kwSnap = await getDoc(kwDocRef);
  if(!kwSnap.exists()){ showMessage('その合言葉は存在しません'); return; }
  const kwData = kwSnap.data();

  // ユーザーのドキュメントに保存
  const userDocRef = doc(db,'users',user.uid);
  await setDoc(userDocRef,{ [keyword]: kwData }, {merge:true});

  showMessage('スタンプを押しました', 'success');
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
    Object.keys(data).forEach(keyword=>{
      const pos = data[keyword];
      if(!pos || !pos.img) return;
      const imgEl = document.createElement('img');
      imgEl.src = 'images/' + pos.img;
      imgEl.className = 'stamp';
      const w = cardContainer.clientWidth;
      const h = cardContainer.clientHeight;
      imgEl.style.left = pos.x * w + 'px';
      imgEl.style.top = pos.y * h + 'px';
      imgEl.style.width = pos.widthPercent * w + 'px';
      cardContainer.appendChild(imgEl);
    });
  }

  if(cardImg.complete){
    renderAllStamps();
  } else {
    cardImg.addEventListener('load', renderAllStamps, {once:true});
  }
}

// スタンプ削除（UI）
function clearStampsFromUI(){
  Array.from(cardContainer.querySelectorAll('.stamp')).forEach(n=>n.remove());
}
