// Firebase 初期化
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  deleteUser
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  runTransaction
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// Firebase 設定（既存のまま）
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

// ---------------------------------------------------------
// ヘルパー：文字列クリーン / img フィールド抽出 / ニックネーム正規化
// ---------------------------------------------------------
function cleanString(s){
  return (typeof s === "string")
    ? s.trim().replace(/^['"]+|['"]+$/g, "")
    : s;
}

function extractImgField(docData){
  if(!docData) return "";
  if(typeof docData.img === "string") return cleanString(docData.img);

  const keys = Object.keys(docData);
  for(const k of keys){
    const nk = k.trim().replace(/^['"]+|['"]+$/g, "").toLowerCase();
    if(nk === "img" && typeof docData[k] === "string"){
      return cleanString(docData[k]);
    }
  }
  // 画像パスっぽい値を探す最後の手段
  for(const k of keys){
    const v = docData[k];
    if(typeof v === "string" && v.indexOf("images/") !== -1){
      return cleanString(v);
    }
  }
  return "";
}

// ニックネームの「表示用」はそのまま、
// ドキュメントIDやメール代替に使うキーは encodeURIComponent(normalized) を使って安全化します。
function normalizeNicknameForKey(nick){
  if(!nick || typeof nick !== 'string') return '';
  // NFC 正規化、前後空白除去、連続空白を単一にする（日本語対応）
  const normalized = nick.trim().normalize('NFC').replace(/\s+/g,' ');
  // ドキュメントID/メールの local-part として安全に使うため encodeURIComponent
  return encodeURIComponent(normalized);
}

// ---------------------------------------------------------
// DOM 要素
// ---------------------------------------------------------
const nicknameInput = document.getElementById('nickname');
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

function showMessage(msg, type='error'){
  errorMsg.textContent = msg;
  errorMsg.className = type === 'error' ? 'error' : 'success';
}

// ---------------------------------------------------------
// 認証：ログイン / 新規登録 / ログアウト
// ---------------------------------------------------------

// ログイン（ニックネーム + パスワード -> fakeEmail を使って signIn）
loginBtn.addEventListener('click', async () => {
  const rawNick = nicknameInput.value || '';
  const nick = rawNick.trim();
  if(!nick){
    showMessage('ニックネームを入力してください');
    return;
  }
  const nickId = normalizeNicknameForKey(nick);
  const fakeEmail = `${nickId}@no-reply.fake`;

  try {
    await signInWithEmailAndPassword(auth, fakeEmail, passInput.value);
    showMessage('ログインしました', 'success');
  } catch(err){
    showMessage('ニックネームまたはパスワードが正しくありません');
    console.error(err);
  }
});

// 新規登録（重複チェック → Auth 作成 → Firestore にニックネーム登録）
// 競合が発生した場合、Auth ユーザーを削除してロールバックします。
signupBtn.addEventListener('click', async () => {
  const rawNick = nicknameInput.value || '';
  const nick = rawNick.trim();
  const password = passInput.value || '';

  if(!nick){
    showMessage('ニックネームを入力してください');
    return;
  }
  if(password.length < 6){
    showMessage('パスワードは6文字以上です');
    return;
  }

  const nickId = normalizeNicknameForKey(nick);
  if(!nickId){
    showMessage('ニックネームに使用できない文字が含まれています');
    return;
  }

  const nickRef = doc(db, 'nicknames', nickId);

  // 事前存在チェック（簡易）
  try{
    const pre = await getDoc(nickRef);
    if(pre.exists()){
      showMessage('このニックネームは既に使われています');
      return;
    }
  } catch(err){
    console.error('事前チェック失敗', err);
    showMessage('登録処理でエラーが発生しました');
    return;
  }

  const fakeEmail = `${nickId}@no-reply.fake`;

  try{
    // 1) Firebase Auth にユーザー作成（認証用）
    const userCredential = await createUserWithEmailAndPassword(auth, fakeEmail, password);
    const uid = userCredential.user.uid;

    // 2) Firestore 側でニックネームの予約と users ドキュメント作成をトランザクションで行う
    try{
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(nickRef);
        if(snap.exists()){
          // 既に別プロセスが確保していたらエラーにする
          throw new Error('nickname-already-exists');
        }
        // 予約
        tx.set(nickRef, { uid: uid, nickname: nick, createdAt: new Date().toISOString() });
        // users ドキュメントにニックネームを保存（既存データがあるならマージ）
        const userRef = doc(db, 'users', uid);
        tx.set(userRef, { nickname: nick }, { merge: true });
      });

      showMessage('新規登録しました。自動でログインしました', 'success');

    } catch(txErr){
      console.error('トランザクションエラー', txErr);
      // 競合等で tx が失敗したら、作成した Auth ユーザーを削除してロールバック
      try {
        if(auth.currentUser){
          await deleteUser(auth.currentUser);
        }
      } catch(delErr){
        console.error('Authユーザー削除に失敗しました', delErr);
      }

      if(txErr.message === 'nickname-already-exists'){
        showMessage('このニックネームは既に使われています');
      } else {
        showMessage('登録中にエラーが発生しました：' + txErr.message);
      }
    }

  } catch(err){
    console.error('createUser エラー', err);
    if(err.code === 'auth/email-already-in-use'){
      // 何らかの理由で同じ fakeEmail が既に Auth に存在する場合
      showMessage('このニックネームは既に使われています');
    } else {
      showMessage('登録に失敗しました：' + (err.message || err));
    }
  }
});

// ログアウト
logoutBtn.addEventListener('click', async () => {
  await signOut(auth);
  showMessage('');
});

// ---------------------------------------------------------
// 認証状態監視（既存ロジックを利用）
// ---------------------------------------------------------
onAuthStateChanged(auth, user => {
  if(user){
    // ログイン状態
    if(nicknameInput) nicknameInput.style.display = 'none';
    passInput.style.display  = 'none';
    loginBtn.style.display   = 'none';
    signupBtn.style.display  = 'none';
    logoutBtn.style.display  = 'inline-block';
    passwordMsg.style.display= 'none';
    keywordSec.style.display = 'block';
    loadStamps(user.uid);
  } else {
    // ログアウト状態
    if(nicknameInput) nicknameInput.style.display = 'inline-block';
    passInput.style.display  = 'inline-block';
    loginBtn.style.display   = 'inline-block';
    signupBtn.style.display  = 'inline-block';
    logoutBtn.style.display  = 'none';
    passwordMsg.style.display= 'block';
    keywordSec.style.display = 'none';
    clearStampsFromUI();
  }
});

// ---------------------------------------------------------
// スタンプ押下（既存）
// ---------------------------------------------------------
stampBtn.addEventListener('click', async () => {
  const user = auth.currentUser;
  if(!user){ 
    showMessage('ログインしてください'); 
    return; 
  }

  const keyword = (keywordInput.value || '').trim();
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

    // 取得データをコンソールに出力して確認（必要なら開発中のみ残す）
    const data = kwSnap.data();
    console.log('Firestoreから取得したキーワードデータ:', data);
    const imgVal = extractImgField(data);
    console.log('imgフィールドの型:', typeof imgVal);
    console.log('imgフィールドの内容:', imgVal);

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

// ---------------------------------------------------------
// スタンプ描画：Firestoreのキー名が不正（""付き）だったケースに対応
// ---------------------------------------------------------
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

    // ★キー正規化（例: '"x"' -> 'x'）
    const raw = kwSnap.data();
    const norm = {};
    for(const k of Object.keys(raw)){
      const cleanKey = k.replace(/^['"]+|['"]+$/g,'');
      norm[cleanKey] = raw[k];
    }
    console.log('正規化後データ:', norm);

    // imgパス（安全取得）
    let src = extractImgField(norm);
    if(!src){
      console.warn(`画像パスが取得できません: ${keyword}`);
      return;
    }
    src = src.replace(/^\/+/, '');
    if(!/^https?:\/\//.test(src) && !src.startsWith('images/')){
      src = 'images/' + src;
    }

    // 数値に変換（必ず Number() ）
    const xPos = Number(norm.x);
    const yPos = Number(norm.y);
    const wPercent = Number(norm.widthPercent);

    const img = new Image();
    img.className = 'stamp';
    img.style.position = 'absolute';
    img.style.transform = 'translate(-50%, -50%)';
    img.style.left  = (xPos * w) + 'px';
    img.style.top   = (yPos * h) + 'px';
    img.style.width = (wPercent * w) + 'px';

    img.onload  = () => cardContainer.appendChild(img);
    img.onerror = () => console.warn(`画像が見つかりません: ${img.src}`);
    img.src = src;
  });

  await Promise.all(promises);
}

function clearStampsFromUI(){
  document.querySelectorAll('#card-container .stamp').forEach(e=>e.remove());
}
