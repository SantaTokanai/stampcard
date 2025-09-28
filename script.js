import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { sha256 } from "https://cdnjs.cloudflare.com/ajax/libs/js-sha256/0.9.0/sha256.min.js";

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

// DOM
const nicknameInput = document.getElementById('nickname');
const passInput = document.getElementById('password');
const loginBtn = document.getElementById('login');
const signupBtn = document.getElementById('signup');
const logoutBtn = document.getElementById('logout');
const errorMsg = document.getElementById('error-msg');
const secretSec = document.getElementById('secret-section');
const secretQInput = document.getElementById('secretQ');
const secretAInput = document.getElementById('secretA');
const keywordSec = document.getElementById('keyword-section');
const keywordInput = document.getElementById('keyword');
const stampBtn = document.getElementById('stampBtn');
const cardContainer = document.getElementById('card-container');

// パスワードリセット
const forgotLink = document.getElementById('forgot-password');
const resetSection = document.getElementById('reset-section');
const resetNickname = document.getElementById('reset-nickname');
const resetStartBtn = document.getElementById('reset-start');
const resetQuestionDiv = document.getElementById('reset-question');
const showQuestionDiv = document.getElementById('show-question');
const resetAnswerInput = document.getElementById('reset-answer');
const resetNewPass = document.getElementById('reset-newpass');
const resetSubmitBtn = document.getElementById('reset-submit');

function showMessage(msg, type='error'){
  errorMsg.textContent = msg;
  errorMsg.className = type==='error'?'error':'success';
}

// パスワードハッシュ化
async function hashPassword(pw){ return sha256(pw); }

// --------------------------------------------
// 新規登録
// --------------------------------------------
signupBtn.addEventListener('click', async ()=>{
  const nickname = nicknameInput.value.trim();
  if(!nickname){ showMessage('ニックネームを入力してください'); return; }

  const password = passInput.value;
  const secretQ = secretQInput.value.trim();
  const secretA = secretAInput.value.trim();

  if(!password || !secretQ || !secretA){ showMessage('パスワードと秘密質問・答えを入力してください'); return; }

  const pwHash = await hashPassword(password);
  try{
    await setDoc(doc(db,'users',nickname),{
      password: pwHash,
      secretQ,
      secretA
    });
    showMessage('新規登録しました。自動でログインします','success');
    handleLogin();
  }catch(err){
    showMessage('登録処理でエラー：'+err.message);
    console.error(err);
  }
});

// --------------------------------------------
// ログイン
// --------------------------------------------
loginBtn.addEventListener('click', handleLogin);

async function handleLogin(){
  const nickname = nicknameInput.value.trim();
  if(!nickname){ showMessage('ニックネームを入力してください'); return; }

  const password = passInput.value;
  if(!password){ showMessage('パスワードを入力してください'); return; }

  try{
    const userSnap = await getDoc(doc(db,'users',nickname));
    if(!userSnap.exists()){ showMessage('ユーザーが存在しません'); return; }
    const userData = userSnap.data();
    const pwHash = await hashPassword(password);
    if(pwHash !== userData.password){ showMessage('パスワードが違います'); return; }

    // ログイン成功：UI切替
    showMessage('ログインしました','success');
    document.getElementById('auth-section').style.display = 'none';
    logoutBtn.style.display = 'inline-block';
    keywordSec.style.display = 'block';
    loadStamps(nickname);
  }catch(err){
    showMessage('ログイン処理でエラー：'+err.message);
  }
}

// --------------------------------------------
// ログアウト
// --------------------------------------------
logoutBtn.addEventListener('click', ()=>{
  nicknameInput.style.display = 'inline-block';
  passInput.style.display = 'inline-block';
  loginBtn.style.display = 'inline-block';
  signupBtn.style.display = 'inline-block';
  secretSec.style.display = 'none';
  logoutBtn.style.display = 'none';
  keywordSec.style.display = 'none';
  clearStampsFromUI();
  showMessage('');
  document.getElementById('auth-section').style.display = 'flex';
});

// --------------------------------------------
// スタンプ押下
// --------------------------------------------
stampBtn.addEventListener('click', async ()=>{
  const nickname = nicknameInput.value.trim();
  if(!nickname){ showMessage('ログインしてください'); return; }

  const keyword = keywordInput.value.trim();
  if(!keyword){ showMessage('合言葉を入力してください'); return; }

  try{
    const kwSnap = await getDoc(doc(db,'keywords',keyword));
    if(!kwSnap.exists()){ showMessage('その合言葉は存在しません'); return; }
    const data = kwSnap.data();
    await setDoc(doc(db,'users',nickname),{[keyword]:true},{merge:true});
    showMessage('スタンプを押しました','success');
    loadStamps(nickname);
  }catch(err){
    showMessage('スタンプ押下で失敗：'+err.message);
  }
});

// --------------------------------------------
// スタンプ描画
// --------------------------------------------
async function loadStamps(uid){
  clearStampsFromUI();
  const userSnap = await getDoc(doc(db,'users',uid));
  if(!userSnap.exists()) return;
  const userData = userSnap.data();

  const w = cardContainer.clientWidth;
  const h = cardContainer.clientHeight;

  const promises = Object.keys(userData).map(async keyword=>{
    const kwSnap = await getDoc(doc(db,'keywords',keyword));
    if(!kwSnap.exists()) return;
    const d = kwSnap.data();

    const keys = Object.keys(d);
    const norm = {};
    for(const k of keys){
      const cleanKey = k.replace(/^['"]+|['"]+$/g,'');
      norm[cleanKey] = d[k];
    }

    const src = norm.img;
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
  });

  await Promise.all(promises);
}

function clearStampsFromUI(){
  document.querySelectorAll('#card-container .stamp').forEach(e=>e.remove());
}

// --------------------------------------------
// パスワードリセット
// --------------------------------------------
forgotLink.addEventListener('click', ()=>{
  resetSection.style.display = 'block';
});

resetStartBtn.addEventListener('click', async ()=>{
  const nickname = resetNickname.value.trim();
  if(!nickname){ showMessage('ニックネームを入力してください'); return; }

  const userSnap = await getDoc(doc(db,'users',nickname));
  if(!userSnap.exists()){ showMessage('ユーザーが存在しません'); return; }
  showQuestionDiv.style.display = 'block';
  showQuestionDiv.textContent = userSnap.data().secretQ || '';
});

resetSubmitBtn.addEventListener('click', async ()=>{
  const nickname = resetNickname.value.trim();
  const answer = resetAnswerInput.value.trim();
  const newpass = resetNewPass.value;

  if(!nickname || !answer || !newpass){ showMessage('すべて入力してください'); return; }

  const userSnap = await getDoc(doc(db,'users',nickname));
  if(!userSnap.exists()){ showMessage('ユーザーが存在しません'); return; }

  const userData = userSnap.data();
  if(answer !== userData.secretA){ showMessage('答えが違います'); return; }

  const pwHash = await hashPassword(newpass);
  await setDoc(doc(db,'users',nickname),{password: pwHash},{merge:true});
  showMessage('パスワードを更新しました','success');
  resetSection.style.display = 'none';
  showQuestionDiv.style.display = 'none';
});
