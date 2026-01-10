import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

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
const secretHint = document.getElementById('secret-hint');

const forgotBtn = document.getElementById('forgot-password');
const resetRequestSection = document.getElementById('reset-request-section');
const requestNickname = document.getElementById('request-nickname');
const requestMessage = document.getElementById('request-message');
const requestSubmitBtn = document.getElementById('request-submit-btn');
const requestCancelBtn = document.getElementById('request-cancel-btn');
const requestMsg = document.getElementById('request-msg');

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
  
  Object.keys(userData).forEach(key => {
    if(key === 'membershipPoint' || key === 'stampPoint' || key === 'colorsingPoint' || key === 'totalPoint' || key === 'images') {
      return;
    }
    
    if(userData[key] === true){
      if(key.toLowerCase().startsWith('souki')){
        soukiCount++;
      }
      else if(key.toLowerCase().startsWith('matsuri')){
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

// --------------------------------------------
// 状態（signup の段階管理）
// --------------------------------------------
let signupState = 'start';

// --------------------------------------------
// サインアップ処理（2段階・public/private分離版）
// --------------------------------------------
signupBtn.addEventListener('click', async () => {
  try {
    signupBtn.disabled = true;
    const nickname = nicknameInput.value.trim();
    const password = passInput.value;

    if(!nickname){ showMessage('ニックネームを入力してください'); return; }
    
    // パスワード強度チェック
    if(password.length < 4){ 
      showMessage('パスワードは4文字以上にしてください'); 
      return; 
    }
    
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    if(!hasLetter || !hasNumber){
      showMessage('パスワードは英字と数字を両方含めてください');
      return;
    }

    if(signupState === 'start'){
      secretQuestion.style.display = 'block';
      secretAnswer.style.display = 'block';
      secretHint.style.display = 'block';
      signupState = 'secret';
      showMessage('秘密の質問と答えを入力して、もう一度「新規登録」を押してください。','success');
      console.debug('signup: revealed secret inputs');
      return;
    }

    // signupState === 'secret' -> 実際の登録処理
    const question = secretQuestion.value.trim();
    const answer = secretAnswer.value.trim();
    
    if(!question || !answer){ 
      showMessage('秘密の質問と答えを入力してください'); 
      return; 
    }
    
    // 秘密の質問の長さチェック
    if(question.length < 5){
      showMessage('秘密の質問は55文字以上にしてください');
      return;
    }
    
    // 秘密の答えの長さチェック
    if(answer.length < 3){
      showMessage('秘密の質問の答えは3文字以上にしてください');
      return;
    }

    // 既存ユーザーチェック（users_publicで確認）
    const publicDocRef = doc(db,'users_public',nickname);
    const publicSnap = await getDoc(publicDocRef);

    if(publicSnap.exists()){ 
      showMessage('そのニックネームは既に使用されています'); 
      return; 
    }

    const passwordHash = await hashPassword(password);
    const answerHash = await hashPassword(answer);
    
    // users_privateに秘密情報を保存
    await setDoc(doc(db,'users_private',nickname), {
      password: passwordHash,
      secretQuestion: question,
      secretAnswerHash: answerHash
    });
    
    // users_publicに公開情報を保存（初期状態は空）
    await setDoc(doc(db,'users_public',nickname), {
      membershipPoint: 0,
      colorsingPoint: 0
    });

    console.debug('signup: user created', { nickname, passwordHashSnippet: passwordHash.slice(0,8) });
    showMessage('新規登録しました。自動でログインします', 'success');

    // 初期状態に戻す（UI）
    secretQuestion.style.display = 'none';
    secretAnswer.style.display = 'none';
    secretHint.style.display = 'none';
    secretQuestion.value = '';
    secretAnswer.value = '';
    signupState = 'start';

    await loginUser(nickname, password);
  } catch(err){
    console.error(err);
    showMessage('登録処理でエラーが発生しました：' + (err.message || err));
  } finally {
    signupBtn.disabled = false;
  }
});

// --------------------------------------------
// ログイン処理（public/private分離版）
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
    
    // users_privateからパスワードを取得
    const privateDocRef = doc(db,'users_private',nickname);
    const privateSnap = await getDoc(privateDocRef);

    if(!privateSnap.exists()){ 
      showMessage('ユーザーが存在しません'); 
      return; 
    }

    const privateData = privateSnap.data();
    if(!privateData.password){ 
      showMessage('パスワードが設定されていません'); 
      return; 
    }

    const inputHash = await hashPassword(password);
    if(inputHash !== privateData.password){ 
      showMessage('パスワードが違います'); 
      return; 
    }

    // users_publicから公開情報を取得
    const publicDocRef = doc(db,'users_public',nickname);
    const publicSnap = await getDoc(publicDocRef);
    
    if(!publicSnap.exists()){
      showMessage('ユーザーデータが見つかりません');
      return;
    }
    
    const publicData = publicSnap.data();

    // 成功時：UI切替
    showMessage('ログインしました', 'success');
    
    pageTitle.textContent = `${nickname}さんのマイページ`;
    
    nicknameInput.style.display = 'none';
    passInput.style.display = 'none';
    loginBtn.style.display = 'none';
    signupBtn.style.display = 'none';
    logoutBtn.style.display = 'inline-block';
    passwordMsg.style.display = 'none';
    passwordNote.style.display = 'none';
    keywordSec.style.display = 'block';

    resetRequestSection.style.display = 'none';

    displayUserInfo(nickname, publicData);
    loadUserGallery(publicData);
    await loadStamps(nickname, publicData);
  } catch(err){
    console.error(err);
    showMessage('ログイン処理でエラーが発生しました：' + (err.message || err));
  }
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
  secretHint.style.display = 'none';
});

// --------------------------------------------
// スタンプ処理（public/private分離版）
// --------------------------------------------
stampBtn.addEventListener('click', async () => {
  const nickname = nicknameInput.value.trim();
  if(!nickname){ showMessage('ログインしてください'); return; }

  const keyword = keywordInput.value.trim();
  if(!keyword){ showMessage('合言葉を入力してください'); return; }

  try{
    const kwSnap = await getDoc(doc(db,'keywords',keyword));
    if(!kwSnap.exists()){ showMessage('その合言葉は存在しません'); return; }

    // users_publicにスタンプを追加
    const publicDocRef = doc(db,'users_public',nickname);
    await setDoc(publicDocRef,{[keyword]:true},{merge:true});
    showMessage('スタンプを押しました', 'success');
    
    // 更新されたデータを取得
    const updatedPublicSnap = await getDoc(publicDocRef);
    if(updatedPublicSnap.exists()){
      const updatedData = updatedPublicSnap.data();
      await loadStamps(nickname, updatedData);
      displayUserInfo(nickname, updatedData);
    }
  } catch(err){
    console.error(err);
    showMessage('スタンプ押下に失敗しました：' + (err.message || err));
  }
});

// --------------------------------------------
// スタンプ描画（publicDataを受け取る版）
// --------------------------------------------
async function loadStamps(nickname, publicData){
  clearStampsFromUI();

  const w = cardContainer.clientWidth;
  const h = cardContainer.clientHeight;

  const promises = Object.keys(publicData).map(async keyword=>{
    // スキップ対象：ポイント4種、images配列
    if(keyword === 'membershipPoint' || keyword === 'stampPoint' || keyword === 'colorsingPoint' || keyword === 'totalPoint' || keyword === 'images') return;
    
    const kwSnap = await getDoc(doc(db,'keywords',keyword));
    if(!kwSnap.exists()) return;
    const d = kwSnap.data();

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

  await Promise.all(promises);
}

function clearStampsFromUI(){
  document.querySelectorAll('#card-container .stamp').forEach(e=>e.remove());
}

// --------------------------------------------
// パスワードリセット依頼機能
// --------------------------------------------
forgotBtn.addEventListener('click', () => {
  resetRequestSection.style.display = resetRequestSection.style.display === 'none' ? 'block' : 'none';
  showMessage('');
  requestNickname.value = '';
  requestMessage.value = '';
  requestMsg.textContent = '';
});

requestSubmitBtn.addEventListener('click', async () => {
  const nickname = requestNickname.value.trim();
  const message = requestMessage.value.trim();
  
  if(!nickname){
    requestMsg.textContent = 'ニックネームを入力してください';
    requestMsg.className = 'error';
    return;
  }
  
  try {
    // Firestoreに依頼を保存
    const requestId = `request_${Date.now()}`;
    await setDoc(doc(db, 'password_reset_requests', requestId), {
      nickname: nickname,
      message: message || '（メッセージなし）',
      timestamp: Date.now(),
      status: 'pending'
    });
    
    requestMsg.textContent = '✅ 依頼を送信しました。管理者が確認次第、対応いたします。';
    requestMsg.style.color = '#0a0';
    
    // フォームをクリア
    requestNickname.value = '';
    requestMessage.value = '';
    
    console.debug('password reset request sent:', { nickname, requestId });
    
  } catch(err){
    console.error(err);
    requestMsg.textContent = '送信に失敗しました。もう一度お試しください。';
    requestMsg.style.color = '#a00';
  }
});

requestCancelBtn.addEventListener('click', () => {
  resetRequestSection.style.display = 'none';
  requestNickname.value = '';
  requestMessage.value = '';
  requestMsg.textContent = '';
  showMessage('');
});
