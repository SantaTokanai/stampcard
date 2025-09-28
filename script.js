// script.js — Firestore-based auth + secret Q/A reset + robust stamp rendering

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

/* ---------- Firebase 設定（そのまま） ---------- */
const firebaseConfig = {
  apiKey: "AIzaSyBI_XbbC78cXCBmm6ue-h0HJ15dNsDAnzo",
  authDomain: "stampcard-project.firebaseapp.com",
  projectId: "stampcard-project",
  storageBucket: "stampcard-project.firebasestorage.app",
  messagingSenderId: "808808121881",
  appId: "1:808808121881:web:57f6d536d40fc2d30fcc88"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ---------- DOM 要素 ---------- */
const nicknameInput = document.getElementById('nickname');
const passInput = document.getElementById('password');
const secretQuestionInput = document.getElementById('secret-question');
const secretAnswerInput = document.getElementById('secret-answer');
const signupBtn = document.getElementById('signup');
const loginBtn = document.getElementById('login');
const logoutBtn = document.getElementById('logout');
const errorMsg = document.getElementById('error-msg');

const forgotLink = document.getElementById('forgot-link');
const resetSection = document.getElementById('reset-section');
const resetNickname = document.getElementById('reset-nickname');
const resetAnswer = document.getElementById('reset-answer');
const resetNewPass = document.getElementById('reset-new-password');
const resetConfirmPass = document.getElementById('reset-confirm-password');
const resetBtn = document.getElementById('reset-btn');
const resetCancel = document.getElementById('reset-cancel');
const resetMsg = document.getElementById('reset-msg');

const keywordSec = document.getElementById('keyword-section');
const keywordInput = document.getElementById('keyword');
const stampBtn = document.getElementById('stampBtn');

const cardContainer = document.getElementById('card-container');
const cardBg = document.querySelector('.card-bg');

/* ---------- ヘルパー ---------- */
function showMessage(msg, type='error'){
  if(type === 'success'){
    errorMsg.className = 'success';
  } else {
    errorMsg.className = '';
  }
  errorMsg.textContent = msg;
}

function showResetMessage(msg, type='error'){
  resetMsg.textContent = msg;
  resetMsg.style.color = (type === 'success') ? 'green' : '#b00';
}

// Clean leading/trailing quotes and whitespace
function cleanString(s){
  if(typeof s !== 'string') return s;
  return s.trim().replace(/^['"]+|['"]+$/g,'');
}

// SHA-256 hex (for secret answer hashing)
// returns hex string
async function sha256hex(text){
  const enc = new TextEncoder();
  const data = enc.encode(text);
  const h = await crypto.subtle.digest('SHA-256', data);
  const arr = Array.from(new Uint8Array(h));
  return arr.map(b => b.toString(16).padStart(2,'0')).join('');
}

// validate nickname for safe doc id usage (disallow '/')
function isValidNickname(nick){
  if(!nick) return false;
  if(nick.indexOf('/') !== -1) return false;
  return true;
}

// Normalize keys: remove outer quotes on keys if present
function normalizeDocData(raw){
  const norm = {};
  if(!raw || typeof raw !== 'object') return norm;
  for(const k of Object.keys(raw)){
    const cleanKey = String(k).replace(/^['"]+|['"]+$/g,'').trim();
    const v = raw[k];
    norm[cleanKey] = (typeof v === 'string') ? cleanString(v) : v;
  }
  return norm;
}

// Extract img path from normalized doc
function extractImgFromNormalized(norm){
  if(!norm) return '';
  if(typeof norm.img === 'string' && norm.img) return norm.img;
  const altKeys = ['image','src','path'];
  for(const k of altKeys){
    if(typeof norm[k] === 'string' && norm[k]) return norm[k];
  }
  for(const k of Object.keys(norm)){
    const v = norm[k];
    if(typeof v === 'string' && v.indexOf('images/') !== -1) return v;
  }
  return '';
}

/* ---------- ログイン状態管理（Firestoreベース） ---------- */
let currentUser = null;

function setLoggedInUI(loggedIn, nickname){
  if(loggedIn){
    nicknameInput.style.display = 'none';
    passInput.style.display = 'none';
    secretQuestionInput.style.display = 'none';
    secretAnswerInput.style.display = 'none';
    signupBtn.style.display = 'none';
    loginBtn.style.display = 'none';
    logoutBtn.style.display = 'inline-block';
    keywordSec.style.display = 'block';
    // render stamps
    loadStamps(nickname);
  } else {
    nicknameInput.style.display = 'inline-block';
    passInput.style.display = 'inline-block';
    secretQuestionInput.style.display = 'inline-block';
    secretAnswerInput.style.display = 'inline-block';
    signupBtn.style.display = 'inline-block';
    loginBtn.style.display = 'inline-block';
    logoutBtn.style.display = 'none';
    keywordSec.style.display = 'none';
    clearStampsFromUI();
  }
}

/* ---------- 新規登録 ---------- */
signupBtn.addEventListener('click', async () => {
  const nick = (nicknameInput.value || '').trim();
  const pw = (passInput.value || '');
  const secretQ = (secretQuestionInput.value || '').trim();
  const secretA = (secretAnswerInput.value || '').trim();

  showMessage('');

  if(!isValidNickname(nick)){
    showMessage('ニックネームを入力してください（/ は使えません）');
    return;
  }
  if(pw.length < 1){
    showMessage('パスワードを入力してください');
    return;
  }

  try {
    // check existence by doc id (we store users with doc id = nickname)
    const userRef = doc(db,'users',nick);
    const snap = await getDoc(userRef);
    if(snap.exists()){
      showMessage('そのニックネームは既に使われています');
      return;
    }

    // prepare data to write
    const dataToSave = {
      // keep existing system compatibility: store password in "password" field (plaintext for compatibility).
      // If your system previously used hashed password, adapt accordingly.
      password: pw
    };

    if(secretQ && secretA){
      // store secret question and hashed answer
      const answerHash = await sha256hex(secretA);
      dataToSave.secretQuestion = secretQ;
      dataToSave.secretAnswerHash = answerHash;
    }

    await setDoc(userRef, dataToSave);
    currentUser = nick;
    setLoggedInUI(true, nick);
    showMessage('新規登録しました。ログインしました', 'success');
  } catch(err){
    console.error('signup error', err);
    showMessage('登録処理でエラーが発生しました');
  }
});

/* ---------- ログイン ---------- */
loginBtn.addEventListener('click', async () => {
  const nick = (nicknameInput.value || '').trim();
  const pw = (passInput.value || '');
  showMessage('');
  if(!nick || !pw){
    showMessage('ニックネームとパスワードを入力してください');
    return;
  }
  try {
    const userRef = doc(db,'users',nick);
    const snap = await getDoc(userRef);
    if(!snap.exists()){
      showMessage('ユーザーが存在しません');
      return;
    }
    const d = snap.data();
    // support both passwordHash and plain password:
    if(d.passwordHash){
      // If system uses hashed passwords, compare (we compute hashed then compare)
      // Here we assume passwordHash = SHA-256 hex of password
      const hashed = await sha256hex(pw);
      if(hashed !== d.passwordHash){
        showMessage('パスワードが違います');
        return;
      }
    } else if(d.password !== undefined){
      if(pw !== d.password){
        showMessage('パスワードが違います');
        return;
      }
    } else {
      // no password field found
      showMessage('このアカウントはパスワード未設定です');
      return;
    }

    currentUser = nick;
    setLoggedInUI(true, nick);
    showMessage('ログインしました', 'success');
  } catch(err){
    console.error('login error', err);
    showMessage('ログイン処理でエラーが発生しました');
  }
});

/* ---------- ログアウト ---------- */
logoutBtn.addEventListener('click', () => {
  currentUser = null;
  setLoggedInUI(false);
  showMessage('');
});

/* ---------- パスワード再設定 UI 操作 ---------- */
forgotLink.addEventListener('click', (e) => {
  e.preventDefault();
  resetSection.style.display = resetSection.style.display === 'none' ? 'block' : 'none';
  resetMsg.textContent = '';
});

resetCancel.addEventListener('click', (e) => {
  e.preventDefault();
  resetSection.style.display = 'none';
  resetMsg.textContent = '';
});

/* ---------- パスワード再設定処理 ---------- */
resetBtn.addEventListener('click', async () => {
  const nick = (resetNickname.value || '').trim();
  const answer = (resetAnswer.value || '').trim();
  const newPass = (resetNewPass.value || '');
  const confirm = (resetConfirmPass.value || '');

  showResetMessage('');
  if(!nick || !answer || !newPass || !confirm){
    showResetMessage('全ての項目を入力してください');
    return;
  }
  if(newPass !== confirm){
    showResetMessage('新しいパスワードが一致しません');
    return;
  }
  if(!isValidNickname(nick)){
    showResetMessage('ニックネームが不正です');
    return;
  }

  try {
    const userRef = doc(db,'users',nick);
    const snap = await getDoc(userRef);
    if(!snap.exists()){
      showResetMessage('ユーザーが存在しません');
      return;
    }
    const d = snap.data();

    if(!d.secretAnswerHash){
      showResetMessage('このアカウントは秘密の質問が設定されていません。管理者に連絡してください。');
      return;
    }

    const answerHash = await sha256hex(answer);
    if(answerHash !== d.secretAnswerHash){
      showResetMessage('秘密の答えが違います');
      return;
    }

    // OK: update password. Keep original field style:
    if(d.passwordHash){
      // system previously stored passwordHash: store new hash
      const newHash = await sha256hex(newPass);
      await updateDoc(userRef, { passwordHash: newHash });
    } else {
      // store as plain password to maintain compatibility
      await updateDoc(userRef, { password: newPass });
    }

    showResetMessage('パスワードを再設定しました。ログインしてください。', 'success');
    // hide reset UI after success
    setTimeout(()=>{ resetSection.style.display='none'; }, 1200);

  } catch(err){
    console.error('reset error', err);
    showResetMessage('再設定処理でエラーが発生しました');
  }
});

/* ---------- スタンプ処理 ---------- */
// helper to normalize raw keyword doc (strip quotes on keys and values)
function normalizeRawKeyword(raw){
  const norm = {};
  for(const k of Object.keys(raw || {})){
    const cleanKey = String(k).replace(/^['"]+|['"]+$/g,'').trim();
    const v = raw[k];
    norm[cleanKey] = (typeof v === 'string') ? cleanString(v) : v;
  }
  return norm;
}

stampBtn.addEventListener('click', async () => {
  if(!currentUser){
    showMessage('ログインしてください');
    return;
  }
  const keyword = (keywordInput.value || '').trim();
  if(!keyword){
    showMessage('合言葉を入力してください');
    return;
  }

  try {
    const kwRef = doc(db, 'keywords', keyword);
    const kwSnap = await getDoc(kwRef);
    if(!kwSnap.exists()){
      showMessage('その合言葉は存在しません');
      return;
    }
    // add stamp to user's document
    const userRef = doc(db, 'users', currentUser);
    await setDoc(userRef, { [keyword]: true }, { merge: true });
    showMessage('スタンプを押しました', 'success');
    loadStamps(currentUser);
  } catch(err){
    console.error('stamp push error', err);
    showMessage('スタンプ押下に失敗しました');
  }
});

/* ---------- スタンプ読み込み・描画 ---------- */
async function loadStamps(nickname){
  clearStampsFromUI();

  try {
    const userRef = doc(db,'users',nickname);
    const userSnap = await getDoc(userRef);
    if(!userSnap.exists()) return;
    const userData = userSnap.data();

    // adjust card background to fill width and maintain aspect ratio
    if(cardBg){
      cardBg.style.width = '100%';
      cardBg.style.height = '100%';
      cardBg.style.objectFit = 'contain';
    }

    const w = cardContainer.clientWidth;
    const h = cardContainer.clientHeight;

    // iterate over userData keys (skip meta fields)
    const keys = Object.keys(userData || {});
    for(const keyword of keys){
      if(keyword === 'password' || keyword === 'passwordHash' || keyword === 'secretQuestion' || keyword === 'secretAnswerHash' || keyword === 'nickname') continue;
      try {
        const kwSnap = await getDoc(doc(db,'keywords',keyword));
        if(!kwSnap.exists()) continue;
        const raw = kwSnap.data();
        const d = normalizeRawKeyword(raw);

        let src = extractImgFromNormalized(d);
        if(!src) continue;
        // normalize src: remove leading slashes, add images/ if missing and not a full URL
        src = String(src).replace(/^\/+/, '');
        if(!/^https?:\/\//.test(src) && !src.startsWith('images/')) src = 'images/' + src;

        const xPos = Number(d.x);
        const yPos = Number(d.y);
        const wPercent = Number(d.widthPercent);

        if(!isFinite(xPos) || !isFinite(yPos) || !isFinite(wPercent)){
          console.warn('位置/サイズが不正です', keyword, d);
          continue;
        }

        const img = new Image();
        img.className = 'stamp';
        img.style.left = (xPos * w) + 'px';
        img.style.top = (yPos * h) + 'px';
        img.style.width = (wPercent * w) + 'px';
        img.style.position = 'absolute';
        img.style.transform = 'translate(-50%, -50%)';
        img.onload = () => cardContainer.appendChild(img);
        img.onerror = () => console.warn('画像読み込み失敗:', img.src);
        img.src = src;
      } catch(innerErr){
        console.error('per-stamp error', innerErr);
      }
    }

  } catch(err){
    console.error('loadStamps error', err);
  }
}

function clearStampsFromUI(){
  document.querySelectorAll('#card-container .stamp').forEach(e=>e.remove());
}

/* ---------- 初期 UI 設定 ---------- */
setLoggedInUI(false);
