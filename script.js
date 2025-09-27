// script.js — 修正版（キー正規化＋値クリーンを stamp 押下時と描画時の両方で適用）

// Firebase 初期化（既存のまま）
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

// ---------------- Helpers ----------------
function cleanString(s){
  if(typeof s !== 'string') return s;
  return s.trim().replace(/^['"]+|['"]+$/g, '');
}

// 正規化：キーの前後の ' or " を取り除き、値が文字列ならクリーンする
function normalizeDocData(raw){
  const norm = {};
  for(const k of Object.keys(raw || {})){
    const cleanKey = String(k).replace(/^['"]+|['"]+$/g,'').trim();
    const v = raw[k];
    norm[cleanKey] = (typeof v === 'string') ? cleanString(v) : v;
  }
  return norm;
}

// 正規化済オブジェクトから img パスを取り出す
function extractImgFromNormalized(norm){
  if(!norm || typeof norm !== 'object') return '';
  if(typeof norm.img === 'string' && norm.img) return norm.img;
  // 他の候補キー
  const alt = ['image','src','path'];
  for(const k of alt){
    if(typeof norm[k] === 'string' && norm[k]) return norm[k];
  }
  // 最後に images/ を含む文字列を探す
  for(const k of Object.keys(norm)){
    const v = norm[k];
    if(typeof v === 'string' && v.indexOf('images/') !== -1) return v;
  }
  return '';
}

// ---------------- DOM ----------------
const emailInput = document.getElementById('email');   // もし nickname 版を使っているなら適宜置換してください
const passInput  = document.getElementById('password');
const loginBtn   = document.getElementById('login');
const signupBtn  = document.getElementById('signup');
const logoutBtn  = document.getElementById('logout');
const errorMsg   = document.getElementById('error-msg');
const passwordMsg= document.getElementById('password-msg');
const keywordSec = document.getElementById('keyword-section');
const keywordInput = document.getElementById('keyword');
const stampBtn   = document.getElementById('stampBtn');
const cardContainer = document.getElementById('card-container');

function showMessage(msg, type='error'){
  if(!errorMsg) return;
  errorMsg.textContent = msg;
  errorMsg.className = type === 'error' ? 'error' : 'success';
}

// ---------------- Auth（既存のまま） ----------------
loginBtn.addEventListener('click', async () => {
  try {
    await signInWithEmailAndPassword(auth, emailInput.value, passInput.value);
    showMessage('ログインしました', 'success');
  } catch {
    showMessage('メールアドレスまたはパスワードが正しくありません');
  }
});

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
    console.error('signup error', err);
    showMessage('登録に失敗しました：' + (err.message || err.code || err));
  }
});

logoutBtn.addEventListener('click', async () => {
  await signOut(auth);
  showMessage('');
});

onAuthStateChanged(auth, user => {
  if(user){
    if(emailInput) emailInput.style.display = 'none';
    if(passInput) passInput.style.display  = 'none';
    if(loginBtn) loginBtn.style.display   = 'none';
    if(signupBtn) signupBtn.style.display  = 'none';
    if(logoutBtn) logoutBtn.style.display  = 'inline-block';
    if(passwordMsg) passwordMsg.style.display= 'none';
    if(keywordSec) keywordSec.style.display = 'block';
    loadStamps(user.uid);
  } else {
    if(emailInput) emailInput.style.display = 'inline-block';
    if(passInput) passInput.style.display  = 'inline-block';
    if(loginBtn) loginBtn.style.display   = 'inline-block';
    if(signupBtn) signupBtn.style.display  = 'inline-block';
    if(logoutBtn) logoutBtn.style.display  = 'none';
    if(passwordMsg) passwordMsg.style.display= 'block';
    if(keywordSec) keywordSec.style.display = 'none';
    clearStampsFromUI();
  }
});

// ---------------- Stamp 押下（重要） ----------------
stampBtn.addEventListener('click', async () => {
  const user = auth.currentUser;
  if(!user){ showMessage('ログインしてください'); return; }

  const keyword = (keywordInput.value || '').trim();
  if(!keyword){ showMessage('合言葉を入力してください'); return; }

  try{
    const kwDocRef = doc(db, 'keywords', keyword);
    const kwSnap = await getDoc(kwDocRef);
    if(!kwSnap.exists()){
      showMessage('その合言葉は存在しません');
      return;
    }

    // --- ここがポイント：raw を正規化してから img を取り出す ---
    const raw = kwSnap.data();
    console.log('Firestoreから取得したキーワードデータ:', raw);
    const norm = normalizeDocData(raw);
    console.log('正規化後データ:', norm, '取得できるキー:', Object.keys(raw));

    const imgVal = extractImgFromNormalized(norm);
    console.log('imgフィールドの型:', typeof imgVal);
    console.log('imgフィールドの内容:', imgVal);

    if(!imgVal){
      showMessage('画像パスが取得できません');
      return;
    }

    // ユーザードキュメントにスタンプ情報を追加
    const userDocRef = doc(db, 'users', user.uid);
    await setDoc(userDocRef, { [keyword]: true }, { merge: true });

    showMessage('スタンプを押しました', 'success');
    loadStamps(user.uid);

  } catch(err){
    console.error('stamp error', err);
    showMessage('スタンプ押下に失敗しました：' + (err.message || err));
  }
});

// ---------------- スタンプ描画（既存ロジック、ただし正規化済を使う） ----------------
async function loadStamps(uid){
  clearStampsFromUI();
  const userSnap = await getDoc(doc(db,'users',uid));
  if(!userSnap.exists()) return;
  const userData = userSnap.data();

  const w = cardContainer.clientWidth || 800;
  const h = cardContainer.clientHeight || 600;

  const promises = Object.keys(userData || {}).map(async keyword => {
    // メタ系キーはスキップ
    if(keyword === 'nickname') return;
    const kwSnap = await getDoc(doc(db,'keywords',keyword));
    if(!kwSnap.exists()) return;

    const raw = kwSnap.data();
    console.log('Firestoreの生データ:', raw);
    const d = normalizeDocData(raw);
    console.log('正規化後データ:', d, '取得できるキー:', Object.keys(raw));

    // 画像パス取得（正規化済）
    let src = extractImgFromNormalized(d);
    if(!src){
      console.warn(`画像パスが取得できません: ${keyword}`);
      return;
    }

    // 相対パス整形
    src = src.replace(/^\/+/, '');
    if(!/^https?:\/\//.test(src) && !src.startsWith('images/')){
      src = 'images/' + src;
    }

    // 数値変換
    const xPos = Number(d.x);
    const yPos = Number(d.y);
    const wPercent = Number(d.widthPercent);
    if(!isFinite(xPos) || !isFinite(yPos) || !isFinite(wPercent)){
      console.warn(`位置/サイズの数値が不正です: ${keyword}`, d);
      return;
    }

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
