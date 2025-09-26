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
const passwordMsg= document.getElementById('password-msg');
const keywordSec = document.getElementById('keyword-section');
const keywordInput = document.getElementById('keyword');
const stampBtn = document.getElementById('stampBtn');
const cardContainer = document.getElementById('card-container');
const cardImg = document.querySelector('.card-bg');

// メッセージ表示
function showMessage(msg, type='error'){
  errorMsg.textContent = msg;
  errorMsg.className = type;
}

// エラー日本語化
function getErrorMessageJP(error){
  switch(error.code){
    case 'auth/invalid-email': return 'メールアドレスの形式が正しくありません。';
    case 'auth/user-not-found': return 'メールアドレスまたはパスワードが正しくありません';
    case 'auth/wrong-password': return 'メールアドレスまたはパスワードが正しくありません';
    case 'auth/email-already-in-use': return 'このメールアドレスは既に登録されています';
    case 'auth/weak-password': return 'パスワードは6文字以上必要です';
    default: return 'エラーが発生しました。もう一度試してください';
  }
}

// ログイン
loginBtn.addEventListener('click', () => {
  signInWithEmailAndPassword(auth, emailInput.value, passInput.value)
    .then(()=>showMessage('ログインしました', 'success'))
    .catch(err=>showMessage(getErrorMessageJP(err)));
});

// 新規登録
signupBtn.addEventListener('click', () => {
  createUserWithEmailAndPassword(auth, emailInput.value, passInput.value)
    .then(async (userCredential)=>{
      const user = userCredential.user;
      // ユーザードキュメントを作成
      const userDocRef = doc(db,'users',user.uid);
      await setDoc(userDocRef, {}); // 空のドキュメント
      showMessage('登録完了。ログインしました', 'success');
    })
    .catch(err=>showMessage(getErrorMessageJP(err)));
});

// ログアウト
logoutBtn.addEventListener('click', async () => {
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
  }else{
    emailInput.style.display = 'inline-block';
    passInput.style.display = 'inline-block';
    loginBtn.style.display = 'inline-block';
    signupBtn.style.display = 'inline-block';
    logoutBtn.style.display = 'none';
    passwordMsg.style.display = 'block';
    keywordSec.style.display = 'none';
    clearStampsFromUI();
    showMessage('', ''); // メッセージリセット
  }
});

// スタンプ押下
stampBtn.addEventListener('click', async ()=>{
  const user = auth.currentUser;
  if(!user){ showMessage('ログインしてください','error'); return; }
  const keyword = keywordInput.value.trim();
  if(!keyword){ showMessage('合言葉を入力してください','error'); return; }

  const kwDocRef = doc(db,'keywords',keyword);
  const kwSnap = await getDoc(kwDocRef);
  if(!kwSnap.exists()){ showMessage('その合言葉は存在しません','error'); return; }

  const stampData = kwSnap.data();
  const userDocRef = doc(db,'users',user.uid);
  await setDoc(userDocRef,{ [keyword]: true }, {merge:true});
  showMessage('スタンプを押しました','success');
  loadStamps(user.uid);
});

// スタンプ描画
async function loadStamps(uid){
  clearStampsFromUI();
  const userDocRef = doc(db,'users',uid);
  const userSnap = await getDoc(userDocRef);
  if(!userSnap.exists()) return;
  const userData = userSnap.data();

  async function renderAllStamps(){
    const keywords = Object.keys(userData);
    for(const keyword of keywords){
      const kwDocRef = doc(db,'keywords',keyword);
      const kwSnap = await getDoc(kwDocRef);
      if(!kwSnap.exists()) continue;
      const stampData = kwSnap.data();

      const img = document.createElement('img');
      img.src = stampData["img"];
      img.className = 'stamp';
      const w = cardContainer.clientWidth;
      const h = cardContainer.clientHeight;
      img.style.left = stampData["x"]*w + 'px';
      img.style.top  = stampData["y"]*h + 'px';
      img.style.width = stampData["widthPercent"]*w + 'px';
      cardContainer.appendChild(img);
    }
  }

  if(cardImg.complete){
    renderAllStamps();
  }else{
    cardImg.addEventListener('load', renderAllStamps, {once:true});
  }
}

// スタンプクリア
function clearStampsFromUI(){
  Array.from(cardContainer.querySelectorAll('.stamp')).forEach(n=>n.remove());
}
