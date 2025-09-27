// script.js — 修正版（キー正規化＆安全なニックネーム→pseudo-email対応）

// --- Firebase 初期化 ---
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

// ---DEBUG フラグ（テスト時は true、本番では false 推奨）---
const DEBUG = true;

// ----------------- ヘルパー -----------------
function cleanString(s){
  // 先頭・末尾の ' または " を除去して trim
  if(typeof s !== 'string') return s;
  return s.trim().replace(/^['"]+|['"]+$/g, '');
}

function normalizeDocData(raw){
  // Firestore からの raw オブジェクトのキー名を正規化して返す
  // 例: '"x"' -> 'x'、値の文字列は cleanString を適用
  const norm = {};
  for(const k of Object.keys(raw)){
    const cleanKey = String(k).replace(/^['"]+|['"]+$/g,'').trim();
    const v = raw[k];
    norm[cleanKey] = (typeof v === 'string') ? cleanString(v) : v;
  }
  return norm;
}

function extractImgFieldFromNormalized(norm){
  // 正規化済オブジェクトから img パスを取り出す（フォールバック含む）
  if(!norm || typeof norm !== 'object') return '';
  if(typeof norm.img === 'string' && norm.img) return norm.img;

  // 別名の可能性（image 等）を確認
  const altKeys = ['image','src','path'];
  for(const k of altKeys){
    if(typeof norm[k] === 'string' && norm[k]) return norm[k];
  }

  // 値に images/ を含む項目を探す（最後の手段）
  for(const k of Object.keys(norm)){
    const v = norm[k];
    if(typeof v === 'string' && v.indexOf('images/') !== -1){
      return v;
    }
  }

  return '';
}

// base64-url エンコード（ニックネームを安全な ASCII にする）
function base64UrlEncode(str){
  // Unicode 対応の base64
  const b64 = btoa(unescape(encodeURIComponent(str)));
  return b64.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

function pseudoEmailFromNickname(nickname){
  const normalized = (nickname || '').trim().normalize('NFC').replace(/\s+/g,' ');
  const local = base64UrlEncode(normalized || 'user');
  return `${local}@example.local`;
}

// ----------------- DOM -----------------
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

function showMessage(msg, type='error'){
  if(!errorMsg) return;
  errorMsg.textContent = msg;
  errorMsg.className = type === 'error' ? 'error' : 'success';
}

// ----------------- 認証処理 -----------------
signupBtn.addEventListener('click', async () => {
  const nickname = (nicknameInput?.value || '').trim();
  const password = passInput?.value || '';
  if(!nickname){ showMessage('ニックネームを入力してください'); return; }
  if(password.length < 6){ showMessage('パスワードは6文字以上です'); return; }

  const email = pseudoEmailFromNickname(nickname);
  try{
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;
    // users ドキュメントに表示用ニックネームを保存
    await setDoc(doc(db, 'users', uid), { nickname }, { merge: true });
    showMessage('新規登録しました。自動でログインしました', 'success');
  } catch(err){
    console.error('signup error', err);
    if(err && err.code === 'auth/email-already-in-use'){
      showMessage('このニックネームは既に使われています');
    } else {
      showMessage('登録に失敗しました：' + (err.message || err.code || err));
    }
  }
});

loginBtn.addEventListener('click', async () => {
  const nickname = (nicknameInput?.value || '').trim();
  const password = passInput?.value || '';
  if(!nickname){ showMessage('ニックネームを入力してください'); return; }
  const email = pseudoEmailFromNickname(nickname);
  try{
    await signInWithEmailAndPassword(auth, email, password);
    showMessage('ログインしました', 'success');
  } catch(err){
    console.error('login error', err);
    showMessage('ニックネームまたはパスワードが正しくありません');
  }
});

logoutBtn.addEventListener('click', async () => {
  try{
    await signOut(auth);
    showMessage('');
  } catch(err){
    console.error('logout error', err);
  }
});

// 認証状態監視
onAuthStateChanged(auth, user => {
  if(user){
    if(nicknameInput) nicknameInput.style.display = 'none';
    if(passInput) passInput.style.display = 'none';
    if(loginBtn) loginBtn.style.display = 'none';
    if(signupBtn) signupBtn.style.display = 'none';
    if(logoutBtn) logoutBtn.style.display = 'inline-block';
    if(passwordMsg) passwordMsg.style.display = 'none';
    if(keywordSec) keywordSec.style.display = 'block';
    loadStamps(user.uid);
  } else {
    if(nicknameInput) nicknameInput.style.display = 'inline-block';
    if(passInput) passInput.style.display = 'inline-block';
    if(loginBtn) loginBtn.style.display = 'inline-block';
    if(signupBtn) signupBtn.style.display = 'inline-block';
    if(logoutBtn) logoutBtn.style.display = 'none';
    if(passwordMsg) passwordMsg.style.display = 'block';
    if(keywordSec) keywordSec.style.display = 'none';
    clearStampsFromUI();
  }
});

// ----------------- スタンプ押下 -----------------
stampBtn.addEventListener('click', async () => {
  const user = auth.currentUser;
  if(!user){ showMessage('ログインしてください'); return; }

  const keyword = (keywordInput?.value || '').trim();
  if(!keyword){ showMessage('合言葉を入力してください'); return; }

  try{
    const kwDocRef = doc(db, 'keywords', keyword);
    const kwSnap = await getDoc(kwDocRef);
    if(!kwSnap.exists()){
      showMessage('その合言葉は存在しません');
      return;
    }

    const raw = kwSnap.data();
    if(DEBUG) console.log('Firestoreから取得したキーワードデータ:', raw);

    // 正規化して img を取り出す（デバッグ用ログあり）
    const norm = normalizeDocData(raw);
    if(DEBUG) console.log('正規化後データ:', norm, '取得できるキー:', Object.keys(raw));

    const imgVal = extractImgFieldFromNormalized(norm);
    if(DEBUG) console.log('imgフィールドの抽出結果:', imgVal);

    if(!imgVal){
      showMessage('画像パスが取得できませんでした');
      return;
    }

    // ユーザードキュメントにスタンプ情報を追加
    await setDoc(doc(db, 'users', user.uid), { [keyword]: true }, { merge: true });
    showMessage('スタンプを押しました', 'success');
    loadStamps(user.uid);

  } catch(err){
    console.error('stamp error', err);
    showMessage('スタンプ押下に失敗しました：' + (err.message || err));
  }
});

// ----------------- スタンプ描画 -----------------
async function loadStamps(uid){
  clearStampsFromUI();
  const userSnap = await getDoc(doc(db, 'users', uid));
  if(!userSnap.exists()) return;
  const userData = userSnap.data();
  if(!userData) return;

  const w = cardContainer.clientWidth || 800;
  const h = cardContainer.clientHeight || 600;

  const keys = Object.keys(userData || {});
  for(const keyword of keys){
    // ユーザードキュメントのメタ（nickname 等）はスキップ
    if(keyword === 'nickname') continue;
    try{
      const kwSnap = await getDoc(doc(db, 'keywords', keyword));
      if(!kwSnap.exists()) continue;

      const raw = kwSnap.data();
      if(DEBUG) console.log('Firestoreの生データ:', raw);

      const d = normalizeDocData(raw);
      if(DEBUG) console.log('正規化後データ:', d, '取得できるキー:', Object.keys(raw));

      // 画像パス取得
      let src = extractImgFieldFromNormalized(d);
      if(!src){
        console.warn(`画像パスが取得できません: ${keyword}`);
        continue;
      }

      // 相対パス整形：先頭スラッシュ削除、images/が無ければ付与
      src = src.replace(/^\/+/, '');
      if(!/^https?:\/\//.test(src) && !src.startsWith('images/')){
        src = 'images/' + src;
      }

      // 数値変換（安全策: 不正ならスキップ）
      const xPos = Number(d.x);
      const yPos = Number(d.y);
      const wPercent = Number(d.widthPercent);

      if(!isFinite(xPos) || !isFinite(yPos) || !isFinite(wPercent)){
        console.warn(`位置/サイズの数値が不正です: ${keyword} ->`, { x: d.x, y: d.y, widthPercent: d.widthPercent });
        continue;
      }

      const img = new Image();
      img.className = 'stamp';
      img.style.position = 'absolute';
      img.style.transform = 'translate(-50%, -50%)';
      img.style.left  = (xPos * w) + 'px';
      img.style.top   = (yPos * h) + 'px';
      img.style.width = (wPercent * w) + 'px';

      img.onload = () => cardContainer.appendChild(img);
      img.onerror = () => console.warn(`画像が見つかりません: ${img.src}`);
      img.src = src;

    } catch(err){
      console.error('loadStamp per-key error', keyword, err);
    }
  }
}

// ----------------- その他 -----------------
function clearStampsFromUI(){
  document.querySelectorAll('#card-container .stamp').forEach(e=>e.remove());
}
