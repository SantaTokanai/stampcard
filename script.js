import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBI_XbbC78cXCBmm6ue-h0HJ15dNsDAnzo",
    authDomain: "stampcard-project.firebaseapp.com",
    projectId: "stampcard-project",
    storageBucket: "stampcard-project.firebasestorage.app",
    messagingSenderId: "808808121881",
    appId: "1:808808121881:web:57f6d536d40fc2d30fcc88"
};

// デバッグ用ログ
console.log("🔧 Firebase Config:", firebaseConfig);
console.log("🔧 Project ID:", firebaseConfig.projectId);

let app, db;
try {
    console.log("🔧 Firebase初期化開始...");
    app = initializeApp(firebaseConfig);
    console.log("✅ Firebase初期化成功:", app);
    
    db = getFirestore(app);
    console.log("✅ Firestore初期化成功:", db);
} catch (error) {
    console.error("❌ Firebase初期化エラー:", error);
    alert("Firebase初期化エラー: " + error.message);
}

// DOM要素の取得
console.log("🔧 DOM要素取得開始...");
const nicknameInput = document.getElementById('nickname');
const passwordInput = document.getElementById('password');
const signupBtn = document.getElementById('signup');
const loginBtn = document.getElementById('login');
const logoutBtn = document.getElementById('logout');
const keywordInput = document.getElementById('keyword');
const stampBtn = document.getElementById('stampBtn');
const secretSection = document.getElementById('secret-section');
const secretQInput = document.getElementById('secretQ');
const secretAInput = document.getElementById('secretA');
const registerSecretBtn = document.getElementById('registerSecret');
const cardContainer = document.getElementById('card-container');
const forgotPasswordLink = document.getElementById('forgot-password');
const resetSection = document.getElementById('reset-section');
const backToLoginBtn = document.getElementById('back-to-login');
const resetStartBtn = document.getElementById('reset-start');
const resetSubmitBtn = document.getElementById('reset-submit');
const resetNicknameInput = document.getElementById('reset-nickname');
const resetAnswerInput = document.getElementById('reset-answer');
const resetNewpassInput = document.getElementById('reset-newpass');
const showQuestionDiv = document.getElementById('show-question');
const resetQuestionDiv = document.getElementById('reset-question');
const errorMsg = document.getElementById('error-msg');

// DOM要素チェック
console.log("🔧 重要な要素チェック:");
console.log("  - signupBtn:", signupBtn);
console.log("  - loginBtn:", loginBtn);
console.log("  - registerSecretBtn:", registerSecretBtn);
console.log("  - stampBtn:", stampBtn);

let currentUser = null;

// 表示切り替え関数
function showMain() {
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('reset-section').classList.add('hidden');
    document.getElementById('main-section').classList.remove('hidden');
}

function showAuth() {
    document.getElementById('main-section').classList.add('hidden');
    document.getElementById('reset-section').classList.add('hidden');
    document.getElementById('auth-section').classList.remove('hidden');
    clearForm();
}

function showReset() {
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('main-section').classList.add('hidden');
    document.getElementById('reset-section').classList.remove('hidden');
}

function clearForm() {
    nicknameInput.value = '';
    passwordInput.value = '';
    secretQInput.value = '';
    secretAInput.value = '';
    secretSection.style.display = 'none';
    errorMsg.textContent = '';
}

function showError(message) {
    errorMsg.textContent = message;
    errorMsg.className = '';
}

function showSuccess(message) {
    errorMsg.textContent = message;
    errorMsg.className = 'success';
}

// 新規登録ボタンクリック
signupBtn.onclick = () => {
    console.log("🔧 新規登録ボタンクリック");
    if (secretSection.style.display === 'none') {
        secretSection.style.display = 'block';
        showError('秘密の質問と答えを設定してください');
        console.log("🔧 秘密の質問セクション表示");
    }
};

// 登録完了ボタンクリック
registerSecretBtn.onclick = async () => {
    console.log("🔧 登録完了ボタンクリック");
    const nickname = nicknameInput.value.trim();
    const password = passwordInput.value.trim();
    const secretQ = secretQInput.value.trim();
    const secretA = secretAInput.value.trim();
    
    console.log("🔧 入力値チェック:", { nickname, password: "***", secretQ, secretA });
    
    if (!nickname || !password || !secretQ || !secretA) {
        showError("全ての項目を入力してください");
        console.log("❌ 入力値不足");
        return;
    }

    try {
        console.log("🔧 Firebase処理開始...");
        // ユーザーが既に存在するかチェック
        const userRef = doc(db, "users", nickname);
        console.log("🔧 ユーザー参照作成:", userRef);
        
        const userSnap = await getDoc(userRef);
        console.log("🔧 ユーザー存在チェック結果:", userSnap.exists());
        
        if (userSnap.exists()) {
            showError("そのニックネームは既に使用されています");
            console.log("❌ ユーザー重複");
            return;
        }

        // 新規ユーザー登録
        console.log("🔧 新規ユーザー登録開始...");
        await setDoc(userRef, {
            password: password,
            secretQ: secretQ,
            secretA: secretA
        });
        
        console.log("✅ ユーザー登録完了");
        currentUser = nickname;
        showSuccess("登録が完了しました");
        setTimeout(() => {
            showMain();
            loadStamps();
        }, 1000);
        
    } catch (error) {
        console.error("❌ Registration error:", error);
        showError("登録に失敗しました: " + error.message);
    }
};

// ログインボタンクリック
loginBtn.onclick = async () => {
    console.log("🔧 ログインボタンクリック");
    const nickname = nicknameInput.value.trim();
    const password = passwordInput.value.trim();
    
    console.log("🔧 ログイン入力値:", { nickname, password: "***" });
    
    if (!nickname || !password) {
        showError("ニックネームとパスワードを入力してください");
        console.log("❌ ログイン入力値不足");
        return;
    }

    try {
        console.log("🔧 ログイン処理開始...");
        const userRef = doc(db, "users", nickname);
        const userSnap = await getDoc(userRef);
        
        console.log("🔧 ユーザー検索結果:", userSnap.exists());
        
        if (!userSnap.exists()) {
            showError("ユーザーが見つかりません");
            console.log("❌ ユーザー不存在");
            return;
        }
        
        const userData = userSnap.data();
        console.log("🔧 ユーザーデータ取得完了");
        
        if (userData.password !== password) {
            showError("パスワードが間違っています");
            console.log("❌ パスワード不一致");
            return;
        }
        
        currentUser = nickname;
        console.log("✅ ログイン成功:", currentUser);
        showSuccess("ログインしました");
        setTimeout(() => {
            showMain();
            loadStamps();
        }, 500);
        
    } catch (error) {
        console.error("❌ Login error:", error);
        showError("ログインに失敗しました: " + error.message);
    }
};

// ログアウトボタンクリック
logoutBtn.onclick = () => {
    currentUser = null;
    keywordInput.value = '';
    clearStampsFromUI();
    showAuth();
};

// パスワードリセットリンククリック
forgotPasswordLink.onclick = (e) => {
    e.preventDefault();
    showReset();
};

// ログインに戻るボタンクリック
backToLoginBtn.onclick = () => {
    showAuth();
};

// リセット開始ボタンクリック
resetStartBtn.onclick = async () => {
    const nickname = resetNicknameInput.value.trim();
    if (!nickname) {
        alert("ニックネームを入力してください");
        return;
    }
    
    try {
        const userRef = doc(db, "users", nickname);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
            alert("ユーザーが見つかりません");
            return;
        }
        
        const userData = userSnap.data();
        showQuestionDiv.textContent = `質問: ${userData.secretQ}`;
        resetQuestionDiv.style.display = 'block';
        
    } catch (error) {
        console.error("Reset start error:", error);
        alert("エラーが発生しました");
    }
};

// リセット実行ボタンクリック
resetSubmitBtn.onclick = async () => {
    const nickname = resetNicknameInput.value.trim();
    const answer = resetAnswerInput.value.trim();
    const newPassword = resetNewpassInput.value.trim();
    
    if (!nickname || !answer || !newPassword) {
        alert("すべての項目を入力してください");
        return;
    }
    
    try {
        const userRef = doc(db, "users", nickname);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.data();
        
        if (userData.secretA !== answer) {
            alert("答えが間違っています");
            return;
        }
        
        await updateDoc(userRef, {
            password: newPassword
        });
        
        alert("パスワードが更新されました");
        showAuth();
        
    } catch (error) {
        console.error("Reset submit error:", error);
        alert("更新に失敗しました");
    }
};

// スタンプを押すボタンクリック
stampBtn.onclick = async () => {
    console.log("🔧 スタンプボタンクリック");
    if (!currentUser) {
        console.log("❌ ユーザー未ログイン");
        return;
    }
    
    const kw = keywordInput.value.trim();
    console.log("🔧 入力キーワード:", kw);
    
    if (!kw) {
        alert("合言葉を入力してください");
        console.log("❌ キーワード未入力");
        return;
    }

    try {
        console.log("🔧 キーワード存在チェック開始...");
        // キーワードが存在するかチェック
        const kwSnap = await getDoc(doc(db, "keywords", kw));
        console.log("🔧 キーワード存在:", kwSnap.exists());
        
        if (!kwSnap.exists()) {
            alert("その合言葉は存在しません");
            console.log("❌ キーワード不存在");
            return;
        }

        console.log("🔧 ユーザーデータ更新開始...");
        // ユーザーデータを更新
        const userRef = doc(db, "users", currentUser);
        await updateDoc(userRef, {
            [kw]: true
        });
        
        console.log("✅ スタンプ追加完了");
        keywordInput.value = '';
        alert("スタンプを押しました！");
        loadStamps();
        
    } catch (error) {
        console.error("❌ Stamp error:", error);
        alert("スタンプの追加に失敗しました: " + error.message);
    }
};

// UIからスタンプをクリア
function clearStampsFromUI() {
    document.querySelectorAll('.stamp').forEach(el => el.remove());
}

// スタンプを読み込んで表示
async function loadStamps() {
    if (!currentUser) return;
    
    clearStampsFromUI();
    
    try {
        const userSnap = await getDoc(doc(db, "users", currentUser));
        if (!userSnap.exists()) return;
        
        const userData = userSnap.data();
        const cardWidth = cardContainer.clientWidth;
        const cardHeight = cardContainer.clientHeight;
        
        for (const key of Object.keys(userData)) {
            // システムフィールドをスキップ
            if (['password', 'secretQ', 'secretA'].includes(key)) continue;
            
            const kwSnap = await getDoc(doc(db, 'keywords', key));
            if (!kwSnap.exists()) continue;
            
            const kwData = kwSnap.data();
            
            // データの安全な取得
            const imgSrc = kwData.img;
            const x = parseFloat(kwData.x);
            const y = parseFloat(kwData.y);
            const wPct = parseFloat(kwData.widthPercent);
            
            if (isNaN(x) || isNaN(y) || isNaN(wPct) || !imgSrc) {
                console.warn("無効なスタンプデータ:", key, kwData);
                continue;
            }
            
            // スタンプ画像を作成
            const imgEl = document.createElement('img');
            imgEl.src = imgSrc;
            imgEl.className = 'stamp';
            imgEl.style.width = `${wPct * cardWidth}px`;
            imgEl.style.left = `${x * cardWidth}px`;
            imgEl.style.top = `${y * cardHeight}px`;
            
            cardContainer.appendChild(imgEl);
        }
        
    } catch (error) {
        console.error("Load stamps error:", error);
    }
}

// 初期表示
console.log("🔧 初期表示処理開始");
showAuth();
console.log("🔧 スクリプト読み込み完了 ✅");
