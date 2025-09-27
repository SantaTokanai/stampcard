// script.js — ニックネーム（安全に pseudo-email 化） + robust Firestore key/value normalization

// Firebase モジュール（v11 モジュール版）
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  deleteUser
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  runTransaction
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// Firebase 設定（既存の設定をそのまま）
const firebaseConfig = {
  apiKey: "AIzaSyBI_XbbC78cXCBmm6ue-h0HJ15dNsDAnzo",
  authDomain: "stampcard-project.firebaseapp.com",
  projectId: "stampcard-project",
  storageBucket: "stampcard-project.firebasestorage.app",
  messagingSenderId: "808808121881",
  appId: "1:808808121881:web:57f6d536d40fc2d30fcc88"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DEBUG: true にすると詳細ログをコンソールに出します（本番は false 推奨）
const DEBUG = false;

// -------------------- ヘルパー --------------------
function showMessage(msg, type = 'error') {
  const el = document.getElementById('error-msg');
  if (!el) return;
  el.textContent = msg;
  el.className = type === 'error' ? 'error' : 'success';
}

// 文字列の前後のクォート(' or ") と空白を取り除く
function cleanString(s) {
  if (typeof s !== 'string') return s;
  return s.trim().replace(/^['"]+|['"]+$/g, '');
}

// Firestore の raw オブジェクト（キーに余分なクォートがある場合がある）を正規化
// 例: { '"x"': 0.09, '"img"': "'images/...'" } -> { x:0.09, img:"images/..." }
function normalizeDocData(raw) {
  const norm = {};
  if (!raw || typeof raw !== 'object') return norm;
  for (const k of Object.keys(raw)) {
    const cleanKey = String(k).replace(/^['"]+|['"]+$/g, '').trim();
    const v = raw[k];
    norm[cleanKey] = (typeof v === 'string') ? cleanString(v) : v;
  }
  return norm;
}

// 正規化済データから画像パスを取り出す（フォールバック含む）
function extractImgFromNormalized(norm) {
  if (!norm || typeof norm !== 'object') return '';
  if (typeof norm.img === 'string' && norm.img) return norm.img;
  // 別名候補
  const alt = ['image', 'src', 'path'];
  for (const k of alt) {
    if (typeof norm[k] === 'string' && norm[k]) return norm[k];
  }
  // 最後の手段：images/ を含む文字列を探す
  for (const k of Object.keys(norm)) {
    const v = norm[k];
    if (typeof v === 'string' && v.indexOf('images/') !== -1) return v;
  }
  return '';
}

// ニックネームを安全な pseudo-email に変換
// 基本は base64-url にしてドメインを付ける（メール構文エラーの余地をなくす）
function base64UrlEncodeUnicode(str) {
  // Unicode-safe base64
  const b64 = btoa(unescape(encodeURIComponent(str)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pseudoEmailFromNickname(nickname) {
  const normalized = (nickname || '').trim().normalize('NFC').replace(/\s+/g, ' ');
  const local = base64UrlEncodeUnicode(normalized || 'user');
  return `${local}@pseudo.local`;
}

// -------------------- DOM 要素 --------------------
const nicknameInput = document.getElementById('nickname');
const passInput = document.getElementById('password');
const passwordMsg = document.getElementById('password-msg');
const signupBtn = document.getElementById('signup');
const loginBtn = document.getElementById('login');
const logoutBtn = document.getElementById('logout');
const keywordSection = document.getElementById('keyword-section');
const keywordInput = document.getElementById('keyword');
const stampBtn = document.getElementById('stampBtn');
const cardContainer = document.getElementById('card-container');

// -------------------- 認証：登録（競合回避） --------------------
/*
  フロー：
  1) nickname -> pseudoEmail を作って createUserWithEmailAndPassword を呼ぶ
  2) 作成された Auth ユーザー（自動でサインイン状態）で runTransaction を実行し、
     nicknames/{encodedNick} が空であれば予約 (uid, nickname) と users/{uid} を作成
  3) トランザクション失敗時は Auth ユーザーを削除してロールバック
*/
signupBtn.addEventListener('click', async () => {
  const nickname = (nicknameInput?.value || '').trim();
  const password = passInput?.value || '';

  if (!nickname) { showMessage('ニックネームを入力してください'); return; }
  if (password.length < 6) { showMessage('パスワードは6文字以上です'); return; }

  const nickKey = base64UrlEncodeUnicode(nickname); // 安全なドキュメントID
  const nickRef = doc(db, 'nicknames', nickKey);
  const fakeEmail = pseudoEmailFromNickname(nickname);

  try {
    // 1) Auth にユーザーを作成（自動でログイン状態になる）
    const userCredential = await createUserWithEmailAndPassword(auth, fakeEmail, password);
    const uid = userCredential.user.uid;
    if (DEBUG) console.log('Auth user created uid=', uid);

    // 2) トランザクションで nicknames ドキュメントを予約して users 作成
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(nickRef);
        if (snap.exists()) {
          // 既に誰かが同じニックネームを確保している
          throw new Error('nickname-already-exists');
        }
        tx.set(nickRef, { uid, nickname, createdAt: new Date().toISOString() });
        const userRef = doc(db, 'users', uid);
        tx.set(userRef, { nickname }, { merge: true });
      });

      showMessage('新規登録しました。自動でログインしました', 'success');

    } catch (txErr) {
      // 競合や他のトランザクションエラーが起きたら Auth 側を削除してロールバック
      console.error('Transaction failed, rolling back Auth user:', txErr);
      try {
        // deleteUser には現在サインイン中の user が必要
        if (auth.currentUser) {
          await deleteUser(auth.currentUser);
        }
      } catch (delErr) {
        console.error('Failed to delete auth user during rollback:', delErr);
      }

      if (txErr.message === 'nickname-already-exists') {
        showMessage('このニックネームは既に使われています');
      } else {
        showMessage('登録処理でエラーが発生しました：' + (txErr.message || txErr));
      }
    }

  } catch (err) {
    // createUser エラー
    console.error('createUser error', err);
    if (err && err.code === 'auth/email-already-in-use') {
      // ほぼ起こらないが念のため
      showMessage('このニックネームは既に使われています');
    } else {
      showMessage('登録に失敗しました：' + (err.message || err.code || err));
    }
  }
});

// -------------------- 認証：ログイン --------------------
loginBtn.addEventListener('click', async () => {
  const nickname = (nicknameInput?.value || '').trim();
  const password = passInput?.value || '';
  if (!nickname) { showMessage('ニックネームを入力してください'); return; }
  if (!password) { showMessage('パスワードを入力してください'); return; }

  const fakeEmail = pseudoEmailFromNickname(nickname);
  try {
    await signInWithEmailAndPassword(auth, fakeEmail, password);
    showMessage('ログインしました', 'success');
  } catch (err) {
    console.error('login error', err);
    // メッセージはあいまいにしてブルートフォース対策や UX を保つ
    showMessage('ニックネームまたはパスワードが正しくありません');
  }
});

// -------------------- ログアウト --------------------
logoutBtn.addEventListener('click', async () => {
  try {
    await signOut(auth);
    showMessage('');
  } catch (err) {
    console.error('logout error', err);
    showMessage('ログアウトに失敗しました');
  }
});

// -------------------- 認証状態監視 --------------------
onAuthStateChanged(auth, user => {
  if (user) {
    if (nicknameInput) nicknameInput.style.display = 'none';
    if (passInput) passInput.style.display = 'none';
    if (loginBtn) loginBtn.style.display = 'none';
    if (signupBtn) signupBtn.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'inline-block';
    if (keywordSection) keywordSection.style.display = 'block';
    if (passwordMsg) passwordMsg.style.display = 'none';
    // 描画
    loadStamps(user.uid);
  } else {
    if (nicknameInput) nicknameInput.style.display = 'inline-block';
    if (passInput) passInput.style.display = 'inline-block';
    if (loginBtn) loginBtn.style.display = 'inline-block';
    if (signupBtn) signupBtn.style.display = 'inline-block';
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (keywordSection) keywordSection.style.display = 'none';
    if (passwordMsg) passwordMsg.style.display = 'block';
    clearStampsFromUI();
  }
});

// -------------------- スタンプ押下 --------------------
stampBtn.addEventListener('click', async () => {
  const user = auth.currentUser;
  if (!user) { showMessage('ログインしてください'); return; }

  const keyword = (keywordInput?.value || '').trim();
  if (!keyword) { showMessage('合言葉を入力してください'); return; }

  try {
    const kwDocRef = doc(db, 'keywords', keyword);
    const kwSnap = await getDoc(kwDocRef);
    if (!kwSnap.exists()) {
      showMessage('その合言葉は存在しません');
      return;
    }

    const raw = kwSnap.data();
    if (DEBUG) console.log('Firestoreから取得したキーワードデータ:', raw);

    // 正規化して img を取り出す
    const norm = normalizeDocData(raw);
    if (DEBUG) console.log('正規化後データ:', norm, 'keys:', Object.keys(raw));

    const imgVal = extractImgFromNormalized(norm);
    if (DEBUG) console.log('imgVal ->', imgVal);

    if (!imgVal) {
      showMessage('画像パスが取得できません');
      return;
    }

    // users ドキュメントにスタンプを追加（merge）
    await setDoc(doc(db, 'users', user.uid), { [keyword]: true }, { merge: true });

    showMessage('スタンプを押しました', 'success');
    // 再描画
    loadStamps(user.uid);

  } catch (err) {
    console.error('stamp push error', err);
    showMessage('スタンプ押下に失敗しました：' + (err.message || err));
  }
});

// -------------------- スタンプ描画 --------------------
async function loadStamps(uid) {
  clearStampsFromUI();
  try {
    const userSnap = await getDoc(doc(db, 'users', uid));
    if (!userSnap.exists()) return;
    const userData = userSnap.data();
    if (!userData) return;

    const w = cardContainer.clientWidth || 480;
    const h = cardContainer.clientHeight || 320;

    const keys = Object.keys(userData || {});
    for (const keyword of keys) {
      if (keyword === 'nickname') continue; // メタ情報をスキップ
      try {
        const kwSnap = await getDoc(doc(db, 'keywords', keyword));
        if (!kwSnap.exists()) continue;
        const raw = kwSnap.data();
        if (DEBUG) console.log('raw keyword data:', raw);

        const d = normalizeDocData(raw);
        if (DEBUG) console.log('normalized:', d);

        let src = extractImgFromNormalized(d);
        if (!src) {
          console.warn('画像パスが取得できません: ', keyword);
          continue;
        }
        // 整形
        src = src.replace(/^\/+/, '');
        if (!/^https?:\/\//.test(src) && !src.startsWith('images/')) src = 'images/' + src;

        // 数値化
        const xPos = Number(d.x);
        const yPos = Number(d.y);
        const wPercent = Number(d.widthPercent);
        if (!isFinite(xPos) || !isFinite(yPos) || !isFinite(wPercent)) {
          console.warn('位置/サイズ不正:', keyword, d);
          continue;
        }

        const img = new Image();
        img.className = 'stamp';
        img.style.position = 'absolute';
        img.style.transform = 'translate(-50%, -50%)';
        img.style.left = (xPos * w) + 'px';
        img.style.top = (yPos * h) + 'px';
        img.style.width = (wPercent * w) + 'px';

        img.onload = () => cardContainer.appendChild(img);
        img.onerror = () => console.warn(`画像が見つかりません: ${img.src}`);
        img.src = src;

      } catch (innerErr) {
        console.error('per-key load error', keyword, innerErr);
      }
    }

  } catch (err) {
    console.error('loadStamps error', err);
  }
}

function clearStampsFromUI() {
  document.querySelectorAll('#card-container .stamp').forEach(e => e.remove());
}
