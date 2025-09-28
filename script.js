// script.js (module, デバッグ版)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// Firebase 設定（既存値）
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

// DOM 要素（HTML 側の id/class 名に依存）
const authSection = document.getElementById('auth-section');
const nicknameInput = document.getElementById('nickname');
const passInput = document.getElementById('password');
const signupBtn = document.getElementById('signup');
const loginBtn = document.getElementById('login');
const logoutBtn = document.getElementById('logout');
const errorMsg = document.getElementById('error-msg');

const secretSec = document.getElementById('secret-section');
const secretQInput = document.getElementById('secretQ');
const secretAInput = document.getElementById('secretA');

const forgotLink = document.getElementById('forgot-password');
const resetSection = document.getElementById('reset-section');
const resetNickname = document.getElementById('reset-nickname');
const resetStartBtn = document.getElementById('reset-start');
const resetQuestionDiv = document.getElementById('reset-question');
const showQuestionDiv = document.getElementById('show-question');
const resetAnswerInput = document.getElementById('reset-answer');
const resetNewPass = document.getElementById('reset-newpass');
const resetSubmitBtn = document.getElementById('reset-submit');

const keywordSec = document.getElementById('keyword-section');
const keywordInput = document.getElementById('keyword');
const stampBtn = document.getElementById('stampBtn');

const cardContainer = document.getElementById('card-container');
const cardBg = document.querySelector('.card-bg') || document.getElementById('card-bg');

let currentUser = null;

// ヘルパー: メッセージ表示（UI）
function showMessage(msg = '', type = 'error') {
  errorMsg.textContent = msg;
  if (type === 'success') errorMsg.classList.add('success'); else errorMsg.classList.remove('success');
}

// ハッシュ（グローバル sha256 を使用）
function hashPassword(pw) {
  return (typeof sha256 === 'function') ? sha256(pw) : '';
}

// 柔軟に img フィールドを抽出するヘルパー（デバッグ用ログあり）
function extractImgField(docData) {
  if (!docData) return '';
  if (typeof docData.img === 'string' && docData.img.trim()) {
    console.log('[extractImgField] found docData.img:', docData.img);
    return docData.img.trim();
  }
  const keys = Object.keys(docData);
  for (const k of keys) {
    const nk = k.trim().replace(/^['"]+|['"]+$/g, '').toLowerCase();
    if (nk === 'img' && typeof docData[k] === 'string') {
      console.log('[extractImgField] found key img-like:', k, '=>', docData[k]);
      return docData[k].trim();
    }
  }
  for (const k of keys) {
    const v = docData[k];
    if (typeof v === 'string' && v.includes('images/')) {
      console.log('[extractImgField] found value containing images/:', v);
      return v.trim();
    }
    if (typeof v === 'string' && (v.startsWith('http://') || v.startsWith('https://'))) {
      if (v.match(/\.(png|jpe?g|gif|webp)(\?|$)/i)) {
        console.log('[extractImgField] found full URL image:', v);
        return v.trim();
      }
    }
  }
  console.log('[extractImgField] no img found in:', docData);
  return '';
}

function clearStampsFromUI() {
  const nodes = document.querySelectorAll('#card-container .stamp');
  console.log('[clearStampsFromUI] removing', nodes.length, 'stamps');
  nodes.forEach(n => n.remove());
}

// wait for cardContainer height to be available (height != 0) up to timeout
async function waitForCardReady(timeout = 2000, interval = 50) {
  const start = performance.now();
  while ((cardContainer.clientHeight === 0 || cardContainer.clientWidth === 0) && (performance.now() - start) < timeout) {
    await new Promise(r => setTimeout(r, interval));
  }
  console.log('[waitForCardReady] cardContainer size:', cardContainer.clientWidth, cardContainer.clientHeight);
  return { w: cardContainer.clientWidth, h: cardContainer.clientHeight };
}

// --- Signup (2-step UX: show secret fields first) ---
signupBtn.addEventListener('click', async () => {
  console.log('[signup] clicked');
  if (!secretSec || secretSec.style.display === 'none' || secretSec.style.display === '') {
    if (secretSec) secretSec.style.display = 'flex';
    showMessage('秘密の質問と答えを入力してから再度「新規登録」を押してください');
    console.log('[signup] showed secret section, waiting for user input');
    return;
  }

  const nickname = nicknameInput.value.trim();
  const password = passInput.value;
  const secretQ = secretQInput.value.trim();
  const secretA = secretAInput.value.trim();
  console.log('[signup] values', { nickname, passwordProvided: !!password, secretQ, secretAProvided: !!secretA });

  if (!nickname || !password || !secretQ || !secretA) { showMessage('全て入力してください'); return; }

  try {
    const userRef = doc(db, 'users', nickname);
    const snap = await getDoc(userRef);
    console.log('[signup] user snap exists?', !!snap.exists());
    if (snap.exists()) { showMessage('そのニックネームは既に使用されています'); return; }

    await setDoc(userRef, {
      password: hashPassword(password),
      secretQ,
      secretA
    }, { merge: true });

    currentUser = nickname;
    console.log('[signup] registration successful, currentUser set to', currentUser);

    // UI switch
    authSection.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'inline-block';
    if (keywordSec) keywordSec.style.display = 'block';
    if (secretSec) secretSec.style.display = 'none';
    showMessage('登録しました', 'success');

    await loadStamps(currentUser);
  } catch (err) {
    console.error('[signup] error', err);
    showMessage('登録中にエラーが発生しました: ' + (err.message || err));
  }
});

// --- Login ---
loginBtn.addEventListener('click', async () => {
  console.log('[login] clicked');
  const nickname = nicknameInput.value.trim();
  const password = passInput.value;
  console.log('[login] inputs', { nickname, hasPassword: !!password });
  if (!nickname || !password) { showMessage('ニックネームとパスワードを入力してください'); return; }

  try {
    const userRef = doc(db, 'users', nickname);
    const snap = await getDoc(userRef);
    console.log('[login] user snap exists?', !!snap.exists());
    if (!snap.exists()) { showMessage('ユーザーが存在しません'); return; }
    const data = snap.data();
    console.log('[login] user data keys:', Object.keys(data));
    const pwHash = hashPassword(password);
    if (!data.password || data.password !== pwHash) { showMessage('パスワードが違います'); return; }

    currentUser = nickname;
    console.log('[login] login success, currentUser=', currentUser);

    authSection.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'inline-block';
    if (keywordSec) keywordSec.style.display = 'block';
    if (secretSec) secretSec.style.display = 'none';
    showMessage('ログインしました', 'success');

    await loadStamps(currentUser);
  } catch (err) {
    console.error('[login] error', err);
    showMessage('ログイン処理でエラー: ' + (err.message || err));
  }
});

// --- Logout ---
logoutBtn.addEventListener('click', () => {
  console.log('[logout] clicked');
  currentUser = null;
  authSection.style.display = 'flex';
  if (logoutBtn) logoutBtn.style.display = 'none';
  if (keywordSec) keywordSec.style.display = 'none';
  if (secretSec) secretSec.style.display = 'none';
  if (resetSection) resetSection.style.display = 'none';
  if (resetQuestionDiv) resetQuestionDiv.style.display = 'none';
  clearStampsFromUI();
  showMessage('');
});

// --- Password reset UI & logic ---
forgotLink.addEventListener('click', (e) => {
  e.preventDefault();
  console.log('[forgot] clicked');
  if (resetSection) resetSection.style.display = 'block';
  if (resetQuestionDiv) resetQuestionDiv.style.display = 'none';
});

resetStartBtn.addEventListener('click', async () => {
  const nick = resetNickname.value.trim();
  console.log('[resetStart] nick=', nick);
  if (!nick) { showMessage('ニックネームを入力してください'); return; }
  try {
    const snap = await getDoc(doc(db, 'users', nick));
    if (!snap.exists()) { showMessage('ユーザーが存在しません'); return; }
    const data = snap.data();
    console.log('[resetStart] user data:', data);
    showQuestionDiv.textContent = data.secretQ || '';
    resetQuestionDiv.style.display = 'block';
  } catch (err) {
    console.error('[resetStart] error', err);
    showMessage('リセット処理でエラー: ' + (err.message || err));
  }
});

resetSubmitBtn.addEventListener('click', async () => {
  const nick = resetNickname.value.trim();
  const ans = resetAnswerInput.value.trim();
  const newPass = resetNewPass.value;
  console.log('[resetSubmit] nick/ansProvided/newPassProvided', nick, !!ans, !!newPass);
  if (!nick || !ans || !newPass) { showMessage('すべて入力してください'); return; }
  try {
    const userRef = doc(db, 'users', nick);
    const snap = await getDoc(userRef);
    if (!snap.exists()) { showMessage('ユーザーが存在しません'); return; }
    const data = snap.data();
    if (!data.secretA || data.secretA !== ans) { showMessage('答えが違います'); return; }
    await setDoc(userRef, { password: hashPassword(newPass) }, { merge: true });
    showMessage('パスワードを更新しました', 'success');
    resetSection.style.display = 'none';
    resetQuestionDiv.style.display = 'none';
  } catch (err) {
    console.error('[resetSubmit] error', err);
    showMessage('更新でエラー: ' + (err.message || err));
  }
});

// --- Stamp button: add field to /users and then draw ---
stampBtn.addEventListener('click', async () => {
  console.log('[stampBtn] clicked, currentUser=', currentUser);
  if (!currentUser) { showMessage('ログインしてください'); return; }
  const keyword = keywordInput.value.trim();
  console.log('[stampBtn] keyword=', keyword);
  if (!keyword) { showMessage('合言葉を入力してください'); return; }

  try {
    const kwRef = doc(db, 'keywords', keyword);
    const kwSnap = await getDoc(kwRef);
    console.log('[stampBtn] kwSnap.exists=', !!kwSnap.exists());
    if (!kwSnap.exists()) { showMessage('その合言葉は存在しません'); return; }

    await setDoc(doc(db, 'users', currentUser), { [keyword]: true }, { merge: true });
    console.log('[stampBtn] added field to users/', currentUser, keyword);
    showMessage('スタンプを押しました', 'success');

    await loadStamps(currentUser);
  } catch (err) {
    console.error('[stampBtn] error', err);
    showMessage('スタンプ押下に失敗しました: ' + (err.message || err));
  }
});

// --- loadStamps: key part (with detailed logs) ---
async function loadStamps(uid) {
  console.log('[loadStamps] start for uid=', uid);
  clearStampsFromUI();
  if (!uid) { console.log('[loadStamps] no uid'); return; }

  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    console.log('[loadStamps] userSnap.exists=', !!userSnap.exists());
    if (!userSnap.exists()) return;
    const userData = userSnap.data() || {};
    console.log('[loadStamps] userData keys=', Object.keys(userData));

    // Wait for card size
    await waitForCardReady();
    const w = cardContainer.clientWidth;
    const h = cardContainer.clientHeight;
    console.log('[loadStamps] cardWidth/Height =', w, h);

    for (const key of Object.keys(userData)) {
      console.log('[loadStamps] processing key=', key);
      if (['password', 'secretQ', 'secretA'].includes(key)) {
        console.log('[loadStamps] skipping meta key', key);
        continue;
      }

      try {
        const kwRef = doc(db, 'keywords', key);
        const kwSnap = await getDoc(kwRef);
        console.log('[loadStamps] kwSnap.exists for', key, '=', !!kwSnap.exists());
        if (!kwSnap.exists()) continue;
        const d = kwSnap.data() || {};
        console.log('[loadStamps] keyword doc data for', key, d);

        const src = extractImgField(d) || d.img || '';
        console.log('[loadStamps] resolved src for', key, src);
        if (!src) { console.warn('[loadStamps] no src for', key); continue; }

        // parse numeric fields
        const xRaw = d.x;
        const yRaw = d.y;
        const wPctRaw = d.widthPercent ?? d.width ?? d.width_pct ?? d.w;

        const x = Number(xRaw);
        const y = Number(yRaw);
        const wPercent = Number(wPctRaw);

        console.log('[loadStamps] numeric parsed for', key, { xRaw, yRaw, wPctRaw, x, y, wPercent });

        if (!isFinite(x) || !isFinite(y) || !isFinite(wPercent)) {
          console.warn('[loadStamps] invalid numeric fields for', key, 'skipping');
          continue;
        }

        // compute pixel values
        const leftPx = x * w;
        const topPx = y * h;
        const widthPx = wPercent * w;
        console.log('[loadStamps] computed px for', key, { leftPx, topPx, widthPx });

        const img = new Image();
        img.className = 'stamp';
        img.style.position = 'absolute';
        img.style.transform = 'translate(-50%, -50%)';
        img.style.left = `${leftPx}px`;
        img.style.top = `${topPx}px`;
        img.style.width = `${widthPx}px`;

        img.onload = () => {
          console.log('[loadStamps] image onload for', key, 'src=', src);
          cardContainer.appendChild(img);
        };
        img.onerror = (ev) => {
          console.error('[loadStamps] image onerror for', key, 'src=', src, ev);
        };

        // set src last
        img.src = src;
        console.log('[loadStamps] img.src set for', key, src);
      } catch (err) {
        console.error('[loadStamps] per-key error for', key, err);
      }
    }

  } catch (err) {
    console.error('[loadStamps] top-level error', err);
    showMessage('スタンプ読み込み中にエラーが発生しました: ' + (err.message || err));
  }
}

// global error catcher
window.addEventListener('error', (ev) => {
  console.error('[window error]', ev);
});

// 初期化メッセージ
console.log('[script] debug script loaded');
showMessage('');
