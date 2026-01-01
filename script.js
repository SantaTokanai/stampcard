import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBI_XbbC78cXCBmm6ue-h0HJ15dNsDAnzo",
  authDomain: "stampcard-project.firebaseapp.com",
  projectId: "stampcard-project",
  storageBucket: "stampcard-project.firebasestorage.app",
  messagingSenderId: "808808121881",
  appId: "1:808808121881:web:57f6d536d40fc2d30fcc88"
};

initializeApp(firebaseConfig);
const db = getFirestore();

/* DOM */
const nicknameInput = document.getElementById('nickname');
const passInput = document.getElementById('password');
const loginBtn = document.getElementById('login');
const signupBtn = document.getElementById('signup');
const logoutBtn = document.getElementById('logout');
const errorMsg = document.getElementById('error-msg');
const passwordMsg = document.getElementById('password-msg');
const keywordSec = document.getElementById('keyword-section');
const keywordInput = document.getElementById('keyword');
const stampBtn = document.getElementById('stampBtn');
const cardContainer = document.getElementById('card-container');

const cardNickname = document.getElementById('card-nickname');
const totalPointEl = document.getElementById('total-point');
const colorsingPointEl = document.getElementById('colorsing-point');

/* util */
async function hashPassword(str){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

function showMessage(msg){
  errorMsg.textContent = msg || '';
}

/* signup / login */
signupBtn.onclick = async ()=>{
  const nick = nicknameInput.value.trim();
  const pw = passInput.value;
  if(!nick || pw.length < 3){ showMessage('入力エラー'); return; }
  const snap = await getDoc(doc(db,'users',nick));
  if(snap.exists()){ showMessage('既に存在します'); return; }
  await setDoc(doc(db,'users',nick),{ password: await hashPassword(pw) });
  await login(nick,pw);
};

loginBtn.onclick = ()=> login(nicknameInput.value.trim(), passInput.value);

async function login(nick,pw){
  const snap = await getDoc(doc(db,'users',nick));
  if(!snap.exists()){ showMessage('ユーザーなし'); return; }
  if(await hashPassword(pw) !== snap.data().password){ showMessage('違います'); return; }

  nicknameInput.style.display='none';
  passInput.style.display='none';
  loginBtn.style.display='none';
  signupBtn.style.display='none';
  logoutBtn.style.display='inline-block';
  passwordMsg.style.display='none';
  keywordSec.style.display='block';

  loadStamps(nick);
}

logoutBtn.onclick = ()=>{
  location.reload();
};

/* stamp */
stampBtn.onclick = async ()=>{
  const nick = nicknameInput.value.trim();
  const kw = keywordInput.value.trim();
  if(!kw) return;
  const kSnap = await getDoc(doc(db,'keywords',kw));
  if(!kSnap.exists()) return;
  await setDoc(doc(db,'users',nick),{[kw]:true},{merge:true});
  loadStamps(nick);
};

function extractImg(d){
  return d.img || "";
}

async function loadStamps(uid){
  document.querySelectorAll('.stamp').forEach(e=>e.remove());
  const snap = await getDoc(doc(db,'users',uid));
  if(!snap.exists()) return;
  const d = snap.data();

  cardNickname.textContent = uid;
  totalPointEl.textContent = typeof d.totalPoint === 'number' ? d.totalPoint : 0;
  colorsingPointEl.textContent = typeof d.colorsingPoint === 'number' ? d.colorsingPoint : 0;

  const w = cardContainer.clientWidth;
  const h = cardContainer.clientHeight;

  for(const key of Object.keys(d)){
    if(['password','totalPoint','colorsingPoint'].includes(key)) continue;
    const kSnap = await getDoc(doc(db,'keywords',key));
    if(!kSnap.exists()) continue;
    const kd = kSnap.data();
    const img = new Image();
    img.className='stamp';
    img.style.left = (kd.x*w)+'px';
    img.style.top = (kd.y*h)+'px';
    img.style.width = (kd.widthPercent*w)+'px';
    img.src = extractImg(kd);
    cardContainer.appendChild(img);
  }
}
