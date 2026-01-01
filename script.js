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

const keywordSec = document.getElementById('keyword-section');
const keywordInput = document.getElementById('keyword');
const stampBtn = document.getElementById('stampBtn');

const cardContainer = document.getElementById('card-container');
const cardNickname = document.getElementById('card-nickname');
const totalPointEl = document.getElementById('total-point');
const colorsingPointEl = document.getElementById('colorsing-point');

/* util */
async function hashPassword(str){
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(str)
  );
  return [...new Uint8Array(buf)]
    .map(b=>b.toString(16).padStart(2,'0'))
    .join('');
}

function msg(t){ errorMsg.textContent = t || ''; }

/* signup / login */
signupBtn.onclick = async ()=>{
  const n = nicknameInput.value.trim();
  const p = passInput.value;
  if(!n || p.length < 3){ msg('入力エラー'); return; }

  const ref = doc(db,'users',n);
  if((await getDoc(ref)).exists()){ msg('既に存在します'); return; }

  await setDoc(ref,{ password: await hashPassword(p) });
  login(n,p);
};

loginBtn.onclick = ()=> login(nicknameInput.value.trim(), passInput.value);

async function login(n,p){
  const snap = await getDoc(doc(db,'users',n));
  if(!snap.exists()){ msg('ユーザーなし'); return; }
  if(await hashPassword(p) !== snap.data().password){ msg('違います'); return; }

  nicknameInput.style.display='none';
  passInput.style.display='none';
  loginBtn.style.display='none';
  signupBtn.style.display='none';
  logoutBtn.style.display='inline-block';
  keywordSec.style.display='block';

  loadCard(n);
}

logoutBtn.onclick = ()=> location.reload();

/* stamp */
stampBtn.onclick = async ()=>{
  const n = nicknameInput.value.trim();
  const k = keywordInput.value.trim();
  if(!k) return;

  const kSnap = await getDoc(doc(db,'keywords',k));
  if(!kSnap.exists()) return;

  await setDoc(doc(db,'users',n),{ [k]: true },{ merge:true });
  loadCard(n);
};

async function loadCard(uid){
  document.querySelectorAll('.stamp').forEach(e=>e.remove());

  const snap = await getDoc(doc(db,'users',uid));
  if(!snap.exists()) return;
  const d = snap.data();

  cardNickname.textContent = uid;
  totalPointEl.textContent = d.totalPoint ?? 0;
  colorsingPointEl.textContent = d.colorsingPoint ?? 0;

  const w = cardContainer.clientWidth;
  const h = cardContainer.clientHeight;

  for(const key of Object.keys(d)){
    if(['password','totalPoint','colorsingPoint'].includes(key)) continue;

    const ks = await getDoc(doc(db,'keywords',key));
    if(!ks.exists()) continue;
    const kd = ks.data();

    if(!kd.img) continue;

    const img = document.createElement('img');
    img.className = 'stamp';
    img.src = kd.img;
    img.style.left = (kd.x * w) + 'px';
    img.style.top = (kd.y * h) + 'px';
    img.style.width = (kd.widthPercent * w) + 'px';

    cardContainer.appendChild(img);
  }
}
