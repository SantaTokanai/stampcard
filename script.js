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
const passInput = document.getElementById('password');
const loginBtn = document.getElementById('login');
const signupBtn = document.getElementById('signup');
const logoutBtn = document.getElementById('logout');
const errorMsg = document.getElementById('error-msg');
const passwordMsg = document.getElementById('password-msg');
const keywordSec = document.getElementById('keyword-section');
const keywordInput = document.getElementById('keyword');
const stampBtn = document.getElementById('stampBtn');
const cardContainer = document.getElementById('card-container');

// メッセージ表示
function showMessage(msg, type='error'){
  errorMsg.textContent = msg;
  errorMsg.className = type === 'error' ? 'error' : 'success';
}

// ログイン
loginBtn.addEventListener('click', async () => {
  try {
    await signInWithEmailAndPassword(auth, emailInput.value, passInput.value);
    showMessage('ログインしました', 'success');
  } catch {
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
    passInput.style.display  = 'none';
    loginBtn.style.display   = 'none';
    signupBtn.style.display  = 'none';
    logoutBtn.style.display  = 'inline-block';
    passwordMsg.style.display= 'none';
    keywordSec.style.display = 'block';
    loadStamps(user.uid);
  } else {
    emailInput.style.display = 'inline-block';
    passInput.style.display  = 'inline-block';
    loginBtn.style.display   = 'inline-block';
    signupBtn.style.display  = 'inline-block';
    logoutBtn.style.display  = 'none';
    passwordMsg.style.display= 'block';
    keywordSec.style.display = 'none';
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
    // Firestore からキーワードデータ取得
    const kwDocRef = doc(db, 'keywords', keyword);
    const kwSnap = await getDoc(kwDocRef);

    if(!kwSnap.exists()){ 
      showMessage('その合言葉は存在しません'); 
      return; 
    }

    // 取得データをコンソールに出力して確認
    console.log('Firestoreから取得したキーワードデータ:', kwSnap.data());
    console.log('imgフィールドの型:', typeof kwSnap.data().img);
    console.log('imgフィールドの内容:', kwSnap.data().img);


    // ユーザードキュメントにスタンプ情報を追加
    const userDocRef = doc(db, 'users', user.uid);
    await setDoc(userDocRef, { [keyword]: true }, { merge: true });

    showMessage('スタンプを押しました', 'success');

    // スタンプ描画
    loadStamps(user.uid);

  } catch(err){
    showMessage('スタンプ押下に失敗しました：' + err.message);
    console.error(err);
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
    const kwSnap = await getDoc(doc(db,'keywords',keyword));
    if(!kwSnap.exists()) return;
    const d = kwSnap.data();
    console.log('Firestoreの生データ:', d);
    console.log('取得できるキー:', Object.keys(d));

    // img フィールド補正
    let src = (d.img || '').trim();
    src = src.replace(/^['"]+|['"]+$/g, ''); // 先頭・末尾の ' または " を削除

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
