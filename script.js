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
const nicknameInput = document.getElementById('nickname');
const passInput     = document.getElementById('password');
const loginBtn      = document.getElementById('login');
const signupBtn     = document.getElementById('signup');
const logoutBtn     = document.getElementById('logout');
const errorMsg      = document.getElementById('error-msg');
const passwordMsg   = document.getElementById('password-msg');
const keywordSec    = document.getElementById('keyword-section');
const keywordInput  = document.getElementById('keyword');
const stampBtn      = document.getElementById('stampBtn');
const cardContainer = document.getElementById('card-container');

// メッセージ表示
function showMessage(msg, type='error'){
  errorMsg.textContent = msg;
  errorMsg.className = type === 'error' ? 'error' : 'success';
}

// ニックネームを内部用メール形式へ
function pseudoEmail(nickname){
  return `${nickname}@example.local`;
}

// 新規登録
signupBtn.addEventListener('click', async () => {
  const nickname = nicknameInput.value.trim();
  const password = passInput.value;
  if (!nickname) {
    showMessage('ニックネームを入力してください');
    return;
  }
  if (password.length < 6){
    showMessage('パスワードは6文字以上です');
    return;
  }
  try{
    const email = pseudoEmail(nickname);
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);

    // Firestoreにニックネームを保存
    await setDoc(doc(db,'users',userCredential.user.uid), { nickname });

    showMessage('新規登録しました。自動でログインしました', 'success');
  } catch(err){
    console.error("Signup error:", err);
    showMessage('登録に失敗しました：' + err.code + ' - ' + err.message);
  }
});

// ログイン
loginBtn.addEventListener('click', async () => {
  const nickname = nicknameInput.value.trim();
  const password = passInput.value;
  if (!nickname) {
    showMessage('ニックネームを入力してください');
    return;
  }
  try {
    const email = pseudoEmail(nickname);
    await signInWithEmailAndPassword(auth, email, password);
    showMessage('ログインしました', 'success');
  } catch (err) {
    console.error("Login error:", err);
    showMessage('ニックネームまたはパスワードが正しくありません');
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
    nicknameInput.style.display = 'none';
    passInput.style.display     = 'none';
    loginBtn.style.display      = 'none';
    signupBtn.style.display     = 'none';
    logoutBtn.style.display     = 'inline-block';
    passwordMsg.style.display   = 'none';
    keywordSec.style.display    = 'block';
    loadStamps(user.uid);
  } else {
    nicknameInput.style.display = 'inline-block';
    passInput.style.display     = 'inline-block';
    loginBtn.style.display      = 'inline-block';
    signupBtn.style.display     = 'inline-block';
    logoutBtn.style.display     = 'none';
    passwordMsg.style.display   = 'block';
    keywordSec.style.display    = 'none';
    clearStampsFromUI();
  }
});

// スタンプ押下
stampBtn.addEventListener('click', async () => {
  const user = auth.currentUser;
  if(!user){
    showMessage('ログインしてください');
    return;
  }

  const keyword = keywordInput.value.trim();
  if(!keyword){
    showMessage('合言葉を入力してください');
    return;
  }

  try{
    const kwDocRef = doc(db, 'keywords', keyword);
    const kwSnap = await getDoc(kwDocRef);

    if(!kwSnap.exists()){
      showMessage('その合言葉は存在しません');
      return;
    }

    console.log('Firestoreから取得したキーワードデータ:', kwSnap.data());
    console.log('imgフィールドの型:', typeof kwSnap.data().img);
    console.log('imgフィールドの内容:', kwSnap.data().img);

    await setDoc(doc(db, 'users', user.uid), { [keyword]: true }, { merge: true });

    showMessage('スタンプを押しました', 'success');

    loadStamps(user.uid);
  } catch(err){
    console.error(err);
    showMessage('スタンプ押下に失敗しました：' + err.message);
  }
});

// スタンプ描画
async function loadStamps(uid){
  clearStampsFromUI();
  const userSnap = await getDoc(doc(db,'users',uid));
  if(!userSnap.exists()) return;
  const userData = userSnap.data();

  const w = cardContainer.clientWidth;
  const h = cardContainer.clientHeight;

  const promises = Object.keys(userData).map(async keyword => {
    if(keyword === 'nickname') return; // ニックネームキーは除外
    const kwSnap = await getDoc(doc(db,'keywords',keyword));
    if(!kwSnap.exists()) return;
    const d = kwSnap.data();
    console.log('Firestoreの生データ:', d);
    console.log('取得できるキー:', Object.keys(d));

    let src = (d.img || '').trim();
    src = src.replace(/^['"]+|['"]+$/g, '');
    if(src && !src.startsWith('images/')){
      src = 'images/' + src;
    }

    const img = new Image();
    img.className = 'stamp';
    img.style.position = 'absolute';
    img.style.transform = 'translate(-50%, -50%)';
    img.style.left  = (d.x * w) + 'px';
    img.style.top   = (d.y * h) + 'px';
    img.style.width = (d.widthPercent * w) + 'px';

    img.onload  = () => cardContainer.appendChild(img);
    img.onerror = () => console.warn(`画像が見つかりません: ${img.src}`);
    img.src = src;
  });

  await Promise.all(promises);
}

function clearStampsFromUI(){
  document.querySelectorAll('#card-container .stamp').forEach(e=>e.remove());
}
