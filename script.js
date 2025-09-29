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

let currentUser = null;

// DOM読み込み完了後に実行
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
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
    signupBtn.addEventListener('click', () => {
        console.log('新規登録ボタンがクリックされました');
        if (secretSection.style.display === 'none') {
            secretSection.style.display = 'block';
            showError('秘密の質問と答えを設定してください');
        }
    });

    // 登録完了ボタンクリック
    registerSecretBtn.addEventListener('click', async () => {
        console.log('登録完了ボタンがクリックされました');
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
            console.error("Registration error:", error);
            showError("登録に失敗しました: " + error.message);
        }
    });

    // ログインボタンクリック
    loginBtn.addEventListener('click', async () => {
        console.log('ログインボタンがクリックされました');
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
            console.error("Login error:", error);
            showError("ログインに失敗しました: " + error.message);
        }
    });

    // ログアウトボタンクリック
    logoutBtn.addEventListener('click', () => {
        console.log('ログアウトボタンがクリックされました');
        currentUser = null;
        keywordInput.value = '';
        clearStampsFromUI();
        showAuth();
    });

    // パスワードリセットリンククリック
    forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('パスワードリセットリンクがクリックされました');
        showReset();
    });

    // ログインに戻るボタンクリック
    backToLoginBtn.addEventListener('click', () => {
        console.log('ログインに戻るボタンがクリックされました');
        showAuth();
    });

    // リセット開始ボタンクリック
    resetStartBtn.addEventListener('click', async () => {
        console.log('リセット開始ボタンがクリックされました');
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
    });

    // リセット実行ボタンクリック
    resetSubmitBtn.addEventListener('click', async () => {
        console.log('リセット実行ボタンがクリックされました');
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
    });

    // スタンプを押すボタンクリック
    stampBtn.addEventListener('click', async () => {
        console.log('=== スタンプを押すボタンがクリックされました ===');
        
        if (!currentUser) {
            console.log('❌ ログインしていません');
            alert("ログインしてください");
            return;
        }
        console.log('✅ ログイン中のユーザー:', currentUser);
        
        const kw = keywordInput.value.trim();
        console.log('入力された合言葉:', kw);
        
        if (!kw) {
            console.log('❌ 合言葉が空です');
            alert("合言葉を入力してください");
            return;
        }

        try {
            console.log(`📡 Firestoreから "${kw}" を検索中...`);
            const kwSnap = await getDoc(doc(db, "keywords", kw));
            
            if (!kwSnap.exists()) {
                console.log(`❌ "${kw}" は存在しません`);
                alert("その合言葉は存在しません");
                return;
            }
            console.log(`✅ "${kw}" が見つかりました:`, kwSnap.data());

            console.log('💾 ユーザーデータを更新中...');
            const userRef = doc(db, "users", currentUser);
            await updateDoc(userRef, {
                [kw]: true
            });
            console.log('✅ ユーザーデータ更新完了');
            
            keywordInput.value = '';
            alert("スタンプを押しました!");
            
            console.log('🎨 スタンプ表示を更新中...');
            loadStamps();
            
        } catch (error) {
            console.error("❌ Stamp error:", error);
            alert("スタンプの追加に失敗しました: " + error.message);
        }
    });

    // UIからスタンプをクリア
    function clearStampsFromUI() {
        document.querySelectorAll('.stamp').forEach(el => el.remove());
    }

    // スタンプを読み込んで表示
    async function loadStamps() {
        console.log('=== loadStamps()開始 ===');
        console.log('currentUser:', currentUser);
        
        if (!currentUser) {
            console.log('❌ currentUserが存在しません。処理を中断');
            return;
        }
        
        clearStampsFromUI();
        
        try {
            console.log(`📡 Firestoreからユーザーデータ取得中: "${currentUser}"`);
            const userSnap = await getDoc(doc(db, "users", currentUser));
            
            if (!userSnap.exists()) {
                console.log('❌ ユーザードキュメントが存在しません');
                return;
            }
            
            const userData = userSnap.data();
            console.log('✅ ユーザーデータ取得成功:', userData);
            
            const cardWidth = cardContainer.clientWidth;
            const cardHeight = cardContainer.clientHeight;
            console.log('📐 カードサイズ:', { width: cardWidth, height: cardHeight });
            
            // カードサイズが0の場合は少し待ってから再試行
            if (cardWidth === 0 || cardHeight === 0) {
                console.log('⚠️ カードサイズが0です。100ms後に再試行...');
                setTimeout(() => loadStamps(), 100);
                return;
            }
            
            console.log('🔍 スタンプデータをチェック中...');
            let stampCount = 0;
            
            for (const [key, value] of Object.entries(userData)) {
                console.log(`\n--- チェック中: "${key}" = ${value} ---`);
                
                // システムフィールドをスキップ
                if (['password', 'secretQ', 'secretA'].includes(key)) {
                    console.log(`⏭️ システムフィールドのためスキップ: ${key}`);
                    continue;
                }
                
                if (!value) {
                    console.log(`⏭️ 値がfalseのためスキップ: ${key}`);
                    continue;
                }
                
                try {
                    console.log(`📡 Firestoreから "${key}" のスタンプ情報を取得中...`);
                    const kwSnap = await getDoc(doc(db, 'keywords', key));
                    
                    if (!kwSnap.exists()) {
                        console.warn(`❌ キーワード "${key}" がFirestoreに存在しません`);
                        continue;
                    }
                    
                    const kwData = kwSnap.data();
                    console.log(`✅ "${key}" のFirestoreデータ:`, kwData);
                    console.log(`   型情報:`, {
                        img_type: typeof kwData.img,
                        x_type: typeof kwData.x,
                        y_type: typeof kwData.y,
                        widthPercent_type: typeof kwData.widthPercent
                    });
                    
                    // データを取得し、数値に変換（文字列の場合も対応）
                    const imgSrc = kwData.img;
                    const x = parseFloat(kwData.x);
                    const y = parseFloat(kwData.y);
                    const wPct = parseFloat(kwData.widthPercent);
                    
                    console.log(`   変換後の値:`, {
                        imgSrc: imgSrc,
                        x: x,
                        y: y,
                        wPct: wPct
                    });
                    
                    console.log(`   検証結果:`, {
                        imgSrc存在: !!imgSrc,
                        imgSrc長さ: imgSrc ? imgSrc.length : 0,
                        xが数値: !isNaN(x),
                        yが数値: !isNaN(y),
                        wPctが数値: !isNaN(wPct)
                    });
                    
                    // 値の妥当性チェック
                    if (!imgSrc || isNaN(x) || isNaN(y) || isNaN(wPct)) {
                        console.error(`❌ 無効なスタンプデータ: "${key}"`);
                        console.error(`   問題のある値:`, {
                            imgSrc: imgSrc || '(空)',
                            x: x,
                            y: y,
                            wPct: wPct
                        });
                        console.warn("無効なスタンプデータをスキップ:", key, kwData);
                        continue;
                    }
                    
                    console.log(`✅ データ検証OK: "${key}"`);
                    
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
                    
                    console.log(`🎨 スタンプのスタイル設定:`, {
                        width: `${wPct * cardWidth}px`,
                        left: `${x * cardWidth}px`,
                        top: `${y * cardHeight}px`
                    });
                    
                    // 画像読み込み完了/エラーハンドラ
                    imgEl.onload = () => console.log(`✅ スタンプ画像読み込み完了: ${key} (${imgSrc})`);
                    imgEl.onerror = () => console.error(`❌ スタンプ画像読み込み失敗: ${key} (${imgSrc})`);
                    
                    cardContainer.appendChild(imgEl);
                    stampCount++;
                    console.log(`✅ スタンプ要素追加成功: "${key}"`);
                    
                } catch (keyError) {
                    console.error(`❌ キー "${key}" の処理でエラー:`, keyError);
                    console.error('エラー詳細:', keyError.stack);
                }
            }
            
            console.log(`\n=== loadStamps()完了 ===`);
            console.log(`合計 ${stampCount} 個のスタンプを表示しました`);
            
        } catch (error) {
            console.error("❌ loadStamps()でエラー発生:", error);
            console.error('エラー詳細:', error.stack);
        }
    }

    // 初期表示
    showAuth();
    console.log('アプリケーション初期化完了');
}
