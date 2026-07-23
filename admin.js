import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-functions.js";

// Firebase 設定（index.htmlと同じプロジェクト）
const firebaseConfig = {
  apiKey: "AIzaSyBI_XbbC78cXCBmm6ue-h0HJ15dNsDAnzo",
  authDomain: "stampcard-project.firebaseapp.com",
  projectId: "stampcard-project",
  storageBucket: "stampcard-project.firebasestorage.app",
  messagingSenderId: "808808121881",
  appId: "1:808808121881:web:57f6d536d40fc2d30fcc88"
};

const app = initializeApp(firebaseConfig);
const functions = getFunctions(app);
const adminGetSubmissionsFunc = httpsCallable(functions, 'adminGetSubmissions');

// --- DOM要素 ---
const adminLoginSection = document.getElementById('admin-login-section');
const adminPasswordInput = document.getElementById('admin-password');
const adminLoginBtn = document.getElementById('admin-login-btn');
const adminLoginMsg = document.getElementById('admin-login-msg');
const adminDashboard = document.getElementById('admin-dashboard');
const adminEventSelect = document.getElementById('admin-event-select');
const adminSummary = document.getElementById('admin-summary');
const adminSubmissionsList = document.getElementById('admin-submissions-list');

// --- 取得したデータの保持 ---
let allEvents = [];
let allSubmissions = [];

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function formatNumber(num) {
  return num.toLocaleString('ja-JP');
}

function formatDate(millis) {
  if (!millis) return '日時不明';
  const d = new Date(millis);
  return d.toLocaleString('ja-JP');
}

const statusLabel = {
  open: '受付中',
  preview: '下見のみ',
  closed: '終了'
};

// 交換会プルダウンを作る
function renderEventSelect() {
  adminEventSelect.innerHTML = allEvents.map(ev => {
    const label = `${ev.title}（${statusLabel[ev.status] || ev.status}）`;
    return `<option value="${escapeHtml(ev.id)}">${escapeHtml(label)}</option>`;
  }).join('');
}

// 選択中の交換会に対する申し込み一覧・集計を描画
function renderForSelectedEvent() {
  const eventId = adminEventSelect.value;
  const list = allSubmissions.filter(s => s.eventId === eventId);

  const totalSpent = list.reduce((sum, s) => sum + (s.totalSpent || 0), 0);
  adminSummary.textContent = `申し込み件数: ${list.length}件 ／ 合計消費pt: ${formatNumber(totalSpent)}pt`;

  if (list.length === 0) {
    adminSubmissionsList.innerHTML = `<div class="note-text" style="text-align:center; padding:16px;">この交換会への申し込みはまだありません</div>`;
    return;
  }

  adminSubmissionsList.innerHTML = list.map(s => {
    const itemsText = s.items.map(i => `${escapeHtml(i.name)} × ${i.qty}個`).join('<br>');
    return `
      <div class="admin-submission-row">
        <div class="admin-submission-nickname">${escapeHtml(s.nickname)}</div>
        <div class="admin-submission-items">${itemsText}</div>
        <div class="admin-submission-footer">
          <span>${formatDate(s.confirmedAt)}</span>
          <span class="admin-submission-spent">${formatNumber(s.totalSpent)}pt</span>
        </div>
      </div>
    `;
  }).join('');
}

adminEventSelect.addEventListener('change', renderForSelectedEvent);

// ログイン処理
adminLoginBtn.addEventListener('click', async () => {
  const pwd = adminPasswordInput.value;
  if (!pwd) {
    adminLoginMsg.textContent = 'パスワードを入力してください';
    return;
  }

  adminLoginBtn.disabled = true;
  adminLoginBtn.textContent = '確認中...';
  adminLoginMsg.textContent = '';

  try {
    const result = await adminGetSubmissionsFunc({ adminPassword: pwd });
    if (result.data.success) {
      allEvents = result.data.events;
      allSubmissions = result.data.submissions;

      adminLoginSection.style.display = 'none';
      adminDashboard.style.display = 'block';

      renderEventSelect();
      renderForSelectedEvent();
    }
  } catch (err) {
    console.error('admin login error:', err);
    adminLoginMsg.textContent = 'パスワードが正しくないか、通信に失敗しました';
  } finally {
    adminLoginBtn.disabled = false;
    adminLoginBtn.textContent = 'ログイン';
  }
});

// Enterキーでもログインできるように
adminPasswordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') adminLoginBtn.click();
});
