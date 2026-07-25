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
const adminSetShippingUrlFunc = httpsCallable(functions, 'adminSetShippingUrl');
const adminGetRequestsFunc = httpsCallable(functions, 'adminGetRequests');
const adminMarkRequestDoneFunc = httpsCallable(functions, 'adminMarkRequestDone');

// --- DOM要素 ---
const adminLoginSection = document.getElementById('admin-login-section');
const adminPasswordInput = document.getElementById('admin-password');
const adminLoginBtn = document.getElementById('admin-login-btn');
const adminLoginMsg = document.getElementById('admin-login-msg');
const adminDashboard = document.getElementById('admin-dashboard');
const adminEventSelect = document.getElementById('admin-event-select');
const adminSummary = document.getElementById('admin-summary');
const adminSubmissionsList = document.getElementById('admin-submissions-list');

// タブ・曲リクエスト用のDOM要素
const adminTabBtnGoods = document.getElementById('admin-tab-btn-goods');
const adminTabBtnRequests = document.getElementById('admin-tab-btn-requests');
const adminPanelGoods = document.getElementById('admin-panel-goods');
const adminPanelRequests = document.getElementById('admin-panel-requests');
const adminRequestPendingOnly = document.getElementById('admin-request-pending-only');
const adminRequestSummary = document.getElementById('admin-request-summary');
const adminRequestsList = document.getElementById('admin-requests-list');

// --- 取得したデータの保持 ---
let allEvents = [];
let allSubmissions = [];
let allRequests = [];
let requestsLoaded = false;
let currentAdminPassword = '';

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
      <div class="admin-submission-row" data-id="${escapeHtml(s.id)}">
        <div class="admin-submission-nickname">${escapeHtml(s.nickname)}</div>
        <div class="admin-submission-items">${itemsText}</div>
        <div class="admin-submission-footer">
          <span>${formatDate(s.confirmedAt)}</span>
          <span class="admin-submission-spent">${formatNumber(s.totalSpent)}pt</span>
        </div>
        <div class="admin-shipping-row">
          <input type="text" class="admin-shipping-input" placeholder="配送用URLを貼り付け" value="${escapeHtml(s.shippingUrl || '')}">
          <button class="admin-shipping-save-btn">保存</button>
        </div>
        <div class="admin-shipping-status"></div>
      </div>
    `;
  }).join('');
}

// 配送用URLの保存（一覧はイベント委譲で1つのリスナーだけ設置）
adminSubmissionsList.addEventListener('click', async (e) => {
  if (!e.target.classList.contains('admin-shipping-save-btn')) return;

  const row = e.target.closest('.admin-submission-row');
  const submissionId = row.dataset.id;
  const input = row.querySelector('.admin-shipping-input');
  const statusEl = row.querySelector('.admin-shipping-status');
  const url = input.value.trim();

  e.target.disabled = true;
  e.target.textContent = '保存中...';
  statusEl.textContent = '';

  try {
    await adminSetShippingUrlFunc({
      adminPassword: currentAdminPassword,
      submissionId,
      shippingUrl: url
    });
    statusEl.textContent = '✅ 保存しました';
    statusEl.style.color = '#2e7d32';

    // メモリ上のデータも更新（交換会を切り替えても保存内容が保たれるように）
    const target = allSubmissions.find(s => s.id === submissionId);
    if (target) target.shippingUrl = url;

  } catch (err) {
    console.error('shipping url save error:', err);
    statusEl.textContent = '❌ 保存に失敗しました';
    statusEl.style.color = '#d32f2f';
  } finally {
    e.target.disabled = false;
    e.target.textContent = '保存';
  }
});

adminEventSelect.addEventListener('change', renderForSelectedEvent);

// --- ログイン状態の一時保存（タブを閉じるまで有効） ---
const ADMIN_SESSION_KEY = 'admin_password';
const adminLogoutBtn = document.getElementById('admin-logout-btn');

// 実際のログイン処理をまとめた関数（ボタン押下時・自動ログイン時の両方から呼ぶ）
async function loginWithPassword(pwd, { isAuto = false } = {}) {
  if (!isAuto) {
    adminLoginBtn.disabled = true;
    adminLoginBtn.textContent = '確認中...';
    adminLoginMsg.textContent = '';
  }

  try {
    const result = await adminGetSubmissionsFunc({ adminPassword: pwd });
    if (result.data.success) {
      allEvents = result.data.events;
      allSubmissions = result.data.submissions;
      currentAdminPassword = pwd;
      sessionStorage.setItem(ADMIN_SESSION_KEY, pwd);

      adminLoginSection.style.display = 'none';
      adminDashboard.style.display = 'block';

      renderEventSelect();
      renderForSelectedEvent();
    }
    return true;
  } catch (err) {
    console.error('admin login error:', err);
    if (isAuto) {
      // 保存されていたパスワードが無効になっていた場合は、記憶を消してログイン画面に戻す
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
    } else {
      adminLoginMsg.textContent = 'パスワードが正しくないか、通信に失敗しました';
    }
    return false;
  } finally {
    if (!isAuto) {
      adminLoginBtn.disabled = false;
      adminLoginBtn.textContent = 'ログイン';
    }
  }
}

// ログアウト
adminLogoutBtn.addEventListener('click', () => {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  location.reload();
});

// ページを開いたときに、保存済みパスワードがあれば自動ログインを試みる
(async function tryAutoLogin() {
  const saved = sessionStorage.getItem(ADMIN_SESSION_KEY);
  if (saved) {
    await loginWithPassword(saved, { isAuto: true });
  }
})();

// --- タブ切替 ---
adminTabBtnGoods.addEventListener('click', () => {
  adminTabBtnGoods.classList.add('admin-tab-btn-active');
  adminTabBtnRequests.classList.remove('admin-tab-btn-active');
  adminPanelGoods.style.display = 'block';
  adminPanelRequests.style.display = 'none';
});

adminTabBtnRequests.addEventListener('click', async () => {
  adminTabBtnRequests.classList.add('admin-tab-btn-active');
  adminTabBtnGoods.classList.remove('admin-tab-btn-active');
  adminPanelGoods.style.display = 'none';
  adminPanelRequests.style.display = 'block';

  if (!requestsLoaded) {
    adminRequestsList.innerHTML = `<div class="note-text" style="text-align:center; padding:16px;">読み込み中...</div>`;
    try {
      const result = await adminGetRequestsFunc({ adminPassword: currentAdminPassword });
      if (result.data.success) {
        allRequests = result.data.requests;
        requestsLoaded = true;
      }
    } catch (err) {
      console.error('adminGetRequests error:', err);
      adminRequestsList.innerHTML = `<div class="note-text" style="text-align:center; padding:16px;">読み込みに失敗しました</div>`;
      return;
    }
  }
  renderRequestsList();
});

// 曲リクエスト一覧・集計を描画
function renderRequestsList() {
  const pendingOnly = adminRequestPendingOnly.checked;
  const list = pendingOnly ? allRequests.filter(r => !r.approved) : allRequests;

  const pendingCount = allRequests.filter(r => !r.approved).length;
  adminRequestSummary.textContent = `未対応: ${pendingCount}件 ／ 全体: ${allRequests.length}件`;

  if (list.length === 0) {
    adminRequestsList.innerHTML = `<div class="note-text" style="text-align:center; padding:16px;">該当するリクエストはありません</div>`;
    return;
  }

  adminRequestsList.innerHTML = list.map(r => `
    <div class="admin-request-row ${r.approved ? 'is-done' : ''}" data-id="${escapeHtml(r.id)}">
      <div class="admin-request-header">
        <div>
          <div class="admin-request-song">${escapeHtml(r.songTitle)}</div>
          <div class="admin-request-artist">${escapeHtml(r.artistName)}</div>
        </div>
        <span class="admin-request-badge ${r.approved ? 'done' : 'pending'}">${r.approved ? '対応済み' : '未対応'}</span>
      </div>
      <div class="admin-request-footer">
        <span>リクエスト者: <span class="admin-request-from">${escapeHtml(r.from)}</span> ／ ${formatDate(r.timestamp)}</span>
        ${r.approved ? '' : '<button class="admin-request-done-btn">歌い終わったら済みにする</button>'}
      </div>
    </div>
  `).join('');
}

adminRequestPendingOnly.addEventListener('change', renderRequestsList);

// 「済みにする」ボタン（イベント委譲）
adminRequestsList.addEventListener('click', async (e) => {
  if (!e.target.classList.contains('admin-request-done-btn')) return;

  const row = e.target.closest('.admin-request-row');
  const requestId = row.dataset.id;

  e.target.disabled = true;
  e.target.textContent = '処理中...';

  try {
    await adminMarkRequestDoneFunc({ adminPassword: currentAdminPassword, requestId });
    const target = allRequests.find(r => r.id === requestId);
    if (target) target.approved = true;
    renderRequestsList();
  } catch (err) {
    console.error('adminMarkRequestDone error:', err);
    e.target.disabled = false;
    e.target.textContent = '歌い終わったら済みにする';
  }
});

// ログイン処理
adminLoginBtn.addEventListener('click', async () => {
  const pwd = adminPasswordInput.value;
  if (!pwd) {
    adminLoginMsg.textContent = 'パスワードを入力してください';
    return;
  }
  await loginWithPassword(pwd);
});

// Enterキーでもログインできるように
adminPasswordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') adminLoginBtn.click();
});
