const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// DOM
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
const cardBg = document.querySelector('.card-bg');

const secretQuestion = document.getElementById('secret-question');
const secretAnswer = document.getElementById('secret-answer');

const forgotBtn = document.getElementById('forgot-password');
const resetSection = document.getElementById('reset-section');
const resetNickname = document.getElementById('reset-nickname');
const resetStep1Btn = document.getElementById('reset-step1-btn');
const resetQuestionDiv = document.getElementById('reset-question');
const resetAnswer = document.getElementById('reset-answer');
const resetVerifyBtn = document.getElementById('reset-verify-btn');
const resetNewPass = document.getElementById('reset-newpass');
const resetSetPassBtn = document.getElementById('reset-setpass-btn');
const resetCancelBtn = document.getElementById('reset-cancel');

// セッション管理（メモリ内）
let sessionData = {
  isLoggedIn: false,
  nickname: null
};
