import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBI_XbbC78cXCBmm6ue-h0HJ15dNsDAnzo",
  authDomain: "stampcard-project.firebaseapp.com",
  projectId: "stampcard-project"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const nicknameInput = document.getElementById('nickname');
const passInput = document.getElementById('password');
const loginBtn = document.getElementById('login');
const signupBtn = document.getElementById('signup');
const logoutBtn = document.getElementById('logout');
const keywordSec = document.getElementById('keyword-section');
const stampBtn = document.getElementById('stampBtn');
const keywordInput = document.getElementById('keyword');

const dispNick = document.getElementById('display-nickname');
const dispColor = document.getElementById('display-colorsing');
const dispTotal = document.getElementById('display-total');

async function hashPassword(str){
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

loginBtn.onclick = async ()=>{
  const nick = nicknameInput.value.trim();
  const pw = passInput.value;
  const snap = await getDoc(doc(db,'users',nick));
  if(!snap.exists()) return alert('ユーザーなし');

  if(await hashPassword(pw) !== snap.data().password) return alert('PW違い');

  nicknameInput.style.display='none';
  passInput.style.display='none';
  loginBtn.style.display='none';
  signupBtn.style.display='none';
  logoutBtn.style.display='inline-block';
  keywordSec.style.display='block';

  await loadStamps(nick);
  await loadUserTexts(nick);
};

async function loadUserTexts(nick){
  const snap = await getDoc(doc(db,'users',nick));
  if(!snap.exists()) return;

  const d = snap.data();
  dispNick.textContent = nick;
  dispColor.textContent = `colorsing: ${Number(d.colorsingPoint||0)}`;
  dispTotal.textContent = `total: ${Number(d.totalPoint||0)}`;
}

async function loadStamps(uid){
  document.querySelectorAll('.stamp').forEach(e=>e.remove());
  const snap = await getDoc(doc(db,'users',uid));
  if(!snap.exists()) return;

  for(const k of Object.keys(snap.data())){
    if(['password','secretQuestion','secretAnswerHash','colorsingPoint','totalPoint'].includes(k)) continue;
    const kw = await getDoc(doc(db,'keywords',k));
    if(!kw.exists()) continue;
    const d = kw.data();

    const img = new Image();
    img.className='stamp';
    img.src=d.img;
    img.style.left=(d.x*500)+'px';
    img.style.top=(d.y*500)+'px';
    img.style.width=(d.widthPercent*500)+'px';
    document.getElementById('card-container').appendChild(img);
  }
}
