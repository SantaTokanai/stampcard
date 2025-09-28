// script.js (module)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

/*
  前提:
  - index.html で通常の <script src="...sha256.min.js"> を読み込んでいるため
    グローバル関数 sha256(...) が使えます。
  - このファイルは type="module" で読み込まれます。
*/

// Firebase 設定（既存値をそのまま）
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

// DOM 要素
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

// アプリ状態：現在ログインしているユーザー（ニックネーム）
// これを使ってスタンプなどを実行する（nicknameInput が非表示になっても確実）
let currentUser = null;

// メッセージ表示
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
  return typeof sha256 === 'function' ? sha256(pw) : '';
}

// --------------------
// 新規登録（2段階対応）
// ・初回クリックで秘密質問欄を表示（未表示だった場合）
// ・もし既に秘密質問・答え・パスワードが入力済なら即登録を行う
// --------------------
signupBtn.addEventListener('click', async () => {
  // 表示されていなければまず表示させる（ユーザーが意図せず消した場合など）
  if (!secretSec || secretSec.style.display === 'none' || secretSec.style.display === '') {
    secretSec.style.display = 'flex';
    // もしまだ入力が揃っていなければ一旦止めて入力を促す
    if (!secretQInput.value.trim() || !secretAInput.value.trim() || !passInput.value) {
      showMessage('秘密の質問・答えとパスワードを入力してから再度「新規登録」を押してください');
      return;
    }
    // else fallthrough to proceed
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
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      showMessage('そのニックネームは既に使用されています');
      return;
    }

    const pwHash = hashPassword(password);
    await setDoc(userRef, {
      password: pwHash,
      secretQ: secretQ,
      secretA: secretA
    }, { merge: true });

    // 登録成功 → 自動ログインのため currentUser を設定して UI 切替
    currentUser = nickname;
    showMessage('新規登録に成功しました。自動でログインします', 'success');

    // UI 切替：auth セクションを隠し、ログアウトボタンとスタンプ領域を表示
    authSection.style.display = 'none';
    logoutBtn.style.display = 'inline-block';
    keywordSec.style.display = 'block';
    secretSec.style.display = 'none';

    await loadStamps(currentUser);
  } catch (err) {
    console.error(err);
    showMessage('登録処理でエラーが発生しました: ' + (err.message || err));
  }
});

// --------------------
// ログイン処理
// --------------------
loginBtn.addEventListener('click', handleLogin);

async function handleLogin() {
  const nickname = nicknameInput.value.trim();
  const password = passInput.value;

  if (!nickname) { showMessage('ニックネームを入力してください'); return; }
  if (!password) { showMessage('パスワードを入力してください'); return; }

  try {
    const userRef = doc(db, 'users', nickname);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) { showMessage('ユーザーが存在しません'); return; }

    const userData = userSnap.data();
    const pwHash = hashPassword(password);
    if (!userData.password || userData.password !== pwHash) { showMessage('パスワードが違います'); return; }

    // 成功
    currentUser = nickname;
    showMessage('ログインしました', 'success');

    // UI 切替：auth を隠す（これも「パスワードを忘れた場合」リンクを消す目的）
    authSection.style.display = 'none';
    logoutBtn.style.display = 'inline-block';
    secretSec.style.display = 'none';
    keywordSec.style.display = 'block';

    await loadStamps(currentUser);
  } catch (err) {
    console.error(err);
    showMessage('ログイン処理でエラー: ' + (err.message || err));
  }
}

// --------------------
// ログアウト
// --------------------
logoutBtn.addEventListener('click', () => {
  // 状態リセット
  currentUser = null;

  // UIを元に戻す
  authSection.style.display = 'flex';
  secretSec.style.display = 'none';
  resetSection.style.display = 'none';
  resetQuestionDiv.style.display = 'none';
  keywordSec.style.display = 'none';
  logoutBtn.style.display = 'none';

  // 入力欄の値は残す（ユーザー利便性） -- 必要ならここで clear できます
  clearStampsFromUI();
  showMessage('');
});

// --------------------
// パスワードリセットの表示と処理
// --------------------
forgotLink.addEventListener('click', (e) => {
  e.preventDefault();
  resetSection.style.display = 'block';
  resetQuestionDiv.style.display = 'none';
});

resetStartBtn.addEventListener('click', async () => {
  const nick = resetNickname.value.trim();
  if (!nick) { showMessage('ニックネームを入力してください'); return; }

  try {
    const userRef = doc(db, 'users', nick);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) { showMessage('ユーザーが存在しません'); return; }
    const data = userSnap.data();
    if (!data.secretQ) { showMessage('そのユーザーは秘密の質問を設定していません'); return; }

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

    const newHash = hashPassword(newPass);
    await setDoc(userRef, { password: newHash }, { merge: true });
    showMessage('パスワードを更新しました。再度ログインしてください', 'success');

    resetSection.style.display = 'none';
    resetQuestionDiv.style.display = 'none';
  } catch (err) {
    console.error(err);
    showMessage('パスワード更新でエラー: ' + (err.message || err));
  }
});

// --------------------
// スタンプ押下（必ず currentUser を使ってチェックする）
// --------------------
stampBtn.addEventListener('click', async () => {
  if (!currentUser) {
    showMessage('ログインしてください');
    return;
  }

  const keyword = keywordInput.value.trim();
  if (!keyword) { showMessage('合言葉を入力してください'); return; }

  try {
    const kwRef = doc(db, 'keywords', keyword);
    const kwSnap = await getDoc(kwRef);
    if (!kwSnap.exists()) { showMessage('その合言葉は存在しません'); return; }

    // ユーザードキュメントにスタンプ印を付ける
    await setDoc(doc(db, 'users', currentUser), { [keyword]: true }, { merge: true });
    showMessage('スタンプを押しました', 'success');
    await loadStamps(currentUser);
  } catch (err) {
    console.error(err);
    showMessage('スタンプ押下に失敗しました: ' + (err.message || err));
  }
});

// --------------------
// スタンプ描画（password/secret フィールドはスキップ）
// --------------------
async function loadStamps(uid) {
  clearStampsFromUI();
  if (!uid) return;
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return;
    const userData = userSnap.data();

    const w = cardContainer.clientWidth;
    const h = cardContainer.clientHeight;

    const keys = Object.keys(userData || {});
    const promises = keys.map(async (k) => {
      if (k === 'password' || k === 'secretQ' || k === 'secretA') return;
      // k is assumed to be a keyword id string
      const kwRef = doc(db, 'keywords', k);
      const kwSnap = await getDoc(kwRef);
      if (!kwSnap.exists()) return;
      const d = kwSnap.data();
      if (!d || !d.img) return;

      const xPos = Number(d.x);
      const yPos = Number(d.y);
      const wPercent = Number(d.widthPercent);

      const img = new Image();
      img.className = 'stamp';
      img.style.position = 'absolute';
      img.style.transform = 'translate(-50%, -50%)';
      img.style.left = (xPos * w) + 'px';
      img.style.top = (yPos * h) + 'px';
      img.style.width = (wPercent * w) + 'px';
      img.src = d.img;
      img.onload = () => cardContainer.appendChild(img);
      img.onerror = () => console.warn('stamp image load failed:', img.src);
    });

    await Promise.all(promises);
  } catch (err) {
    console.error(err);
  }
}

// --------------------
// clear stamps
function clearStampsFromUI() {
  document.querySelectorAll('#card-container .stamp').forEach(e => e.remove());
}

// 初期化: 何も表示しない
showMessage('');
