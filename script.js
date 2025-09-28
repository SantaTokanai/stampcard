// script.js (module)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

/*
  前提:
  - index.html で普通の <script src="...sha256.min.js"> を読み込んでいるため
    グローバル関数 sha256(...) が使えます。
  - このファイルは type="module" で読み込まれます。
*/

// Firebase 設定 (既存値をそのまま使用)
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

// ヘルパー: メッセージ表示
function showMessage(msg = '', type = 'error') {
  errorMsg.textContent = msg;
  if (type === 'success') {
    errorMsg.classList.add('success');
  } else {
    errorMsg.classList.remove('success');
  }
}

// 簡単なハッシュラッパー（グローバル sha256 を利用）
function hashPassword(pw) {
  // sha256 がグローバルで定義されていることが前提
  return typeof sha256 === 'function' ? sha256(pw) : '';
}

// --------------------
// 新規登録 (動作の流れ)
// ・ボタン押下で秘密質問エリアを表示（もし空なら）
// ・必要項目が揃って初めて Firestore に保存
// --------------------
signupBtn.addEventListener('click', async () => {
  // まず表示（ユーザーがまだ入力していない場合、欄を見せる）
  if (secretSec.style.display === 'none' || secretSec.style.display === '') {
    secretSec.style.display = 'flex';
    showMessage('秘密の質問を入力してからもう一度「新規登録」を押してください', 'error');
    // ユーザーに入力してもらうため、ここでは登録処理は止める
    // 次にもう一度押されたときに処理を進める
    // To allow "two-step" UX: first click shows fields, second click registers
    // If fields already filled, allow immediate registration:
    if (!secretQInput.value.trim() || !secretAInput.value.trim() || !passInput.value) return;
  }

  // 必須チェック
  const nickname = nicknameInput.value.trim();
  const password = passInput.value;
  const secretQ = secretQInput.value.trim();
  const secretA = secretAInput.value.trim();

  if (!nickname) { showMessage('ニックネームを入力してください'); return; }
  if (!password) { showMessage('パスワードを入力してください'); return; }
  if (!secretQ || !secretA) { showMessage('秘密の質問と答えを入力してください'); return; }

  try {
    // 既存確認（重複チェック）
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

    showMessage('新規登録に成功しました。自動でログインします', 'success');
    await loginUserAfterSignup(nickname, password);
  } catch (err) {
    console.error(err);
    showMessage('登録処理でエラーが発生しました: ' + (err.message || err));
  }
});

// helper: サインアップ直後のログイン処理（同じ処理を呼ぶ）
async function loginUserAfterSignup(nickname, password) {
  // nick and password are provided
  try {
    const userRef = doc(db, 'users', nickname);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) { showMessage('登録直後にユーザーが見つかりませんでした'); return; }
    const userData = userSnap.data();
    if (userData.password !== hashPassword(password)) { showMessage('自動ログインに失敗しました'); return; }

    // UI 切替
    authSection.style.display = 'none';
    logoutBtn.style.display = 'inline-block';
    keywordSec.style.display = 'block';
    secretSec.style.display = 'none';
    showMessage('ログインしました', 'success');
    await loadStamps(nickname);
  } catch (err) {
    console.error(err);
    showMessage('自動ログインでエラー: ' + (err.message || err));
  }
}

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
    if (!userData.password || userData.password !== pwHash) {
      showMessage('パスワードが違います');
      return;
    }

    // ログイン成功：UI 切替（auth セクションを丸ごと隠す）
    authSection.style.display = 'none';
    logoutBtn.style.display = 'inline-block';
    keywordSec.style.display = 'block';
    secretSec.style.display = 'none';
    showMessage('ログインしました', 'success');

    await loadStamps(nickname);
  } catch (err) {
    console.error(err);
    showMessage('ログイン処理でエラー: ' + (err.message || err));
  }
}

// --------------------
// ログアウト
// --------------------
logoutBtn.addEventListener('click', () => {
  // UI を元に戻す
  authSection.style.display = 'flex';
  nicknameInput.style.display = 'inline-block';
  passInput.style.display = 'inline-block';
  loginBtn.style.display = 'inline-block';
  signupBtn.style.display = 'inline-block';
  logoutBtn.style.display = 'none';
  secretSec.style.display = 'none';
  keywordSec.style.display = 'none';
  resetSection.style.display = 'none';
  resetQuestionDiv.style.display = 'none';
  clearStampsFromUI();
  showMessage('');
});

// --------------------
// パスワードリセットの表示
// --------------------
forgotLink.addEventListener('click', (e) => {
  e.preventDefault();
  // show reset section; keep auth section visible — user will enter nickname
  resetSection.style.display = 'block';
  resetQuestionDiv.style.display = 'none';
});

// --------------------
// パスワードリセット: 質問を表示
// --------------------
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
    showMessage('', ''); // clear message
  } catch (err) {
    console.error(err);
    showMessage('リセット処理でエラー: ' + (err.message || err));
  }
});

// --------------------
// パスワードリセット: 更新送信
// --------------------
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
    if (!data.secretA || (data.secretA !== ans)) { showMessage('答えが違います'); return; }

    const newHash = hashPassword(newPass);
    await setDoc(userRef, { password: newHash }, { merge: true });
    showMessage('パスワードを更新しました。再度ログインしてください', 'success');

    // UI を元に戻す
    resetSection.style.display = 'none';
    resetQuestionDiv.style.display = 'none';
  } catch (err) {
    console.error(err);
    showMessage('パスワード更新でエラー: ' + (err.message || err));
  }
});

// --------------------
// スタンプ処理（既存の仕様を壊さない）
// --------------------
stampBtn.addEventListener('click', async () => {
  const nickname = nicknameInput.value.trim();
  if (!nickname) { showMessage('ログインしてください'); return; }

  const keyword = keywordInput.value.trim();
  if (!keyword) { showMessage('合言葉を入力してください'); return; }

  try {
    const kwRef = doc(db, 'keywords', keyword);
    const kwSnap = await getDoc(kwRef);
    if (!kwSnap.exists()) { showMessage('その合言葉は存在しません'); return; }
    // mark user doc
    await setDoc(doc(db, 'users', nickname), { [keyword]: true }, { merge: true });
    showMessage('スタンプを押しました', 'success');
    await loadStamps(nickname);
  } catch (err) {
    console.error(err);
    showMessage('スタンプ押下に失敗しました: ' + (err.message || err));
  }
});

// --------------------
// スタンプ描画（既存動作を維持、password/secret はスキップ）
// --------------------
async function loadStamps(uid) {
  clearStampsFromUI();
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return;
    const userData = userSnap.data();

    const w = cardContainer.clientWidth;
    const h = cardContainer.clientHeight;

    const keys = Object.keys(userData || {});
    const promises = keys.map(async (k) => {
      // スタンプ以外のフィールドをスキップ
      if (k === 'password' || k === 'secretQ' || k === 'secretA') return;
      // value true/whatever indicates obtained stamp
      // fetch keyword doc
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
// UI helper: スタンプを全部消す
// --------------------
function clearStampsFromUI() {
  document.querySelectorAll('#card-container .stamp').forEach(e => e.remove());
}

// 初期メッセージクリア
showMessage('');
