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

// Cloud Functions呼び出し
const createUserFunc = httpsCallable(functions, 'createUser');
const getUserDataFunc = httpsCallable(functions, 'getUserData');
const stampKeywordFunc = httpsCallable(functions, 'stampKeyword');
const resetPasswordFunc = httpsCallable(functions, 'resetPassword');
const getSecretQuestionFunc = httpsCallable(functions, 'getSecretQuestion');

// セッション管理
class SessionManager {
  constructor() {
    this.storageKey = 'stampcard_session';
  }
  
  saveSession(nickname, passwordHash) {
    const sessionData = {
      nickname: nickname,
      passwordHash: passwordHash,
      timestamp: Date.now()
    };
    sessionStorage.setItem(this.storageKey, JSON.stringify(sessionData));
    console.debug('Session saved for', nickname);
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
      console.error('Failed to parse session:', e);
      this.clearSession();
      return null;
    }
  }
  
  clearSession() {
    sessionStorage.removeItem(this.storageKey);
    console.debug('Session cleared');
  }
}

const sessionManager = new SessionManager();

// キーワードキャッシュ
let cachedKeywords = null;

async function loadAllKeywords() {
  if (cachedKeywords) {
    console.debug('Using cached keywords');
    return cachedKeywords;
  }
  
  try {
    const keywordsRef = collection(db, 'keywords');
    const snapshot = await getDocs(keywordsRef);
    
    cachedKeywords = {};
    snapshot.forEach(doc => {
      cachedKeywords[doc.id] = doc.data();
    });
    
    console.debug('Loaded', Object.keys(cachedKeywords).length, 'keywords into cache');
    return cachedKeywords;
  } catch(err) {
    console.error('Failed to load keywords:', err);
    return {};
  }
}

// DOM要素
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

// メッセージ表示
function showMessage(msg, type='error'){
  errorMsg.textContent = msg;
  errorMsg.className = type === 'error' ? 'error' : 'success';
  console.debug('[UI message]', type, msg);
}

// パスワードハッシュ化
async function hashPassword(str){
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2,'0')).join('');
}

// Firestoreヘルパー
function cleanString(s){
  return (typeof s === "string") ? s.trim().replace(/^['"]+|['"]+$/g,'') : s;
}

function extractImgField(docData){
  if(!docData) return "";
  if(typeof docData.img === "string") return cleanString(docData.img);
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

// 数値フォーマット
function formatNumber(num){
  return num.toLocaleString('ja-JP');
}

// ポイント計算
function calculatePoints(userData){
  let soukiCount = 0;
  let matsuriCount = 0;
  
  Object.keys(userData).forEach(key => {
    if(key === 'password' || key === 'secretQuestion' || key === 'secretAnswerHash' || 
       key === 'membershipPoint' || key === 'stampPoint' || key === 'colorsingPoint' || 
       key === 'totalPoint' || key === 'images' || key === 'createdAt') {
      return;
    }
    
    if(userData[key] === true){
      if(key.toLowerCase().startsWith('souki')){
        soukiCount++;
      } else if(key.toLowerCase().startsWith('matsuri')){
        matsuriCount++;
      }
    }
  });
  
  const stampPoints = soukiCount * 1000 + matsuriCount * 250;
  const membershipPoint = userData.membershipPoint || 0;
  const colorsingPoint = userData.colorsingPoint || 0;
  const totalPoints = membershipPoint + stampPoints + colorsingPoint;
  
  console.debug('calculatePoints:', { 
    soukiCount, 
    matsuriCount, 
    membershipPoint,
    stampPoints, 
    colorsingPoint, 
    totalPoints 
  });
  
  return {
    membershipPoint: membershipPoint,
    stampPoint: stampPoints,
    colorsingPoint: colorsingPoint,
    totalPoint: totalPoints
  };
}

// サインアップ状態
let signupState = 'start';

// サインアップ処理
signupBtn.addEventListener('click', async () => {
  try {
    signupBtn.disabled = true;
    const nickname = nicknameInput.value.trim();
    const password = passInput.value;

    if(!nickname){ showMessage('ニックネームを入力してください'); return; }
    if(password.length < 4){ showMessage('パスワードは4文字以上です'); return; }

    if(signupState === 'start'){
      secretQuestion.style.display = 'block';
      secretAnswer.style.display = 'block';
      recaptchaContainer.style.display = 'block';
      signupState = 'secret';
      showMessage('秘密の質問とreCAPTCHAを入力して、もう一度「新規登録」を押してください。','success');
      console.debug('signup: revealed secret inputs and reCAPTCHA');
      return;
    }

    // 実際の登録処理
    const question = secretQuestion.value.trim();
    const answer = secretAnswer.value.trim();
    const recaptchaResponse = grecaptcha.getResponse();
    
    if(!question || !answer){ 
      showMessage('秘密の質問と答えを入力してください'); 
      return; 
    }
    
    if(!recaptchaResponse){ 
      showMessage('reCAPTCHAを完了してください'); 
      return; 
    }

    const passwordHash = await hashPassword(password);
    const answerHash = await hashPassword(answer);
    
    console.debug('signup: calling createUser function');

console.log('Debug: Sending data to createUser:', {
  nickname: nickname,
  passwordHash: passwordHash.substring(0, 10) + '...',
  secretQuestion: question,
  secretAnswerHash: answerHash.substring(0, 10) + '...',
  recaptchaToken: recaptchaResponse ? 'EXISTS' : 'MISSING'
});

    // Cloud Function呼び出し
    const result = await createUserFunc({
      nickname: nickname,
      passwordHash: passwordHash,
      secretQuestion: question,
      secretAnswerHash: answerHash,
      recaptchaToken: recaptchaResponse
    });

    if(result.data.success){
      console.debug('signup: user created successfully');
      showMessage('新規登録しました。自動でログインします', 'success');
      
      secretQuestion.style.display = 'none';
      secretAnswer.style.display = 'none';
      recaptchaContainer.style.display = 'none';
      secretQuestion.value = '';
      secretAnswer.value = '';
      signupState = 'start';
      grecaptcha.reset();

      await loginUser(nickname, password, false);
    }
  } catch(err){
    console.error('signup error:', err);
    if(err.code === 'functions/already-exists'){
      showMessage('そのニックネームは既に使用されています');
    } else if(err.code === 'functions/permission-denied'){
      showMessage('reCAPTCHA検証に失敗しました。もう一度お試しください。');
      grecaptcha.reset();
    } else {
      showMessage('登録処理でエラーが発生しました：' + err.message);
    }
  } finally {
    signupBtn.disabled = false;
  }
});

// ログイン処理
loginBtn.addEventListener('click', async () => {
  const nickname = nicknameInput.value.trim();
  const password = passInput.value;
  if(!nickname){ showMessage('ニックネームを入力してください'); return; }
  if(!password){ showMessage('パスワードを入力してください'); return; }

  await loginUser(nickname, password, false);
});

async function loginUser(nickname, password, isSessionRestore){
  try {
    console.debug('loginUser start', nickname);
    const inputHash = await hashPassword(password);
    
    // Cloud Function呼び出し
    const result = await getUserDataFunc({
      nickname: nickname,
      passwordHash: inputHash,
      recaptchaToken: null
    });
    
    if(!result.data.success){
      showMessage('ログインに失敗しました');
      return;
    }
    
    const userData = result.data.data;
    
    sessionManager.saveSession(nickname, inputHash);
    
    showMessage('ログインしました', 'success');
    await updateUIAfterLogin(nickname, userData);
    
  } catch(err){
    console.error('login error:', err);
    if(err.code === 'functions/not-found'){
      showMessage('ユーザーが存在しません');
    } else if(err.code === 'functions/unauthenticated'){
      showMessage('パスワードが違います');
    } else if(err.code === 'functions/resource-exhausted'){
      showMessage('ログイン試行回数が多すぎます。10分後に再試行してください。');
    } else {
      showMessage('ログイン処理でエラーが発生しました：' + err.message);
    }
  }
}

// ログイン後のUI更新

// ユーザー情報表示
function displayUserInfo(nickname, userData){
  const points = calculatePoints(userData);
  
  membershipPointDisplay.textContent = `メンバーシップpt: ${formatNumber(points.membershipPoint)}`;
  stampPointDisplay.textContent = `スタンプpt: ${formatNumber(points.stampPoint)}`;
  colorsingPointDisplay.textContent = `カラシン推しpt: ${formatNumber(points.colorsingPoint)}`;
  totalPointDisplay.textContent = `総合計pt: ${formatNumber(points.totalPoint)}`;
  pointsDisplay.style.display = 'block';

  console.debug('displayUserInfo:', { nickname, ...points });
}

function clearUserInfo(){
  membershipPointDisplay.textContent = '';
  stampPointDisplay.textContent = '';
  colorsingPointDisplay.textContent = '';
  totalPointDisplay.textContent = '';
  pointsDisplay.style.display = 'none';
}

// ギャラリー
function loadUserGallery(userData){
  try {
    console.debug('loadUserGallery start');
    
    galleryImages.innerHTML = '';
    galleryContainer.style.display = 'none';
    
    const images = userData.images || [];
    
    if(images.length === 0){
      console.debug('no images in gallery');
      return;
    }
    
    images.forEach((imageUrl, index) => {
      const img = document.createElement('img');
      img.src = imageUrl;
      img.className = 'gallery-image';
      img.alt = `ギャラリー画像 ${index + 1}`;
      
      img.onerror = () => {
        console.warn(`ギャラリー画像が見つかりません: ${imageUrl}`);
      };
      
      galleryImages.appendChild(img);
    });
    
    galleryContainer.style.display = 'block';
    console.debug('loadUserGallery: loaded', images.length, 'images');
    
  } catch(err){
    console.error('ギャラリー読み込みエラー:', err);
  }
}

function clearUserGallery(){
  galleryImages.innerHTML = '';
  galleryContainer.style.display = 'none';
}

// ログアウト

// スタンプ押下
stampBtn.addEventListener('click', async () => {
  const session = sessionManager.getSession();
  if(!session){ showMessage('ログインしてください'); return; }

  const keyword = keywordInput.value.trim();
  if(!keyword){ showMessage('合言葉を入力してください'); return; }

  try{
    console.debug('stampBtn: calling stampKeyword function');
    
    const result = await stampKeywordFunc({
      nickname: session.nickname,
      passwordHash: session.passwordHash,
      keyword: keyword
    });
    
    if(result.data.success){
      showMessage('スタンプを押しました', 'success');
      
      cachedKeywords = null;
      
      const userData = await getUserDataFunc({
        nickname: session.nickname,
        passwordHash: session.passwordHash,
        recaptchaToken: null
      });
      
      if(userData.data.success){
        await loadStamps(session.nickname);
        displayUserInfo(session.nickname, userData.data.data);
      }
    }
  } catch(err){
    console.error('stampBtn error:', err);
    if(err.code === 'functions/not-found'){
      showMessage('その合言葉は存在しません');
    } else if(err.code === 'functions/unauthenticated'){
      showMessage('認証に失敗しました。再ログインしてください。');
      sessionManager.clearSession();
      window.location.reload();
    } else {
      showMessage('スタンプ押下に失敗しました：' + err.message);
    }
  }
});

// スタンプ描画
async function loadStamps(uid){
  clearStampsFromUI();
  
  const session = sessionManager.getSession();
  if(!session) return;
  
  try {
    const result = await getUserDataFunc({
      nickname: session.nickname,
      passwordHash: session.passwordHash,
      recaptchaToken: null
    });
    
    if(!result.data.success) return;
    const userData = result.data.data;

    const keywordCache = await loadAllKeywords();

    const w = cardContainer.clientWidth;
    const h = cardContainer.clientHeight;

    Object.keys(userData).forEach(keyword => {
      if(keyword === 'password' || keyword === 'secretQuestion' || keyword === 'secretAnswerHash' || 
         keyword === 'membershipPoint' || keyword === 'stampPoint' || keyword === 'colorsingPoint' || 
         keyword === 'totalPoint' || keyword === 'images' || keyword === 'createdAt') return;
      
      const d = keywordCache[keyword];
      if(!d) return;

      const norm = {};
      for(const k of Object.keys(d)){
        const cleanKey = k.replace(/^['"]+|['"]+$/g,'');
        norm[cleanKey] = d[k];
      }

      const src = extractImgField(norm);
      if(!src) return;
      const xPos = Number(norm.x);
      const yPos = Number(norm.y);
      const wPercent = Number(norm.widthPercent);

      const img = new Image();
      img.className = 'stamp';
      img.style.position = 'absolute';
      img.style.transform = 'translate(-50%, -50%)';
      img.style.left = (xPos*w)+'px';
      img.style.top = (yPos*h)+'px';
      img.style.width = (wPercent*w)+'px';

      img.onload = ()=> cardContainer.appendChild(img);
      img.onerror = ()=> console.warn(`画像が見つかりません: ${img.src}`);
      img.src = src;
    });
  } catch(err) {
    console.error('loadStamps error:', err);
  }
}

function clearStampsFromUI(){
  document.querySelectorAll('#card-container .stamp').forEach(e=>e.remove());
}

// パスワードリセット
forgotBtn.addEventListener('click', () => {
  resetSection.style.display = resetSection.style.display === 'none' ? 'block' : 'none';
  showMessage('');
  resetQuestionDiv.style.display = 'none';
  resetQuestionDiv.textContent = '';
  resetAnswer.style.display = 'none';
  resetAnswer.value = '';
  resetNewPass.style.display = 'none';
  resetNewPass.value = '';
  resetRecaptchaContainer.style.display = 'none';
  resetSetPassBtn.style.display = 'none';
});

resetStep1Btn.addEventListener('click', async () => {
  const nick = resetNickname.value.trim();
  if(!nick){ showMessage('リセットするニックネームを入力してください'); return; }
  
  try {
    console.debug('resetStep1: calling getSecretQuestion function');
    
    const result = await getSecretQuestionFunc({ nickname: nick });
    
    if(result.data.success){
      resetQuestionDiv.textContent = '秘密の質問：' + result.data.secretQuestion;
      resetQuestionDiv.style.display = 'block';
      resetAnswer.style.display = 'block';
      resetNewPass.style.display = 'block';
      resetRecaptchaContainer.style.display = 'block';
      resetSetPassBtn.style.display = 'inline-block';
      showMessage('秘密の質問が表示されました。答えと新しいパスワードを入力してください。','success');
      console.debug('reset: showed question for', nick);
    }
  } catch(err){
    console.error('resetStep1 error:', err);
    if(err.code === 'functions/not-found'){
      showMessage('ユーザーが存在しないか、秘密の質問が設定されていません');
    } else {
      showMessage('処理中にエラーが発生しました：' + err.message);
    }
  }
});

resetSetPassBtn.addEventListener('click', async () => {
  const nick = resetNickname.value.trim();
  const answer = resetAnswer.value.trim();
  const newPass = resetNewPass.value;
  const recaptchaResponse = grecaptcha.getResponse(1); // 2つ目のreCAPTCHA
  
  if(!answer){ showMessage('秘密の質問の答えを入力してください'); return; }
  if(!newPass || newPass.length < 4){ showMessage('新しいパスワードは4文字以上にしてください'); return; }
  if(!recaptchaResponse){ showMessage('reCAPTCHAを完了してください'); return; }
  
  try {
    console.debug('resetPassword: calling resetPassword function');
    
    const result = await resetPasswordFunc({
      nickname: nick,
      secretAnswer: answer,
      newPassword: newPass,
      recaptchaToken: recaptchaResponse
    });
    
    if(result.data.success){
      showMessage('パスワードを更新しました。自動でログインします', 'success');
      console.debug('reset: password updated for', nick);
      
      await loginUser(nick, newPass, false);

      resetSection.style.display = 'none';
      resetNickname.value = '';
      resetQuestionDiv.textContent = '';
      resetAnswer.value = '';
      resetNewPass.value = '';
      grecaptcha.reset(1);
    }
  } catch(err){
    console.error('resetPassword error:', err);
    if(err.code === 'functions/unauthenticated'){
      showMessage('秘密の質問の答えが正しくありません');
    } else if(err.code === 'functions/permission-denied'){
      showMessage('reCAPTCHA検証に失敗しました。もう一度お試しください。');
      grecaptcha.reset(1);
    } else {
      showMessage('パスワード更新でエラーが発生しました：' + err.message);
    }
  }
});

resetCancelBtn.addEventListener('click', () => {
  resetSection.style.display = 'none';
  resetNickname.value = '';
  resetQuestionDiv.textContent = '';
  resetAnswer.value = '';
  resetNewPass.value = '';
  showMessage('');
});

// セッション復元
window.addEventListener('DOMContentLoaded', async () => {
  const session = sessionManager.getSession();
  if (!session) {
    console.debug('No active session - showing login screen');
    return;
  }
  
  try {
    console.debug('Restoring session for', session.nickname);
    
    const result = await getUserDataFunc({
      nickname: session.nickname,
      passwordHash: session.passwordHash,
      recaptchaToken: null
    });
    
    if(!result.data.success){
      console.warn('Session invalid, clearing');
      sessionManager.clearSession();
      return;
    }
    
    const userData = result.data.data;
    
    nicknameInput.value = session.nickname;
    await updateUIAfterLogin(session.nickname, userData);
    
    console.log('前回のセッションを復元しました');
    
  } catch (err) {
    console.error('Session restoration failed:', err);
    sessionManager.clearSession();
    showMessage('セッションの復元に失敗しました。再ログインしてください。');
  }
});

// ========================================
// 曲リクエスト機能の追加
// ========================================

// Cloud Functions呼び出しを追加（ファイル冒頭の他のhttpsCallableの近くに追加）
const sendSongRequestFunc = httpsCallable(functions, 'sendSongRequest');
const getCurrentRequestFunc = httpsCallable(functions, 'getCurrentRequest');

// DOM要素（他のDOM要素定義の近くに追加）
const requestSection = document.getElementById('request-section');
const requestForm = document.getElementById('request-form');
const requestPending = document.getElementById('request-pending');
const songTitleInput = document.getElementById('song-title');
const artistNameInput = document.getElementById('artist-name');
const sendRequestBtn = document.getElementById('send-request-btn');
const requestMsg = document.getElementById('request-msg');
const pendingSongTitle = document.getElementById('pending-song-title');
const pendingArtistName = document.getElementById('pending-artist-name');

// リクエストメッセージ表示
function showRequestMessage(msg, type='error'){
  requestMsg.textContent = msg;
  requestMsg.style.color = type === 'error' ? '#d32f2f' : '#2e7d32';
  console.debug('[Request message]', type, msg);
}

// 現在のリクエスト状態を確認
async function checkCurrentRequest() {
  const session = sessionManager.getSession();
  if (!session) return;
  
  try {
    const result = await getCurrentRequestFunc({
      nickname: session.nickname,
      passwordHash: session.passwordHash
    });
    
    if (result.data.success && result.data.hasRequest) {
      // 未承認のリクエストがある
      pendingSongTitle.textContent = result.data.songTitle;
      pendingArtistName.textContent = result.data.artistName;
      requestForm.style.display = 'none';
      requestPending.style.display = 'block';
      console.debug('Pending request found:', result.data);
    } else {
      // リクエストなし、または承認済み
      requestForm.style.display = 'block';
      requestPending.style.display = 'none';
      songTitleInput.value = '';
      artistNameInput.value = '';
    }
  } catch (err) {
    console.error('checkCurrentRequest error:', err);
  }
}

// リクエスト送信
sendRequestBtn.addEventListener('click', async () => {
  const session = sessionManager.getSession();
  if (!session) {
    showRequestMessage('ログインしてください');
    return;
  }
  
  const songTitle = songTitleInput.value.trim();
  const artistName = artistNameInput.value.trim();
  
  if (!songTitle) {
    showRequestMessage('曲名を入力してください');
    return;
  }
  
  if (!artistName) {
    showRequestMessage('アーティスト名を入力してください');
    return;
  }
  
  try {
    sendRequestBtn.disabled = true;
    showRequestMessage('送信中...', 'success');
    
    const result = await sendSongRequestFunc({
      nickname: session.nickname,
      passwordHash: session.passwordHash,
      songTitle: songTitle,
      artistName: artistName
    });
    
    if (result.data.success) {
      showRequestMessage('リクエストを送信しました！', 'success');
      
      // 送信済み表示に切り替え
      pendingSongTitle.textContent = songTitle;
      pendingArtistName.textContent = artistName;
      requestForm.style.display = 'none';
      requestPending.style.display = 'block';
      
      console.debug('Song request sent successfully');
    }
  } catch (err) {
    console.error('sendRequest error:', err);
    if (err.code === 'functions/already-exists') {
      showRequestMessage('前回のリクエストが未承認です。承認されるまでお待ちください。');
      // 状態を再確認
      await checkCurrentRequest();
    } else if (err.code === 'functions/unauthenticated') {
      showRequestMessage('認証に失敗しました。再ログインしてください。');
      sessionManager.clearSession();
      window.location.reload();
    } else {
      showRequestMessage('送信に失敗しました：' + err.message);
    }
  } finally {
    sendRequestBtn.disabled = false;
  }
});

// ログイン後のUI更新関数を修正（既存のupdateUIAfterLogin関数を以下のように修正）
// 元の関数の最後に以下を追加
async function updateUIAfterLogin(nickname, userData) {
  pageTitle.textContent = `${nickname}さんのマイページ`;
  
  nicknameInput.style.display = 'none';
  passInput.style.display = 'none';
  loginBtn.style.display = 'none';
  signupBtn.style.display = 'none';
  logoutBtn.style.display = 'inline-block';
  passwordMsg.style.display = 'none';
  passwordNote.style.display = 'none';
  keywordSec.style.display = 'block';

  resetSection.style.display = 'none';

  displayUserInfo(nickname, userData);
  loadUserGallery(userData);
  await loadStamps(nickname);
  
  // 🆕 リクエストセクションを表示して状態を確認
  requestSection.style.display = 'block';
  await checkCurrentRequest();
}

// ログアウト処理を修正（既存のlogoutBtn.addEventListenerを以下のように修正）
// 元の処理の最後に以下を追加
logoutBtn.addEventListener('click', () => {
  sessionManager.clearSession();
  
  pageTitle.textContent = 'マイページ';
  
  nicknameInput.style.display = 'inline-block';
  passInput.style.display = 'inline-block';
  loginBtn.style.display = 'inline-block';
  signupBtn.style.display = 'inline-block';
  logoutBtn.style.display = 'none';
  passwordMsg.style.display = 'block';
  passwordNote.style.display = 'block';
  keywordSec.style.display = 'none';
  clearStampsFromUI();
  clearUserInfo();
  clearUserGallery();
  showMessage('');
  
  signupState = 'start';
  secretQuestion.style.display = 'none';
  secretAnswer.style.display = 'none';
  recaptchaContainer.style.display = 'none';
  
  nicknameInput.value = '';
  passInput.value = '';
  keywordInput.value = '';
  
  // 🆕 リクエストセクションを非表示
  requestSection.style.display = 'none';
  songTitleInput.value = '';
  artistNameInput.value = '';
  requestForm.style.display = 'block';
  requestPending.style.display = 'none';
  showRequestMessage('');
});
