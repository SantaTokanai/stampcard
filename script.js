// Firebase 初期化（モジュール版）
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

/* ===== Firebase 設定 ===== */
const firebaseConfig = {
  apiKey: "AIzaSyBI_XbbC78cXCBmm6ue-h0HJ15dNsDAnzo",
  authDomain: "stampcard-project.firebaseapp.com",
  projectId: "stampcard-project",
  storageBucket: "stampcard-project.firebasestorage.app",
  messagingSenderId: "808808121881",
  appId: "1:808808121881:web:57f6d536d40fc2d30fcc88"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore();

/* ===== DOM参照 ===== */
const emailInput = document.getElementById('email');
const passInput  = document.getElementById('password');
const signupBtn  = document.getElementById('signup');
const loginBtn   = document.getElementById('login');
const loginMessage = document.getElementById('login-message');
const logoutBtn  = document.getElementById('logout-btn');
const keywordSection = document.getElementById('keyword-section');
const keywordInput = document.getElementById('keyword');
const stampBtn = document.getElementById('stamp-btn');
const cardContainer = document.getElementById('card-container');

/* ===== スタンプ位置配列（カード上の比率 x/y） ===== */
const stampPositions = [
  {x:0.05,y:0.5,widthPercent:0.2},{x:0.15,y:0.5,widthPercent:0.2},
  {x:0.25,y:0.5,widthPercent:0.2},{x:0.35,y:0.5,widthPercent:0.1},
  {x:0.45,y:0.5,widthPercent:0.1},{x:0.55,y:0.5,widthPercent:0.1},
  {x:0.05,y:0.8,widthPercent:0.1},{x:0.15,y:0.8,widthPercent:0.1},
  {x:0.25,y:0.8,widthPercent:0.1},{x:0.35,y:0.8,widthPercent:0.1},
  {x:0.45,y:0.8,widthPercent:0.1},{x:0.55,y:0.8,widthPercent:0.1},
  {x:0.6,y:0.8,widthPercent:0.1},{x:0.8,y:0.8,widthPercent:0.1}
];

/* ===== 認証 ===== */
function showLoginError(msg){
  loginMessage.textContent = msg;
}

signupBtn.addEventListener('click', async () => {
  try {
    await createUserWithEmailAndPassword(auth, emailInput.value, passInput.value);
    showLoginError('');
  } catch(e){
    showLoginError('メールアドレスまたはパスワードが正しくありません');
  }
});

loginBtn.addEventListener('click', async () => {
  try {
    await signInWithEmailAndPassword(auth, emailInput.value, passInput.value);
    showLoginError('');
  } catch(e){
    showLoginError('メールアドレスまたはパスワードが正しくありません');
  }
});

logoutBtn.addEventListener('click', async () => {
  await signOut(auth);
});

/* ===== 認証状態監視 ===== */
onAuthStateChanged(auth, user => {
  if(user){
    document.getElementById('auth-section').style.display = 'none';
    logoutBtn.style.display = 'inline-block';
    keywordSection.style.display = 'block';
    loadStamps(user.uid);
  } else {
    document.getElementById('auth-section').style.display = 'block';
    logoutBtn.style.display = 'none';
    keywordSection.style.display = 'none';
    clearStampsFromUI();
  }
});

/* ===== スタンプ押下 ===== */
stampBtn.addEventListener('click', async () => {
  const user = auth.currentUser;
  if(!user) return;

  const keyword = keywordInput.value.trim();
  if(!keyword) { alert('合言葉を入力してください'); return; }

  // Firestoreから対応スタンプ画像取得
  const docRef = doc(db,'keywords',keyword);
  const snap = await getDoc(docRef);
  if(!snap.exists()) { alert('合言葉が正しくありません'); return; }

  const imageName = snap.data().image;
  const idx = parseInt(imageName.match(/stamp(\d+)\.png/)[1],10) - 1;
  const pos = stampPositions[idx];

  renderStamp({...pos, img:'images/' + imageName});

  // Firebaseに保存（ユーザーごとに押したスタンプを管理）
  const userDocRef = doc(db,'users',user.uid);
  const userSnap = await getDoc(userDocRef);
  const data = userSnap.exists() ? userSnap.data() : {};
  data[keyword] = true;
  await setDoc(userDocRef,data);
});

/* ===== スタンプ描画 ===== */
function renderStamp(pos){
  const img = document.createElement('img');
  img.src = pos.img;
  img.className = 'stamp';

  const w = cardContainer.clientWidth;
  const h = cardContainer.clientHeight;

  img.style.left = (pos.x * w) + 'px';
  img.style.top  = (pos.y * h) + 'px';
  img.style.width = (pos.widthPercent * w) + 'px';

  cardContainer.appendChild(img);
}

/* ===== ユーザーの既存スタンプ読み込み ===== */
async function loadStamps(uid){
  clearStampsFromUI();
  const userDocRef = doc(db,'users',uid);
  const snap = await getDoc(userDocRef);
  if(snap.exists()){
    const data = snap.data();
    Object.keys(data).forEach(key => {
      if(data[key]){
        const docRef = doc(db,'keywords',key);
        getDoc(docRef).then(s => {
          if(s.exists()){
            const imageName = s.data().image;
            const idx = parseInt(imageName.match(/stamp(\d+)\.png/)[1],10)-1;
            const pos = stampPositions[idx];
            renderStamp({...pos,img:'images/'+imageName});
          }
        });
      }
    });
  }
}

function clearStampsFromUI(){
  Array.from(cardContainer.querySelectorAll('.stamp')).forEach(n=>n.remove());
}
