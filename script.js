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
  if(type==='error'){
    errorMsg.className = 'error';
  } else {
    errorMsg.className = 'success';
  }
}

// ログイン
loginBtn.addEventListener('click', async () => {
  try {
    await signInWithEmailAndPassword(auth, emailInput.value, passInput.value);
    showMessage('ログインしました', 'success');
  } catch(err){
    showMessage('メールアドレスまたはパスワードが正しくありません');
  }
});

// 新規登録
signupBtn.addEventListener('click', async () => {
  if(passInput.value.length < 6){
    showMessage('パスワードは6文字以上です');
    return;
  }
  try{
    const userCredential = await createUserWithEmailAndPassword(auth, emailInput.value, passInput.value);
    // 新規ユーザー用の users ドキュメントを作成
    await setDoc(doc(db,'users',userCredential.user.uid), {});
    showMessage('新規登録しました。自動でログインしました', 'success');
  } catch(err){
    showMessage('登録に失敗しました：' + err.message);
  }
});

// ログアウト
logoutBtn.addEventListener('click', async () => {
  await signOut(auth);
  showMessage('');
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
  if(!user){ showMessage('ログインしてください'); return; }

  const keyword = keywordInput.value.trim();
  if(!keyword){ showMessage('合言葉を入力してください'); return; }

  try{
    // Firestore の keywords/<keyword> を取得
    const kwSnap = await getDoc(doc(db,'keywords',keyword));
    if(!kwSnap.exists()){ 
      showMessage('その合言葉は存在しません'); 
      return; 
    }
    const kwData = kwSnap.data();

    // ユーザーのドキュメントに追加
    const userDocRef = doc(db,'users',user.uid);
    await setDoc(userDocRef, {[keyword]: true}, {merge:true});

    showMessage('スタンプを押しました', 'success');
    loadStamps(user.uid);
  } catch(err){
    showMessage('スタンプ押下に失敗しました：' + err.message);
  }
});

// スタンプ描画
async function loadStamps(uid){
  clearStampsFromUI();
  const userDocRef = doc(db,'users',uid);
  const snap = await getDoc(userDocRef);
  if(!snap.exists()) return;
  const data = snap.data();

  async function renderStamp(keyword){
    const kwSnap = await getDoc(doc(db,'keywords',keyword));
    if(!kwSnap.exists()) return;
    const kwData = kwSnap.data();

    const img = document.createElement('img');
    img.src = 'images/' + kwData.img;
    img.className = 'stamp';
    const w = cardContainer.clientWidth;
    const h = cardContainer.clientHeight;
    img.style.left = kwData.x * w + 'px';
    img.style.top  = kwData.y * h + 'px';
    img.style.width = kwData.widthPercent * w + 'px';
    img.style.transform = 'translate(-50%, -50%)';
    cardContainer.appendChild(img);
  }

  const promises = Object.keys(data).map(renderStamp);
  await Promise.all(promises);
}

function clearStampsFromUI(){
  Array.from(cardContainer.querySelectorAll('.stamp')).forEach(n=>n.remove());
}
