import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

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

// メッセージ表示
function showMessage(msg, type='error'){
  errorMsg.textContent = msg;
  errorMsg.className = type==='error'?'error':'success';
}

// --------------------------------------------
// 新規登録
signupBtn.addEventListener('click', async ()=>{
  const nickname = nicknameInput.value.trim();
  if(!nickname){ showMessage('ニックネームを入力してください'); return; }

  const password = passInput.value;
  const secretQ = secretQInput.value.trim();
  const secretA = secretAInput.value.trim();

  if(!password || !secretQ || !secretA){ showMessage('パスワードと秘密質問・答えを入力してください'); return; }

  const pwHash = sha256(password);

  try{
    await setDoc(doc(db,'users',nickname),{
      password: pwHash,
      secretQ,
      secretA
    });
    showMessage('新規登録しました。自動でログインします','success');
    handleLogin();
  }catch(err){
    showMessage('登録処理でエラー:'+err.message);
    console.error(err);
  }
});

// --------------------------------------------
// ログイン
loginBtn.addEventListener('click', handleLogin);

async function handleLogin(){
  const nickname = nicknameInput.value.trim();
  const password = passInput.value;

  if(!nickname){ showMessage('ニックネームを入力してください'); return; }
  if(!password){ showMessage('パスワードを入力してください'); return; }

  const userSnap = await getDoc(doc(db,'users',nickname));
  if(!userSnap.exists()){ showMessage('ユーザーが存在しません'); return; }

  const userData = userSnap.data();
  const pwHash = sha256(password);
  if(userData.password !== pwHash){ showMessage('パスワードが違います'); return; }

  // ログイン成功
  showMessage('ログインしました','success');
  nicknameInput.style.display = 'none';
  passInput.style.display = 'none';
  loginBtn.style.display = 'none';
  signupBtn.style.display = 'none';
  logoutBtn.style.display = 'inline-block';
  secretSec.style.display = 'none';
  keywordSec.style.display = 'block';
  loadStamps(nickname);
}

// --------------------------------------------
// ログアウト
logoutBtn.addEventListener('click', ()=>{
  nicknameInput.style.display = 'inline-block';
  passInput.style.display = 'inline-block';
  loginBtn.style.display = 'inline-block';
  signupBtn.style.display = 'inline-block';
  logoutBtn.style.display = 'none';
  secretSec.style.display = 'none';
  keywordSec.style.display = 'none';
  clearStampsFromUI();
  showMessage('');
});

// --------------------------------------------
// パスワードリセット表示
forgotLink.addEventListener('click',(e)=>{
  e.preventDefault();
  resetSection.style.display='block';
});

// --------------------------------------------
// パスワードリセット処理
resetStartBtn.addEventListener('click', async ()=>{
  const nick = resetNickname.value.trim();
  if(!nick){ showMessage('ニックネームを入力してください'); return; }

  const userSnap = await getDoc(doc(db,'users',nick));
  if(!userSnap.exists()){ showMessage('ユーザーが存在しません'); return; }

  showQuestionDiv.textContent = userSnap.data().secretQ;
  resetQuestionDiv.style.display='block';
});

resetSubmitBtn.addEventListener('click', async ()=>{
  const nick = resetNickname.value.trim();
  const ans = resetAnswerInput.value.trim();
  const newPass = resetNewPass.value;

  const userSnap = await getDoc(doc(db,'users',nick));
  if(!userSnap.exists()){ showMessage('ユーザーが存在しません'); return; }

  if(userSnap.data().secretA !== ans){ showMessage('答えが違います'); return; }

  await setDoc(doc(db,'users',nick),{password:sha256(newPass)},{merge:true});
  showMessage('パスワードを更新しました','success');
  resetSection.style.display='none';
});

// --------------------------------------------
// スタンプ処理
stampBtn.addEventListener('click', async ()=>{
  const nickname = nicknameInput.value.trim();
  if(!nickname){ showMessage('ログインしてください'); return; }

  const keyword = keywordInput.value.trim();
  if(!keyword){ showMessage('合言葉を入力してください'); return; }

  const kwSnap = await getDoc(doc(db,'keywords',keyword));
  if(!kwSnap.exists()){ showMessage('その合言葉は存在しません'); return; }

  try{
    await setDoc(doc(db,'users',nickname),{[keyword]:true},{merge:true});
    showMessage('スタンプを押しました','success');
    loadStamps(nickname);
  }catch(err){
    showMessage('スタンプ押下に失敗:'+err.message);
    console.error(err);
  }
});

// --------------------------------------------
// スタンプ描画
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
    if(!d.img) return;

    const img = new Image();
    img.className='stamp';
    img.style.position='absolute';
    img.style.transform='translate(-50%, -50%)';
    img.style.left=(Number(d.x)*w)+'px';
    img.style.top=(Number(d.y)*h)+'px';
    img.style.width=(Number(d.widthPercent)*w)+'px';
    img.src=d.img;
    img.onload = ()=> cardContainer.appendChild(img);
  });

  await Promise.all(promises);
}

function clearStampsFromUI(){
  document.querySelectorAll('#card-container .stamp').forEach(e=>e.remove());
}
