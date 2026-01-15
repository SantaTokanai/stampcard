import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getFirestore, doc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-functions.js";

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
const db = getFirestore(app);
const functions = getFunctions(app);

// Cloud Functions 呼び出し定義
const createUserFunc = httpsCallable(functions, 'createUser');
const getUserDataFunc = httpsCallable(functions, 'getUserData');
const stampKeywordFunc = httpsCallable(functions, 'stampKeyword');
const resetPasswordFunc = httpsCallable(functions, 'resetPassword');
const getSecretQuestionFunc = httpsCallable(functions, 'getSecretQuestion');
const sendSongRequestFunc = httpsCallable(functions, 'sendSongRequest');
const getCurrentRequestFunc = httpsCallable(functions, 'getCurrentRequest');

// --- セッション管理 ---
class SessionManager {
  constructor() {
    this.storageKey = 'stampcard_session';
  }
  saveSession(nickname, passwordHash) {
    const sessionData = { nickname, passwordHash, timestamp: Date.now() };
    sessionStorage.setItem(this.storageKey, JSON.stringify(sessionData));
  }
  getSession() {
    const data = sessionStorage.getItem(this.storageKey);
    if (!data) return null;
    try {
      const session = JSON.parse(data);
      if (Date.now() - session.timestamp > 24 * 60 * 60 * 1000) {
        this.clearSession();
        return null;
      }
      return session;
    } catch(e) {
      this.clearSession();
      return null;
    }
  }
  clearSession() {
    sessionStorage.removeItem(this.storageKey);
  }
}
const sessionManager = new SessionManager();

// ローディング表示の管理
class LoadingManager {
  constructor() {
    this.overlay = null;
    this.createOverlay();
  }
  
  createOverlay() {
    // ローディングオーバーレイを作成
    this.overlay = document.createElement('div');
    this.overlay.id = 'loading-overlay';
    this.overlay.innerHTML = `
      <div class="loading-spinner">
        <div class="spinner"></div>
        <div class="loading-text">読み込み中...</div>
      </div>
    `;
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(255, 255, 255, 0.95);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    `;
    
    // スピナーのスタイル
    const style = document.createElement('style');
    style.textContent = `
      .loading-spinner {
        text-align: center;
      }
      .spinner {
        width: 50px;
        height: 50px;
        margin: 0 auto 15px;
        border: 4px solid #f3f3f3;
        border-top: 4px solid #6b8cff;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      .loading-text {
        font-size: 16px;
        color: #555;
        font-weight: 500;
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(this.overlay);
  }
  
  show(text = '読み込み中...') {
    const textEl = this.overlay.querySelector('.loading-text');
    if (textEl) textEl.textContent = text;
    this.overlay.style.display = 'flex';
  }
  
  hide() {
    this.overlay.style.display = 'none';
  }
}

const loadingManager = new LoadingManager();

// --- キャッシュとユーティリティ ---
let cachedKeywords = null;

async function loadAllKeywords() {
  if (cachedKeywords) return cachedKeywords;
  try {
    const keywordsRef = collection(db, 'keywords');
    const snapshot = await getDocs(keywordsRef);
    cachedKeywords = {};
    snapshot.forEach(doc => { cachedKeywords[doc.id] = doc.data(); });
    return cachedKeywords;
  } catch(err) {
    console.error('Failed to load keywords:', err);
    return {};
  }
}

async function hashPassword(str){
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2,'0')).join('');
}

function cleanString(s){
  return (typeof s === "string") ? s.trim().replace(/^['"]+|['"]+$/g,'') : s;
}

function extractImgField(docData){
  if(!docData) return "";
  const keys = Object.keys(docData);
  for(const k of keys){
    const nk = k.trim().replace(/^['"]+|['"]+$/g,'').toLowerCase();
    if(nk === "img" && typeof docData[k]==="string") return cleanString(docData[k]);
  }
  for(const k of keys){
    const v = docData[k];
    if(typeof v==="string" && v.includes("images/")) return cleanString(v);
  }
  return "";
}

// --- DOM 要素 ---
const nicknameInput = document.getElementById('nickname');
const passInput = document.getElementById('password');
const loginBtn = document.getElementById('login');
const signupBtn = document.getElementById('signup');
const logoutBtn = document.getElementById('logout');
const errorMsg = document.getElementById('error-msg');
const passwordMsg = document.getElementById('password-msg');
const passwordNote = document.getElementById('password-note');
const keywordSec = document.getElementById('keyword-section');
const keywordInput = document.getElementById('keyword');
const stampBtn = document.getElementById('stampBtn');
const cardContainer = document.getElementById('card-container');
const pageTitle = document.getElementById('page-title');
const secretQuestion = document.getElementById('secret-question');
const secretAnswer = document.getElementById('secret-answer');
const recaptchaContainer = document.getElementById('recaptcha-container');
const forgotBtn = document.getElementById('forgot-password');
const resetSection = document.getElementById('reset-section');
const resetNickname = document.getElementById('reset-nickname');
const resetStep1Btn = document.getElementById('reset-step1-btn');
const resetQuestionDiv = document.getElementById('reset-question');
const resetAnswer = document.getElementById('reset-answer');
const resetNewPass = document.getElementById('reset-newpass');
const resetRecaptchaContainer = document.getElementById('reset-recaptcha-container');
const resetSetPassBtn = document.getElementById('reset-setpass-btn');
const resetCancelBtn = document.getElementById('reset-cancel');
const pointsDisplay = document.getElementById('points-display');
const membershipPointDisplay = document.getElementById('membership-point-display');
const stampPointDisplay = document.getElementById('stamp-point-display');
const colorsingPointDisplay = document.getElementById('colorsing-point-display');
const totalPointDisplay = document.getElementById('total-point-display');
const galleryContainer = document.getElementById('gallery-container');
const galleryImages = document.getElementById('gallery-images');
const requestSection = document.getElementById('request-section');
const requestForm = document.getElementById('request-form');
const requestPending = document.getElementById('request-pending');
const songTitleInput = document.getElementById('song-title');
const artistNameInput = document.getElementById('artist-name');
const sendRequestBtn = document.getElementById('send-request-btn');
const requestMsg = document.getElementById('request-msg');
const pendingSongTitle = document.getElementById('pending-song-title');
const pendingArtistName = document.getElementById('pending-artist-name');

// --- UI 表示制御 ---
function showMessage(msg, type='error'){
  errorMsg.textContent = msg;
  errorMsg.className = type === 'error' ? 'error' : 'success';
}

function showRequestMessage(msg, type='error'){
  requestMsg.textContent = msg;
  requestMsg.style.color = type === 'error' ? '#d32f2f' : '#2e7d32';
}

function formatNumber(num){ return num.toLocaleString('ja-JP'); }

// --- メインロジック ---

// ポイント計算
function calculatePoints(userData){
  let soukiCount = 0;
  let matsuriCount = 0;
  let specialCount = 0;
  let hasPoke1 = false;
  let hasPoke3 = false;
  
  const ignoreKeys = ['password', 'secretQuestion', 'secretAnswerHash', 
                      'membershipPoint', 'stampPoint', 'colorsingPoint', 
                      'totalPoint', 'images', 'createdAt'];

  Object.keys(userData).forEach(key => {
    if(!ignoreKeys.includes(key) && userData[key] === true){
      const lowerKey = key.toLowerCase();
      
      if(lowerKey.startsWith('souki')) soukiCount++;
      else if(lowerKey.startsWith('matsuri')) matsuriCount++;
      else if(lowerKey.startsWith('special')) specialCount++;
      else if(lowerKey.startsWith('poke_1')) hasPoke1 = true;
      else if(lowerKey.startsWith('poke_3')) hasPoke3 = true;
    }
  });

  const stampPoint = soukiCount * 1000 + matsuriCount * 250 + specialCount * 500
                   + (hasPoke1 ? 500 : 0) + (hasPoke3 ? 1000 : 0);
  const membershipPoint = userData.membershipPoint || 0;
  const colorsingPoint = userData.colorsingPoint || 0;
  const totalPoint = membershipPoint + stampPoint + colorsingPoint;

  return { membershipPoint, stampPoint, colorsingPoint, totalPoint };
}

// スタンプ描画 (userDataを引数で受け取るように改善)
async function loadStamps(userData) {
  clearStampsFromUI();
  const keywordCache = await loadAllKeywords();
  const w = cardContainer.clientWidth;
  const h = cardContainer.clientHeight;
  const ignoreKeys = ['password', 'secretQuestion', 'secretAnswerHash', 'membershipPoint', 'stampPoint', 'colorsingPoint', 'totalPoint', 'images', 'createdAt'];

  Object.keys(userData).forEach(keyword => {
    if(ignoreKeys.includes(keyword) || userData[keyword] !== true) return;
    
    const d = keywordCache[keyword];
    if(!d) return;

    const norm = {};
    for(const k of Object.keys(d)){ norm[k.replace(/^['"]+|['"]+$/g,'')] = d[k]; }

    const src = extractImgField(norm);
    if(!src) return;

    const img = new Image();
    img.className = 'stamp';
    img.style.position = 'absolute';
    img.style.transform = 'translate(-50%, -50%)';
    img.style.left = (Number(norm.x) * w) + 'px';
    img.style.top = (Number(norm.y) * h) + 'px';
    img.style.width = (Number(norm.widthPercent) * w) + 'px';
    img.src = src;
    img.onload = () => cardContainer.appendChild(img);
  });
}

function clearStampsFromUI(){
  document.querySelectorAll('#card-container .stamp').forEach(e=>e.remove());
}

// ユーザー情報表示
function displayUserInfo(nickname, userData){
  const pts = calculatePoints(userData);
  membershipPointDisplay.textContent = `メンバーシップpt: ${formatNumber(pts.membershipPoint)}`;
  stampPointDisplay.textContent = `スタンプpt: ${formatNumber(pts.stampPoint)}`;
  colorsingPointDisplay.textContent = `カラシン推しpt: ${formatNumber(pts.colorsingPoint)}`;
  totalPointDisplay.textContent = `総合計pt: ${formatNumber(pts.totalPoint)}`;
  pointsDisplay.style.display = 'block';
}

// ギャラリー表示
function loadUserGallery(userData){
  galleryImages.innerHTML = '';
  const images = userData.images || [];
  if(images.length === 0){
    galleryContainer.style.display = 'none';
    return;
  }
  images.forEach((url, i) => {
    const img = document.createElement('img');
    img.src = url;
    img.className = 'gallery-image';
    img.alt = `ギャラリー ${i+1}`;
    galleryImages.appendChild(img);
  });
  galleryContainer.style.display = 'block';
}

// リクエスト状態確認
async function checkCurrentRequest() {
  const session = sessionManager.getSession();
  if (!session) return;
  try {
    const result = await getCurrentRequestFunc({ nickname: session.nickname, passwordHash: session.passwordHash });
    if (result.data.success && result.data.hasRequest) {
      pendingSongTitle.textContent = result.data.songTitle;
      pendingArtistName.textContent = result.data.artistName;
      requestForm.style.display = 'none';
      requestPending.style.display = 'block';
    } else {
      requestForm.style.display = 'block';
      requestPending.style.display = 'none';
    }
  } catch (err) { console.error(err); }
}

// ログイン後のUI一括更新 (並列実行で高速化)
async function updateUIAfterLogin(nickname, userData) {
  pageTitle.textContent = `${nickname}さんのマイページ`;
  
  // 入力フォームを隠す
  [nicknameInput, passInput, loginBtn, signupBtn, passwordMsg, passwordNote, resetSection].forEach(el => el.style.display = 'none');
  logoutBtn.style.display = 'inline-block';
  keywordSec.style.display = 'block';
  requestSection.style.display = 'block';

  // 情報表示
  displayUserInfo(nickname, userData);
  loadUserGallery(userData);

  // 時間がかかる処理を並列で実行
  await Promise.all([
    loadStamps(userData),
    checkCurrentRequest()
  ]);
}

// --- イベントリスナー ---

// ログイン処理（ローディング表示付き）
loginBtn.addEventListener('click', async () => {
  const nick = nicknameInput.value.trim();
  const pass = passInput.value;
  if(!nick || !pass) { showMessage('入力が足りません'); return; }
  
  // ローディング表示開始
  loadingManager.show('ログイン中...');
  
  try {
    const hash = await hashPassword(pass);
    const result = await getUserDataFunc({ nickname: nick, passwordHash: hash });
    
    if(result.data.success){
      sessionManager.saveSession(nick, hash);
      
      // データ読み込み中
      loadingManager.show('データを読み込んでいます...');
      
      await updateUIAfterLogin(nick, result.data.data);
      showMessage('ログインしました', 'success');
    }
  } catch(err){
    if(err.code === 'functions/unauthenticated') showMessage('パスワードが違います');
    else showMessage('ログインエラー: ' + err.message);
  } finally {
    // ローディング非表示
    loadingManager.hide();
  }
});

// スタンプ送信（楽観的UI更新版）
stampBtn.addEventListener('click', async () => {
  const session = sessionManager.getSession();
  const kw = keywordInput.value.trim();
  if(!session || !kw) return;

  // ボタンを無効化（連打防止）
  stampBtn.disabled = true;
  const originalText = stampBtn.textContent;
  stampBtn.textContent = '処理中...';

  try {
    // 1. まずキーワードの存在確認（キャッシュから高速取得）
    const keywordCache = await loadAllKeywords();
    const keywordData = keywordCache[kw];
    
    if (!keywordData) {
      showMessage('その合言葉は存在しません');
      return;
    }

    // 2. 楽観的UI更新（先に表示してしまう）
    const actualFieldName = keywordData.actualFieldName || kw;
    
    // 現在のデータを取得
    const currentDataResult = await getUserDataFunc({ 
      nickname: session.nickname, 
      passwordHash: session.passwordHash 
    });
    
    if (currentDataResult.data.success) {
      const userData = currentDataResult.data.data;
      
      // すでにスタンプが押されているか確認
      if (userData[actualFieldName] === true) {
        showMessage('このスタンプは既に押されています');
        return;
      }
      
      // 楽観的更新: データを先に更新
      userData[actualFieldName] = true;
      
      // UIを即座に更新
      displayUserInfo(session.nickname, userData);
      await loadStamps(userData);
      showMessage('スタンプを押しました！', 'success');
      keywordInput.value = '';
    }

    // 3. バックグラウンドで実際の保存処理（非同期）
    stampKeywordFunc({ 
      nickname: session.nickname, 
      passwordHash: session.passwordHash, 
      keyword: kw 
    }).then(result => {
      if (!result.data.success) {
        // 失敗した場合のみ再読み込み
        console.error('Stamp save failed, reloading...');
        getUserDataFunc({ 
          nickname: session.nickname, 
          passwordHash: session.passwordHash 
        }).then(updated => {
          if (updated.data.success) {
            displayUserInfo(session.nickname, updated.data.data);
            loadStamps(updated.data.data);
          }
        });
      }
    }).catch(err => {
      // エラー時も再読み込み
      console.error('Stamp error:', err);
      showMessage('エラーが発生しました。再読み込みします...');
      getUserDataFunc({ 
        nickname: session.nickname, 
        passwordHash: session.passwordHash 
      }).then(updated => {
        if (updated.data.success) {
          displayUserInfo(session.nickname, updated.data.data);
          loadStamps(updated.data.data);
        }
      });
    });

  } catch(err) { 
    showMessage('エラー: ' + err.message); 
  } finally {
    // ボタンを再有効化
    stampBtn.disabled = false;
    stampBtn.textContent = originalText;
  }
});

// リクエスト送信
sendRequestBtn.addEventListener('click', async () => {
  const session = sessionManager.getSession();
  const title = songTitleInput.value.trim();
  const artist = artistNameInput.value.trim();
  if(!title || !artist) { showRequestMessage('入力してください'); return; }

  try {
    sendRequestBtn.disabled = true;
    const result = await sendSongRequestFunc({ nickname: session.nickname, passwordHash: session.passwordHash, songTitle: title, artistName: artist });
    if(result.data.success) {
      showRequestMessage('送信しました', 'success');
      await checkCurrentRequest();
    }
  } catch(err) { showRequestMessage('エラー: ' + err.message); }
  finally { sendRequestBtn.disabled = false; }
});

// ログアウト
logoutBtn.addEventListener('click', () => {
  sessionManager.clearSession();
  location.reload(); // 状態をリセットするためリロードが最も確実
});

// 新規登録 (既存ロジック維持)
// createUserFunc が成功フラグのみ返す場合
// （登録後に getUserDataFunc でデータ取得が必要）

signupBtn.addEventListener('click', async () => {
  const nick = nicknameInput.value.trim();
  const pass = passInput.value;
  
  if(signupState === 'start'){
    [secretQuestion, secretAnswer, recaptchaContainer].forEach(el => el.style.display = 'block');
    signupState = 'secret';
    showMessage('質問とreCAPTCHAを入力して再度「新規登録」ボタンを押してください', 'success');
    return;
  }
  
  const q = secretQuestion.value.trim();
  const a = secretAnswer.value.trim();
  const token = grecaptcha.getResponse();
  
  if(!q || !a || !token) { 
    showMessage('入力が足りません'); 
    return; 
  }

  // ボタン無効化と処理中表示
  signupBtn.disabled = true;
  const originalText = signupBtn.textContent;
  signupBtn.textContent = '処理中...';
  
  // ローディング表示開始
  loadingManager.show('登録中...');
  
  try {
    const pHash = await hashPassword(pass);
    const aHash = await hashPassword(a);
    
    // 新規登録実行
    const res = await createUserFunc({ 
      nickname: nick, 
      passwordHash: pHash, 
      secretQuestion: q, 
      secretAnswerHash: aHash, 
      recaptchaToken: token 
    });
    
    if(res.data.success) {
      // セッション保存
      sessionManager.saveSession(nick, pHash);
      
      // データ読み込み中表示
      loadingManager.show('データを読み込んでいます...');
      
      // ユーザーデータを取得
      const userDataResult = await getUserDataFunc({ 
        nickname: nick, 
        passwordHash: pHash 
      });
      
      if(userDataResult.data.success) {
        // UI更新
        await updateUIAfterLogin(nick, userDataResult.data.data);
        
        // 成功メッセージを表示
        showMessage('登録しました(*ᴗˬᴗ)⁾⁾ｱﾘｶﾞﾄ💕', 'success');
        
        // 登録フォームの状態をリセット
        signupState = 'start';
        secretQuestion.value = '';
        secretAnswer.value = '';
        grecaptcha.reset();
      } else {
        throw new Error('ユーザーデータの取得に失敗しました');
      }
    }
  } catch(err) { 
    showMessage(err.message); 
    grecaptcha.reset();
    signupBtn.disabled = false;
    signupBtn.textContent = originalText;
  } finally {
    // ローディング非表示
    loadingManager.hide();
    
    // ボタン再有効化（成功時は非表示になっているので問題なし）
    if(signupBtn.style.display !== 'none') {
      signupBtn.disabled = false;
      signupBtn.textContent = originalText;
    }
  }
});

// パスワードリセット (既存ロジック維持)
forgotBtn.addEventListener('click', () => {
  resetSection.style.display = resetSection.style.display === 'none' ? 'block' : 'none';
});
resetStep1Btn.addEventListener('click', async () => {
  const nick = resetNickname.value.trim();
  try {
    const res = await getSecretQuestionFunc({ nickname: nick });
    if(res.data.success){
      resetQuestionDiv.textContent = '質問: ' + res.data.secretQuestion;
      [resetQuestionDiv, resetAnswer, resetNewPass, resetRecaptchaContainer, resetSetPassBtn].forEach(el => el.style.display = 'block');
    }
  } catch(err) { showMessage('ユーザーが見つかりません'); }
});
resetSetPassBtn.addEventListener('click', async () => {
  const nick = resetNickname.value.trim();
  const ans = resetAnswer.value.trim();
  const newP = resetNewPass.value;
  const token = grecaptcha.getResponse(1);
  try {
    const res = await resetPasswordFunc({ nickname: nick, secretAnswer: ans, newPassword: newP, recaptchaToken: token });
    if(res.data.success) location.reload();
  } catch(err) { showMessage(err.message); grecaptcha.reset(1); }
});

// 初期化時のローディング表示
window.addEventListener('DOMContentLoaded', async () => {
  // セッションがある場合のみローディング表示
  const session = sessionManager.getSession();
  if (session) {
    loadingManager.show('前回のセッションを復元中...');
  }
  
  // キーワードを読み込み始める
  const kwPromise = loadAllKeywords();
  
  if (session) {
    try {
      const result = await getUserDataFunc({ nickname: session.nickname, passwordHash: session.passwordHash });
      if(result.data.success){
        loadingManager.show('データを読み込んでいます...');
        await kwPromise;
        await updateUIAfterLogin(session.nickname, result.data.data);
      } else {
        sessionManager.clearSession();
      }
    } catch (err) {
      sessionManager.clearSession();
    } finally {
      loadingManager.hide();
    }
  }
});
