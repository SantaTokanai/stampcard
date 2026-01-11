import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// Firebase 設定 (編集しないでください)
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

// ============================================
// 🆕 セッション管理クラス（新機能）
// ============================================
class SessionManager {
  constructor() {
    this.storageKey = 'stampcard_session';
  }
  
  // ログイン時にセッション保存
  saveSession(nickname, passwordHash) {
    const sessionData = {
      nickname: nickname,
      passwordHash: passwordHash,
      timestamp: Date.now()
    };
    sessionStorage.setItem(this.storageKey, JSON.stringify(sessionData));
    console.debug('Session saved for', nickname);
  }
  
  // セッション取得
  getSession() {
    const data = sessionStorage.getItem(this.storageKey);
    if (!data) return null;
    
    try {
      const session = JSON.parse(data);
      // 24時間以上経過していたら無効
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
  
  // セッションクリア
  clearSession() {
    sessionStorage.removeItem(this.storageKey);
    console.debug('Session cleared');
  }
}

const sessionManager = new SessionManager();

// ============================================
// 🆕 キーワードキャッシュ（高速化）
// ============================================
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

// DOM
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
const cardBg = document.querySelector('.card-bg');
const pageTitle = document.getElementById('page-title');

const secretQuestion = document.getElementById('secret-question');
const secretAnswer = document.getElementById('secret-answer');

const forgotBtn = document.getElementById('forgot-password');
const resetSection = document.getElementById('reset-section');
const resetNickname = document.getElementById('reset-nickname');
const resetStep1Btn = document.getElementById('reset-step1-btn');
const resetQuestionDiv = document.getElementById('reset-question');
const resetAnswer = document.getElementById('reset-answer');
const resetVerifyBtn = document.getElementById('reset-verify-btn');
const resetNewPass = document.getElementById('reset-newpass');
const resetSetPassBtn = document.getElementById('reset-setpass-btn');
const resetCancelBtn = document.getElementById('reset-cancel');

// ポイント表示用のDOM要素
const pointsDisplay = document.getElementById('points-display');
const membershipPointDisplay = document.getElementById('membership-point-display');
const stampPointDisplay = document.getElementById('stamp-point-display');
const colorsingPointDisplay = document.getElementById('colorsing-point-display');
const totalPointDisplay = document.getElementById('total-point-display');

// ギャラリー表示用のDOM要素
const galleryContainer = document.getElementById('gallery-container');
const galleryImages = document.getElementById('gallery-images');

// メッセージ表示
function showMessage(msg, type='error'){
  errorMsg.textContent = msg;
  errorMsg.className = type === 'error' ? 'error' : 'success';
  console.debug('[UI message]', type, msg);
}

// --------------------------------------------
// パスワードハッシュ化 (SHA-256)
// --------------------------------------------
async function hashPassword(str){
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2,'0')).join('');
  return hashHex;
}

// --------------------------------------------
// Firestore ヘルパー
// --------------------------------------------
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

// --------------------------------------------
// 数値をカンマ区切りにフォーマット
// --------------------------------------------
function formatNumber(num){
  return num.toLocaleString('ja-JP');
}

// --------------------------------------------
// スタンプからポイントを自動計算
// --------------------------------------------
function calculatePoints(userData){
  let soukiCount = 0;
  let matsuriCount = 0;
  
  // すべてのフィールドをチェック
  Object.keys(userData).forEach(key => {
    // 認証情報とポイントフィールドはスキップ
    if(key === 'password' || key === 'secretQuestion' || key === 'secretAnswerHash' || 
       key === 'membershipPoint' || key === 'stampPoint' || key === 'colorsingPoint' || key === 'totalPoint' || key === 'images') {
      return;
    }
    
    // trueのスタンプのみカウント
    if(userData[key] === true){
      // soukiで始まるスタンプ
      if(key.toLowerCase().startsWith('souki')){
        soukiCount++;
      }
      // matsuriで始まるスタンプ
      else if(key.toLowerCase().startsWith('matsuri')){
        matsuriCount++;
      }
    }
  });
  
  // ポイント計算
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

// --------------------------------------------
// 状態（signup の段階管理）
// --------------------------------------------
let signupState = 'start';

// --------------------------------------------
// サインアップ処理（2段階）
// --------------------------------------------
signupBtn.addEventListener('click', async () => {
  try {
    signupBtn.disabled = true;
    const nickname = nicknameInput.value.trim();
    const password = passInput.value;

    if(!nickname){ showMessage('ニックネームを入力してください'); return; }
    if(password.length < 3){ showMessage('パスワードは3文字以上です'); return; }

    if(signupState === 'start'){
      // 秘密欄を表示して2段階目へ
      secretQuestion.style.display = 'block';
      secretAnswer.style.display = 'block';
      signupState = 'secret';
      showMessage('秘密の質問と答えを入力して、もう一度「新規登録」を押してください。','success');
      console.debug('signup: revealed secret inputs');
      return;
    }

    // signupState === 'secret' -> 実際の登録処理
    const question = secretQuestion.value.trim();
    const answer = secretAnswer.value.trim();
    if(!question || !answer){ showMessage('秘密の質問と答えを入力してください'); return; }

    const userDocRef = doc(db,'users',nickname);
    const userSnap = await getDoc(userDocRef);

    if(userSnap.exists()){ showMessage('そのニックネームは既に使用されています'); return; }

    const passwordHash = await hashPassword(password);
    const answerHash = await hashPassword(answer);
    
    await setDoc(userDocRef, {
      password: passwordHash,
      secretQuestion: question,
      secretAnswerHash: answerHash
    }, { merge: true });

    console.debug('signup: user created', { nickname, passwordHashSnippet: passwordHash.slice(0,8), answerHashSnippet: answerHash.slice(0,8) });
    showMessage('新規登録しました。自動でログインします', 'success');

    // 初期状態に戻す（UI）
    secretQuestion.style.display = 'none';
    secretAnswer.style.display = 'none';
    secretQuestion.value = '';
    secretAnswer.value = '';
    signupState = 'start';

    // 自動ログイン
    await loginUser(nickname, password);
  } catch(err){
    console.error(err);
    showMessage('登録処理でエラーが発生しました：' + (err.message || err));
  } finally {
    signupBtn.disabled = false;
  }
});

// --------------------------------------------
// ログイン処理
// --------------------------------------------
loginBtn.addEventListener('click', async () => {
  const nickname = nicknameInput.value.trim();
  const password = passInput.value;
  if(!nickname){ showMessage('ニックネームを入力してください'); return; }
  if(!password){ showMessage('パスワードを入力してください'); return; }

  await loginUser(nickname, password);
});

async function loginUser(nickname, password){
  try {
    console.debug('loginUser start', nickname);
    const userDocRef = doc(db,'users',nickname);
    const userSnap = await getDoc(userDocRef);

    if(!userSnap.exists()){ showMessage('ユーザーが存在しません'); return; }

    const userData = userSnap.data();
    if(!userData.password){ showMessage('パスワードが設定されていません'); return; }

    const inputHash = await hashPassword(password);
    if(inputHash !== userData.password){ showMessage('パスワードが違います'); return; }

    // 🆕 セッション保存
    sessionManager.saveSession(nickname, inputHash);

    // 成功時：UI切替
    showMessage('ログインしました', 'success');
    
    // UI更新を共通関数に移動
    updateUIAfterLogin(nickname, userData);
    
  } catch(err){
    console.error(err);
    showMessage('ログイン処理でエラーが発生しました：' + (err.message || err));
  }
}

// 🆕 ログイン後のUI更新を共通化
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
}

// --------------------------------------------
// ユーザー情報（ポイント）を表示
// --------------------------------------------
function displayUserInfo(nickname, userData){
  const points = calculatePoints(userData);
  
  membershipPointDisplay.textContent = `メンバーシップpt: ${formatNumber(points.membershipPoint)}`;
  stampPointDisplay.textContent = `スタンプpt: ${formatNumber(points.stampPoint)}`;
  colorsingPointDisplay.textContent = `カラシン推しpt: ${formatNumber(points.colorsingPoint)}`;
  totalPointDisplay.textContent = `総合計pt: ${formatNumber(points.totalPoint)}`;
  pointsDisplay.style.display = 'block';

  console.debug('displayUserInfo:', { nickname, ...points });
}

// --------------------------------------------
// ユーザー情報表示をクリア
// --------------------------------------------
function clearUserInfo(){
  membershipPointDisplay.textContent = '';
  stampPointDisplay.textContent = '';
  colorsingPointDisplay.textContent = '';
  totalPointDisplay.textContent = '';
  pointsDisplay.style.display = 'none';
}

// --------------------------------------------
// ギャラリー画像を読み込んで表示
// --------------------------------------------
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

// --------------------------------------------
// ギャラリー画像をクリア
// --------------------------------------------
function clearUserGallery(){
  galleryImages.innerHTML = '';
  galleryContainer.style.display = 'none';
}

// --------------------------------------------
// ログアウト処理
// --------------------------------------------
logoutBtn.addEventListener('click', () => {
  // 🆕 セッションクリア
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
  
  // 🆕 入力欄もクリア
  nicknameInput.value = '';
  passInput.value = '';
  keywordInput.value = '';
});

// --------------------------------------------
// スタンプ処理
// --------------------------------------------
stampBtn.addEventListener('click', async () => {
  const nickname = nicknameInput.value.trim();
  if(!nickname){ showMessage('ログインしてください'); return; }

  const keyword = keywordInput.value.trim();
  if(!keyword){ showMessage('合言葉を入力してください'); return; }

  try{
    const kwSnap = await getDoc(doc(db,'keywords',keyword));
    if(!kwSnap.exists()){ showMessage('その合言葉は存在しません'); return; }

    const userDocRef = doc(db,'users',nickname);
    await setDoc(userDocRef,{[keyword]:true},{merge:true});
    showMessage('スタンプを押しました', 'success');
    
    // 🆕 キャッシュをクリア（新しいスタンプが追加されたため）
    cachedKeywords = null;
    
    await loadStamps(nickname);
    
    const updatedUserSnap = await getDoc(userDocRef);
    if(updatedUserSnap.exists()){
      displayUserInfo(nickname, updatedUserSnap.data());
    }
  } catch(err){
    console.error(err);
    showMessage('スタンプ押下に失敗しました：' + (err.message || err));
  }
});

// --------------------------------------------
// 🆕 スタンプ描画（高速化版）
// --------------------------------------------
async function loadStamps(uid){
  clearStampsFromUI();
  const userSnap = await getDoc(doc(db,'users',uid));
  if(!userSnap.exists()) return;
  const userData = userSnap.data();

  // 🆕 全キーワードを一度に取得（キャッシュ使用）
  const keywordCache = await loadAllKeywords();

  const w = cardContainer.clientWidth;
  const h = cardContainer.clientHeight;

  Object.keys(userData).forEach(keyword => {
    // スキップ対象
    if(keyword === 'password' || keyword === 'secretQuestion' || keyword === 'secretAnswerHash' || 
       keyword === 'membershipPoint' || keyword === 'stampPoint' || keyword === 'colorsingPoint' || 
       keyword === 'totalPoint' || keyword === 'images') return;
    
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
}

function clearStampsFromUI(){
  document.querySelectorAll('#card-container .stamp').forEach(e=>e.remove());
}

// --------------------------------------------
// パスワードリセット機能
// --------------------------------------------
forgotBtn.addEventListener('click', () => {
  resetSection.style.display = resetSection.style.display === 'none' ? 'block' : 'none';
  showMessage('');
  resetQuestionDiv.style.display = 'none';
  resetQuestionDiv.textContent = '';
  resetAnswer.style.display = 'none';
  resetAnswer.value = '';
  resetVerifyBtn.style.display = 'none';
  resetNewPass.style.display = 'none';
  resetNewPass.value = '';
  resetSetPassBtn.style.display = 'none';
});

resetStep1Btn.addEventListener('click', async () => {
  const nick = resetNickname.value.trim();
  if(!nick){ showMessage('リセットするニックネームを入力してください'); return; }
  try {
    const userSnap = await getDoc(doc(db,'users',nick));
    if(!userSnap.exists()){ showMessage('そのニックネームは存在しません'); return; }
    const d = userSnap.data();
    if(!d.secretQuestion){ showMessage('このアカウントは秘密の質問が設定されていません'); return; }
    resetQuestionDiv.textContent = '秘密の質問：' + d.secretQuestion;
    resetQuestionDiv.style.display = 'block';
    resetAnswer.style.display = 'block';
    resetVerifyBtn.style.display = 'inline-block';
    showMessage('秘密の質問が表示されました。答えを入力してください。','success');
    console.debug('reset: showed question for', nick);
  } catch(err){
    console.error(err);
    showMessage('処理中にエラーが発生しました：' + (err.message || err));
  }
});

resetVerifyBtn.addEventListener('click', async () => {
  const nick = resetNickname.value.trim();
  const answer = resetAnswer.value.trim();
  if(!nick || !answer){ showMessage('ニックネームと答えを入力してください'); return; }
  try {
    const userDocRef = doc(db,'users',nick);
    const userSnap = await getDoc(userDocRef);
    if(!userSnap.exists()){ showMessage('そのニックネームは存在しません'); return; }
    const d = userSnap.data();
    if(!d.secretAnswerHash){ showMessage('秘密の質問の答えが設定されていません'); return; }

    const answerHash = await hashPassword(answer);
    if(answerHash !== d.secretAnswerHash){ showMessage('秘密の質問の答えが違います'); return; }

    resetNewPass.style.display = 'block';
    resetSetPassBtn.style.display = 'inline-block';
    showMessage('認証成功。新しいパスワードを入力してください。','success');
    console.debug('reset: answer correct for', nick);
  } catch(err){
    console.error(err);
    showMessage('処理中にエラーが発生しました：' + (err.message || err));
  }
});

resetSetPassBtn.addEventListener('click', async () => {
  const nick = resetNickname.value.trim();
  const newPass = resetNewPass.value;
  if(!newPass || newPass.length < 3){ showMessage('新しいパスワードは3文字以上にしてください'); return; }
  try {
    const newHash = await hashPassword(newPass);
    await setDoc(doc(db,'users',nick), { password: newHash }, { merge: true });
    showMessage('パスワードを更新しました。自動でログインします', 'success');
    console.debug('reset: password updated for', nick, 'hashSnippet:', newHash.slice(0,8));
    
    await loginUser(nick, newPass);

    resetSection.style.display = 'none';
    resetNickname.value = '';
    resetQuestionDiv.textContent = '';
    resetAnswer.value = '';
    resetNewPass.value = '';
  } catch(err){
    console.error(err);
    showMessage('パスワード更新でエラーが発生しました：' + (err.message || err));
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

// ============================================
// 🆕 ページ読み込み時にセッション復元（新機能）
// ============================================
window.addEventListener('DOMContentLoaded', async () => {
  const session = sessionManager.getSession();
  if (!session) {
    console.debug('No active session - showing login screen');
    return;
  }
  
  try {
    console.debug('Restoring session for', session.nickname);
    const userDocRef = doc(db, 'users', session.nickname);
    const userSnap = await getDoc(userDocRef);
    
    if (!userSnap.exists()) {
      console.warn('User not found, clearing session');
      sessionManager.clearSession();
      return;
    }
    
    const userData = userSnap.data();
    
    // パスワードハッシュが一致するか確認
    if (session.passwordHash !== userData.password) {
      console.warn('Session password mismatch, clearing session');
      sessionManager.clearSession();
      showMessage('セッションが無効です。再ログインしてください。');
      return;
    }
    
    // UI復元
    nicknameInput.value = session.nickname;
    await updateUIAfterLogin(session.nickname, userData);
    
    console.log('前回のセッションを復元しました');
    
  } catch (err) {
    console.error('Session restoration failed:', err);
    sessionManager.clearSession();
    showMessage('セッションの復元に失敗しました。再ログインしてください。');
  }
});
