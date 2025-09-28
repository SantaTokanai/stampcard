// script.js (module)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

/*
  前提:
  - index.html で <script src="...sha256.min.js"> を読み込んでいるため
    グローバル関数 sha256(...) が使えます。
  - このファイルは type="module" で読み込まれます。
*/

// Firebase 設定（既存の値をそのまま）
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

// DOM 要素（既存HTMLに合わせる）
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
const cardBg = document.querySelector('.card-bg'); // 画像要素

// アプリ状態
let currentUser = null;

// メッセージ表示ユーティリティ
function showMessage(msg = '', type = 'error') {
  errorMsg.textContent = msg;
  if (type === 'success') {
    errorMsg.classList.add('success');
  } else {
    errorMsg.classList.remove('success');
  }
}

// ハッシュ（グローバル sha256 を利用）
function hashPassword(pw) {
  return (typeof sha256 === 'function') ? sha256(pw) : '';
}

// フィールドのクリーンアップ
function cleanString(s) {
  return (typeof s === 'string') ? s.trim().replace(/^['"]+|['"]+$/g, '') : s;
}

// keywords ドキュメントから画像パスを安全に取り出す
function extractImgField(docData) {
  if (!docData) return '';
  // 直に img がある場合
  if (typeof docData.img === 'string' && docData.img.trim()) return cleanString(docData.img);

  // キー名が変わっている / 引用符がついている場合に対処
  const keys = Object.keys(docData);
  for (const k of keys) {
    const nk = k.trim().replace(/^['"]+|['"]+$/g, '').toLowerCase();
    if (nk === 'img' && typeof docData[k] === 'string') return cleanString(docData[k]);
  }

  // 値の中に images/ を含む文字列を探す（最も柔軟）
  for (const k of keys) {
    const v = docData[k];
    if (typeof v === 'string' && v.includes('images/')) return cleanString(v);
    // 画像がフルURLの可能性も考慮
    if (typeof v === 'string' && (v.startsWith('http://') || v.startsWith('https://'))) {
      // 画像拡張子が含まれる場合のみ採用
      if (v.match(/\.(png|jpe?g|gif|webp)(\?|$)/i)) return cleanString(v);
    }
  }
  return '';
}

// DOMが描画されてからカードの高さが取得できるまで待つ（最大タイムアウト）
async function waitForCardHeight(timeout = 2000, interval = 50) {
  const start = performance.now();
  while (cardContainer.clientHeight === 0 && (performance.now() - start) < timeout) {
    // 画像ロード待ちまたはリフロー待ち
    await new Promise(r => setTimeout(r, interval));
  }
  // 最後に一度だけ強制的に再計算を促す
  return { w: cardContainer.clientWidth, h: cardContainer.clientHeight };
}

// --------------------
// 新規登録
// --------------------
signupBtn.addEventListener('click', async () => {
  // まず秘密質問欄を表示（ユーザビリティ）
  if (!secretSec || secretSec.style.display === 'none' || secretSec.style.display === '') {
    if (secretSec) secretSec.style.display = 'flex';
    showMessage('秘密の質問と答えを入力してから再度「新規登録」を押してください');
    return;
  }

  const nickname = nicknameInput.value.trim();
  const password = passInput.value;
  const secretQ = secretQInput.value.trim();
  const secretA = secretAInput.value.trim();

  if (!nickname) { showMessage('ニックネームを入力してください'); return; }
  if (!password) { showMessage('パスワードを入力してください'); return; }
  if (!secretQ || !secretA) { showMessage('秘密の質問と答えを入力してください'); return; }

  try {
    const userRef = doc(db, 'users', nickname);
    const snap = await getDoc(userRef);
    if (snap.exists()) { showMessage('そのニックネームは既に使用されています'); return; }

    const pwHash = hashPassword(password);
    await setDoc(userRef, { password: pwHash, secretQ, secretA }, { merge: true });

    currentUser = nickname;
    showMessage('新規登録に成功しました。自動でログインします', 'success');

    // UI 切替
    authSection.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'inline-block';
    if (keywordSec) keywordSec.style.display = 'block';
    if (secretSec) secretSec.style.display = 'none';

    await loadStamps(currentUser);
  } catch (err) {
    console.error(err);
    showMessage('登録処理でエラーが発生しました: ' + (err.message || err));
  }
});

// --------------------
// ログイン
// --------------------
loginBtn.addEventListener('click', async () => {
  const nickname = nicknameInput.value.trim();
  const password = passInput.value;
  if (!nickname) { showMessage('ニックネームを入力してください'); return; }
  if (!password) { showMessage('パスワードを入力してください'); return; }

  try {
    const userRef = doc(db, 'users', nickname);
    const snap = await getDoc(userRef);
    if (!snap.exists()) { showMessage('ユーザーが存在しません'); return; }

    const userData = snap.data();
    const pwHash = hashPassword(password);
    if (!userData.password || userData.password !== pwHash) { showMessage('パスワードが違います'); return; }

    currentUser = nickname;
    showMessage('ログインしました', 'success');

    // UI 切替
    authSection.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'inline-block';
    if (keywordSec) keywordSec.style.display = 'block';
    if (secretSec) secretSec.style.display = 'none';

    await loadStamps(currentUser);
  } catch (err) {
    console.error(err);
    showMessage('ログイン処理でエラー: ' + (err.message || err));
  }
});

// --------------------
// ログアウト
// --------------------
logoutBtn.addEventListener('click', () => {
  currentUser = null;
  // UI を元に戻す
  authSection.style.display = 'flex';
  if (logoutBtn) logoutBtn.style.display = 'none';
  if (keywordSec) keywordSec.style.display = 'none';
  if (secretSec) secretSec.style.display = 'none';
  if (resetSection) resetSection.style.display = 'none';
  if (resetQuestionDiv) resetQuestionDiv.style.display = 'none';
  clearStampsFromUI();
  showMessage('');
});

// --------------------
// パスワードリセット
// --------------------
forgotLink.addEventListener('click', (e) => {
  e.preventDefault();
  if (resetSection) resetSection.style.display = 'block';
  if (resetQuestionDiv) resetQuestionDiv.style.display = 'none';
});

resetStartBtn.addEventListener('click', async () => {
  const nick = resetNickname.value.trim();
  if (!nick) { showMessage('ニックネームを入力してください'); return; }
  try {
    const userSnap = await getDoc(doc(db, 'users', nick));
    if (!userSnap.exists()) { showMessage('ユーザーが存在しません'); return; }
    const data = userSnap.data();
    if (!data.secretQ) { showMessage('秘密の質問が設定されていません'); return; }
    showQuestionDiv.textContent = data.secretQ;
    resetQuestionDiv.style.display = 'block';
    showMessage('');
  } catch (err) {
    console.error(err);
    showMessage('リセット処理でエラー: ' + (err.message || err));
  }
});

resetSubmitBtn.addEventListener('click', async () => {
  const nick = resetNickname.value.trim();
  const ans = resetAnswerInput.value.trim();
  const newPass = resetNewPass.value;
  if (!nick || !ans || !newPass) { showMessage('すべて入力してください'); return; }
  try {
    const userRef = doc(db, 'users', nick);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) { showMessage('ユーザーが存在しません'); return; }
    const data = userSnap.data();
    if (!data.secretA || data.secretA !== ans) { showMessage('答えが違います'); return; }
    await setDoc(userRef, { password: hashPassword(newPass) }, { merge: true });
    showMessage('パスワードを更新しました。再度ログインしてください', 'success');
    resetSection.style.display = 'none';
    resetQuestionDiv.style.display = 'none';
  } catch (err) {
    console.error(err);
    showMessage('パスワード更新でエラー: ' + (err.message || err));
  }
});

// --------------------
// スタンプ押下（currentUser を必ず使う）
// --------------------
stampBtn.addEventListener('click', async () => {
  if (!currentUser) { showMessage('ログインしてください'); return; }
  const keyword = keywordInput.value.trim();
  if (!keyword) { showMessage('合言葉を入力してください'); return; }

  try {
    const kwRef = doc(db, 'keywords', keyword);
    const kwSnap = await getDoc(kwRef);
    if (!kwSnap.exists()) { showMessage('その合言葉は存在しません'); return; }

    // Firestore にユーザーのフィールドを追加（既にできているとのこと）
    await setDoc(doc(db, 'users', currentUser), { [keyword]: true }, { merge: true });
    showMessage('スタンプを押しました', 'success');

    // 直後に描画更新
    await loadStamps(currentUser);
  } catch (err) {
    console.error(err);
    showMessage('スタンプ押下に失敗しました: ' + (err.message || err));
  }
});

// --------------------
// スタンプ描画（image path が未定義の問題と高さ0対策を同時に修正）
// --------------------
async function loadStamps(uid) {
  clearStampsFromUI();
  if (!uid) return;

  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return;
    const userData = userSnap.data() || {};

    // カードの高さが0だと位置計算できないので待つ
    await waitForCardHeight(2000, 50);
    const w = cardContainer.clientWidth;
    const h = cardContainer.clientHeight;

    const keys = Object.keys(userData);
    // iterate sequentially to avoid overwhelming network (but Promise.all could be used)
    for (const k of keys) {
      if (k === 'password' || k === 'secretQ' || k === 'secretA') continue;
      try {
        const kwRef = doc(db, 'keywords', k);
        const kwSnap = await getDoc(kwRef);
        if (!kwSnap.exists()) continue;
        const d = kwSnap.data() || {};

        // robustly extract image path
        const src = extractImgField(d);
        if (!src) {
          console.warn('画像フィールドが見つかりません：', k, d);
          continue;
        }

        // coordinates (fallbacks and coercion)
        const xPos = Number(d.x ?? d.left ?? 0);
        const yPos = Number(d.y ?? d.top ?? 0);
        const wPercent = Number(d.widthPercent ?? d.width ?? 0.14);

        const img = new Image();
        img.className = 'stamp';
        img.style.position = 'absolute';
        img.style.transform = 'translate(-50%, -50%)';
        // compute pixel positions
        img.style.left = (isFinite(xPos) ? (xPos * w) : 0) + 'px';
        img.style.top  = (isFinite(yPos) ? (yPos * h) : 0) + 'px';
        img.style.width = (isFinite(wPercent) ? (wPercent * w) : (0.14 * w)) + 'px';

        img.onload = () => cardContainer.appendChild(img);
        img.onerror = () => {
          console.warn('スタンプ画像の読み込み失敗:', src);
        };

        // set src last so onload/onerror fire properly
        img.src = src;
      } catch (err) {
        console.error('キーワード描画でエラー', k, err);
      }
    }
  } catch (err) {
    console.error(err);
  }
}

// --------------------
// UI helper: clear stamps
function clearStampsFromUI() {
  document.querySelectorAll('#card-container .stamp').forEach(e => e.remove());
}

// 初期メッセージクリア
showMessage('');
