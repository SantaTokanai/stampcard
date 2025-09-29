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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// DOM要素の取得
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

// UIからスタンプをクリア
function clearStampsFromUI() {
    document.querySelectorAll('.stamp').forEach(el => el.remove());
}

// スタンプを読み込んで表示
async function loadStamps() {
    console.log('=== loadStamps開始 ===');
    
    if (!currentUser) {
        console.log('currentUserが存在しません');
        return;
    }
    
    clearStampsFromUI();
    
    try {
        const userSnap = await getDoc(doc(db, "users", currentUser));
        if (!userSnap.exists()) {
            console.log('ユーザードキュメントが存在しません');
            return;
        }
        
        const userData = userSnap.data();
        console.log('ユーザーデータ:', userData);
        
        const cardWidth = cardContainer.clientWidth;
        const cardHeight = cardContainer.clientHeight;
        console.log('カードサイズ:', cardWidth, 'x', cardHeight);
        
        // カードサイズが0の場合は少し待ってから再試行
        if (cardWidth === 0 || cardHeight === 0) {
            console.log('カードサイズが0のため再試行');
            setTimeout(() => loadStamps(), 100);
            return;
        }
        
        let stampCount = 0;
        
        for (const [key, value] of Object.entries(userData)) {
            // システムフィールドをスキップ
            if (['password', 'secretQ', 'secretA'].includes(key) || !value) {
                continue;
            }
            
            console.log(`\nスタンプ処理: ${key}`);
            
            try {
                const kwSnap = await getDoc(doc(db, 'keywords', key));
                if (!kwSnap.exists()) {
                    console.log(`  ❌ キーワード "${key}" がFirestoreに存在しません`);
                    continue;
                }
                
                const kwData = kwSnap.data();
                console.log(`  Firestoreデータ:`, kwData);
                
                // データを取得（数値型でも文字列型でも対応）
                const imgSrc = kwData.img;
                const x = Number(kwData.x);
                const y = Number(kwData.y);
                const wPct = Number(kwData.widthPercent);
                
                console.log(`  変換後: img=${imgSrc}, x=${x}, y=${y}, wPct=${wPct}`);
                
                // 値の妥当性チェック
                if (!imgSrc || isNaN(x) || isNaN(y) || isNaN(wPct)) {
                    console.log(`  ❌ 無効なデータ: imgSrc=${!!imgSrc}, x=${!isNaN(x)}, y=${!isNaN(y)}, wPct=${!isNaN(wPct)}`);
                    continue;
                }
                
                // スタンプ画像要素を作成
                const imgEl = document.createElement('img');
                imgEl.src = imgSrc;
                imgEl.className = 'stamp';
                imgEl.style.position = 'absolute';
                imgEl.style.width = `${wPct * cardWidth}px`;
                imgEl.style.left = `${x * cardWidth}px`;
                imgEl.style.top = `${y * cardHeight}px`;
                imgEl.style.transform = 'translate(-50%, -50%)';
                imgEl.style.pointerEvents = 'none';
                imgEl.style.zIndex = '10';
                
                imgEl.onload = () => console.log(`  ✅ 画像読み込み成功: ${key}`);
                imgEl.onerror = () => console.log(`  ❌ 画像読み込み失敗: ${key} (${imgSrc})`);
                
                cardContainer.appendChild(imgEl);
                stampCount++;
                console.log(`  ✅ スタンプ追加成功`);
                
            } catch (keyError) {
                console.log(`  ❌ エラー:`, keyError);
            }
        }
        
        console.log(`\n=== loadStamps完了: ${stampCount}個のスタンプを表示 ===`);
        
    } catch (error) {
        console.log('loadStampsでエラー:', error);
    }
}

// 新規登録ボタンクリック
signupBtn.onclick = () => {
    console.log('新規登録ボタンクリック');
    if (secretSection.style.display === 'none') {
        secretSection.style.display = 'block';
        showError('秘密の質問と答えを設定してください');
    }
};

// 登録完了ボタンクリック
registerSecretBtn.onclick = async () => {
    console.log('登録完了ボタンクリック');
    const nickname = nicknameInput.value.trim();
    const password = passwordInput.value.trim();
    const secretQ = secretQInput.value.trim();
    const secretA = secretAInput.value.trim();
    
    if (!nickname || !password || !secretQ || !secretA) {
        showError("全ての項目を入力してください");
        return;
    }

    try {
        const userRef = doc(db, "users", nickname);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            showError("そのニックネームは既に使用されています");
            return;
        }

        await setDoc(userRef, {
            password: password,
            secretQ: secretQ,
            secretA: secretA
        });
        
        currentUser = nickname;
        showSuccess("登録が完了しました");
        setTimeout(() => {
            showMain();
            loadStamps();
        }, 1000);
        
    } catch (error) {
        console.log("登録エラー:", error);
        showError("登録に失敗しました: " + error.message);
    }
};

// ログインボタンクリック
loginBtn.onclick = async () => {
    console.log('ログインボタンクリック');
    const nickname = nicknameInput.value.trim();
    const password = passwordInput.value.trim();
    
    if (!nickname || !password) {
        showError("ニックネームとパスワードを入力してください");
        return;
    }

    try {
        const userRef = doc(db, "users", nickname);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
            showError("ユーザーが見つかりません");
            return;
        }
        
        const userData = userSnap.data();
        if (userData.password !== password) {
            showError("パスワードが間違っています");
            return;
        }
        
        currentUser = nickname;
        showSuccess("ログインしました");
        setTimeout(() => {
            showMain();
            loadStamps();
        }, 500);
        
    } catch (error) {
        console.log("ログインエラー:", error);
        showError("ログインに失敗しました: " + error.message);
    }
};

// ログアウトボタンクリック
logoutBtn.onclick = () => {
    console.log('ログアウトボタンクリック');
    currentUser = null;
    keywordInput.value = '';
    clearStampsFromUI();
    showAuth();
};

// パスワードリセットリンククリック
forgotPasswordLink.onclick = (e) => {
    e.preventDefault();
    console.log('パスワードリセットリンククリック');
    showReset();
};

// ログインに戻るボタンクリック
backToLoginBtn.onclick = () => {
    console.log('ログインに戻るボタンクリック');
    showAuth();
};

// リセット開始ボタンクリック
resetStartBtn.onclick = async () => {
    console.log('リセット開始ボタンクリック');
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
        console.log("リセット開始エラー:", error);
        alert("エラーが発生しました");
    }
};

// リセット実行ボタンクリック
resetSubmitBtn.onclick = async () => {
    console.log('リセット実行ボタンクリック');
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
        console.log("リセット実行エラー:", error);
        alert("更新に失敗しました");
    }
};

// スタンプを押すボタンクリック
stampBtn.onclick = async () => {
    console.log('=== スタンプを押すボタンクリック ===');
    
    if (!currentUser) {
        console.log('ログインしていません');
        alert("ログインしてください");
        return;
    }
    console.log('ログイン中:', currentUser);
    
    const kw = keywordInput.value.trim();
    console.log('入力された合言葉:', kw);
    
    if (!kw) {
        console.log('合言葉が空です');
        alert("合言葉を入力してください");
        return;
    }

    try {
        console.log(`Firestoreで "${kw}" を検索中...`);
        const kwSnap = await getDoc(doc(db, "keywords", kw));
        
        if (!kwSnap.exists()) {
            console.log(`"${kw}" は存在しません`);
            alert("その合言葉は存在しません");
            return;
        }
        console.log(`"${kw}" 見つかりました:`, kwSnap.data());

        console.log('ユーザーデータ更新中...');
        const userRef = doc(db, "users", currentUser);
        await updateDoc(userRef, {
            [kw]: true
        });
        console.log('ユーザーデータ更新完了');
        
        keywordInput.value = '';
        alert("スタンプを押しました!");
        
        console.log('loadStamps呼び出し');
        loadStamps();
        
    } catch (error) {
        console.log("スタンプエラー:", error);
        alert("スタンプの追加に失敗しました: " + error.message);
    }
};

// 初期表示
showAuth();
console.log('スクリプト読み込み完了');
