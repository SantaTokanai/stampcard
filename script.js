import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* ==== Firebase設定（あなたの値に置き換え） ==== */
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "XXXX",
  appId: "XXXX"
};
initializeApp(firebaseConfig);

const auth = getAuth();
const db = getFirestore();

/* ==== ユーザー認証 ==== */
const emailInput = document.getElementById('email');
const passInput  = document.getElementById('password');
const signupBtn  = document.getElementById('signup');
const loginBtn   = document.getElementById('login');
const keywordSec = document.getElementById('keyword-section');

signupBtn.addEventListener('click', () => {
  createUserWithEmailAndPassword(auth, emailInput.value, passInput.value)
    .then(() => alert('登録完了！'))
    .catch(err => alert(errorMessageJP(err)));
});

loginBtn.addEventListener('click', () => {
  signInWithEmailAndPassword(auth, emailInput.value, passInput.value)
    .then(() => {
      alert('ログインしました');
      keywordSec.style.display = 'block';
      loadStamps();
    })
    .catch(err => alert(errorMessageJP(err)));
});

function errorMessageJP(error){
  switch (error.code) {
    case 'auth/invalid-email': return 'メールアドレスの形式が正しくありません。';
    case 'auth/user-not-found': return 'ユーザーが見つかりません。';
    case 'auth/wrong-password': return 'パスワードが違います。';
    case 'auth/email-already-in-use': return 'このメールアドレスは既に登録されています。';
    default: return 'エラーが発生しました：' + error.message;
  }
}

/* ==== スタンプ処理 ==== */

// スタンプ画像と座標の一覧
// left / top / width はpxや%で自由に
const stampPositions = [
  {img:'stamp1.png', left:'20%', top:'25%', width:'60px'},
  {img:'stamp2.png', left:'50%', top:'25%', width:'60px'},
  {img:'stamp3.png', left:'80%', top:'25%', width:'60px'},
  // 新しいスタンプを追加する時はここに行を足すだけ
];

const cardContainer = document.getElementById('card-container');
const stampBtn = document.getElementById('stampBtn');

stampBtn.addEventListener('click', async () => {
  const user = auth.currentUser;
  if (!user) return alert('ログインしてください');
  
  const keyword = document.getElementById('keyword').value.trim();
  const today = new Date().toISOString().slice(0,10); // 例: 2025-09-26

  // ここで keyword を判定（例: "apple" が合言葉）
  if(keyword !== "apple") {
    alert("合言葉が違います");
    return;
  }

  const userDocRef = doc(db, "users", user.uid);
  await setDoc(userDocRef, { [today]: true }, { merge: true });

  placeStamp(today);
});

// Firestoreから取得して表示
async function loadStamps(){
  const user = auth.currentUser;
  if(!user) return;
  const snap = await getDoc(doc(db, "users", user.uid));
  if (snap.exists()) {
    const data = snap.data();
    Object.keys(data).forEach(date => {
      if (data[date] === true) placeStamp(date);
    });
  }
}

// 指定された日付でスタンプを描画
function placeStamp(date){
  // どのスタンプを押すかは日付や順番に応じて決める例
  const index = Object.keys(cardContainer.children)
    .filter(x=>cardContainer.children[x].classList)
    .length; // 今ある数を数えて次の番号を使う
  const pos = stampPositions[index % stampPositions.length];

  const img = document.createElement('img');
  img.src = pos.img;
  img.className = 'stamp';
  img.style.left  = pos.left;
  img.style.top   = pos.top;
  img.style.width = pos.width;
  cardContainer.appendChild(img);
}
