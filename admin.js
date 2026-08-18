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
const adminGetUsersListFunc = httpsCallable(functions, 'adminGetUsersList');
const adminGetUserDetailFunc = httpsCallable(functions, 'adminGetUserDetail');
const adminGetKnownFieldNamesFunc = httpsCallable(functions, 'adminGetKnownFieldNames');
const adminSetUserFieldFunc = httpsCallable(functions, 'adminSetUserField');

// --- DOM要素：ログイン・共通 ---
const adminLoginSection = document.getElementById('admin-login-section');
const adminPasswordInput = document.getElementById('admin-password');
const adminLoginBtn = document.getElementById('admin-login-btn');
const adminLoginMsg = document.getElementById('admin-login-msg');
const adminDashboard = document.getElementById('admin-dashboard');
const adminLogoutBtn = document.getElementById('admin-logout-btn');

// --- DOM要素：タブ ---
const adminTabBtnGoods = document.getElementById('admin-tab-btn-goods');
const adminTabBtnRequests = document.getElementById('admin-tab-btn-requests');
const adminTabBtnUsers = document.getElementById('admin-tab-btn-users');
const adminPanelGoods = document.getElementById('admin-panel-goods');
const adminPanelRequests = document.getElementById('admin-panel-requests');
const adminPanelUsers = document.getElementById('admin-panel-users');

// --- DOM要素：グッズ交換 ---
const adminEventSelect = document.getElementById('admin-event-select');
const adminSummary = document.getElementById('admin-summary');
const adminSubmissionsList = document.getElementById('admin-submissions-list');

// --- DOM要素：曲リクエスト ---
const adminRequestPendingOnly = document.getElementById('admin-request-pending-only');
const adminRequestSummary = document.getElementById('admin-request-summary');
const adminRequestsList = document.getElementById('admin-requests-list');

// --- DOM要素：ユーザー一覧 ---
const adminUserSort = document.getElementById('admin-user-sort');
const adminUsersSummary = document.getElementById('admin-users-summary');
const adminUsersList = document.getElementById('admin-users-list');

// --- 取得したデータの保持 ---
let allEvents = [];
let allSubmissions = [];
let allRequests = [];
let requestsLoaded = false;
let allUsers = [];
let usersLoaded = false;
let userDetailCache = {}; // nickname -> trueFields配列 のキャッシュ（再タップ時に再通信しない）
let knownFieldNames = null; // keywordsの正規フィールド名一覧（初回だけ取得してキャッシュ）

// サーバー側と同じ禁止リスト（誤操作時に即座に気づけるよう、送信前にも確認する）
const PROTECTED_USER_FIELDS_CLIENT = [
  'password', 'secretQuestion', 'secretAnswerHash',
  'membershipPoint', 'stampPoint', 'colorsingPoint', 'totalPoint', 'spentPoint',
  'images', 'createdAt'
];

async function ensureKnownFieldNames() {
  if (knownFieldNames) return knownFieldNames;
  try {
    const result = await adminGetKnownFieldNamesFunc({ adminPassword: currentAdminPassword });
    knownFieldNames = result.data.success ? result.data.fieldNames : [];
  } catch (err) {
    console.error('adminGetKnownFieldNames error:', err);
    knownFieldNames = [];
  }
  return knownFieldNames;
}
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

/* ==========================================================
   グッズ交換タブ
   ========================================================== */

function renderEventSelect() {
  adminEventSelect.innerHTML = allEvents.map(ev => {
    const label = `${ev.title}（${statusLabel[ev.status] || ev.status}）`;
    return `<option value="${escapeHtml(ev.id)}">${escapeHtml(label)}</option>`;
  }).join('');
}

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

adminEventSelect.addEventListener('change', renderForSelectedEvent);

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

/* ==========================================================
   曲リクエストタブ
   ========================================================== */

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

/* ==========================================================
   ユーザー一覧タブ
   ========================================================== */

function sortUsers(users, sortKey) {
  const arr = [...users];
  switch (sortKey) {
    case 'nickname-asc':
      arr.sort((a, b) => a.nickname.localeCompare(b.nickname, 'ja'));
      break;
    case 'nickname-desc':
      arr.sort((a, b) => b.nickname.localeCompare(a.nickname, 'ja'));
      break;
    case 'createdAt-asc':
      // 登録日不明のユーザーは、どちらの並びでも常に最後にまとめる
      arr.sort((a, b) => (a.createdAt ?? Infinity) - (b.createdAt ?? Infinity));
      break;
    case 'createdAt-desc':
    default:
      arr.sort((a, b) => {
        if (a.createdAt == null) return 1;
        if (b.createdAt == null) return -1;
        return b.createdAt - a.createdAt;
      });
      break;
  }
  return arr;
}

function renderUsersList() {
  const sortKey = adminUserSort.value;
  const list = sortUsers(allUsers, sortKey);

  adminUsersSummary.textContent = `登録ユーザー数: ${list.length}人`;

  if (list.length === 0) {
    adminUsersList.innerHTML = `<div class="note-text" style="text-align:center; padding:16px;">ユーザーがいません</div>`;
    return;
  }

  adminUsersList.innerHTML = list.map(u => {
    const createdLabel = u.createdAt ? formatDate(u.createdAt) : '登録日不明';
    const createdClass = u.createdAt ? '' : 'unknown';
    return `
      <div class="admin-user-row" data-nickname="${escapeHtml(u.nickname)}">
        <div class="admin-user-row-header">
          <span class="admin-user-nickname">${escapeHtml(u.nickname)}</span>
          <span class="admin-user-created ${createdClass}">${createdLabel}</span>
          <span class="admin-user-toggle-icon">▼</span>
        </div>
        <div class="admin-user-detail"></div>
      </div>
    `;
  }).join('');
}

adminUserSort.addEventListener('change', renderUsersList);

// ユーザー行タップで詳細（trueになっているフィールド）を開閉する
adminUsersList.addEventListener('click', async (e) => {
  // フィールド追加欄（入力・ボタン）のクリックは、行の開閉とは別に処理するのでここでは無視する
  if (e.target.closest('.admin-field-add-row')) return;

  const row = e.target.closest('.admin-user-row');
  if (!row) return;

  const nickname = row.dataset.nickname;
  const detailEl = row.querySelector('.admin-user-detail');
  const isOpen = row.classList.contains('is-open');

  if (isOpen) {
    row.classList.remove('is-open');
    return;
  }

  row.classList.add('is-open');

  if (userDetailCache[nickname]) {
    renderUserDetail(detailEl, nickname, userDetailCache[nickname]);
    return;
  }

  detailEl.innerHTML = `<div class="admin-user-detail-loading">読み込み中...</div>`;

  try {
    const result = await adminGetUserDetailFunc({ adminPassword: currentAdminPassword, nickname });
    if (result.data.success) {
      userDetailCache[nickname] = result.data.trueFields;
      renderUserDetail(detailEl, nickname, result.data.trueFields);
    }
  } catch (err) {
    console.error('adminGetUserDetail error:', err);
    detailEl.innerHTML = `<div class="admin-user-detail-loading">取得に失敗しました</div>`;
  }
});

function renderUserDetail(detailEl, nickname, trueFields) {
  const tagsHtml = (!trueFields || trueFields.length === 0)
    ? `<div class="admin-field-tag-empty">trueのフィールドはありません</div>`
    : `<div class="admin-field-tag-list">${trueFields.map(f => `<span class="admin-field-tag">${escapeHtml(f)}</span>`).join('')}</div>`;

  detailEl.innerHTML = `
    ${tagsHtml}
    <div class="admin-field-add-row">
      <input type="text" class="admin-field-add-input" placeholder="フィールド名を入力（例: souki_07）">
      <button type="button" class="admin-field-add-btn">true にする</button>
    </div>
    <div class="admin-field-add-warning"></div>
    <div class="admin-field-add-status"></div>
  `;
}

// フィールド名の入力中に、正規名一覧と照合して警告を出す（ブロックはしない）
adminUsersList.addEventListener('input', async (e) => {
  if (!e.target.classList.contains('admin-field-add-input')) return;

  const row = e.target.closest('.admin-user-row');
  const warningEl = row.querySelector('.admin-field-add-warning');
  const value = e.target.value.trim();

  if (!value) {
    warningEl.textContent = '';
    return;
  }

  const known = await ensureKnownFieldNames();
  if (known.length > 0 && !known.includes(value)) {
    warningEl.textContent = '⚠️ keywordsに登録されていない名前です（新規に追加する場合は問題ありません）';
  } else {
    warningEl.textContent = '';
  }
});

// 「true にする」ボタン：確認ダイアログを経て保存する
adminUsersList.addEventListener('click', async (e) => {
  if (!e.target.classList.contains('admin-field-add-btn')) return;

  const row = e.target.closest('.admin-user-row');
  const nickname = row.dataset.nickname;
  const input = row.querySelector('.admin-field-add-input');
  const statusEl = row.querySelector('.admin-field-add-status');
  const fieldName = input.value.trim();

  if (!fieldName) {
    statusEl.textContent = 'フィールド名を入力してください';
    statusEl.style.color = '#d32f2f';
    return;
  }
  if (!/^[a-zA-Z0-9_]+$/.test(fieldName)) {
    statusEl.textContent = '半角英数字とアンダースコアのみ使用できます';
    statusEl.style.color = '#d32f2f';
    return;
  }
  if (PROTECTED_USER_FIELDS_CLIENT.includes(fieldName)) {
    statusEl.textContent = `"${fieldName}" は重要な項目のため変更できません`;
    statusEl.style.color = '#d32f2f';
    return;
  }

  const confirmed = window.confirm(`「${nickname}」の「${fieldName}」を true にします。\nよろしいですか？`);
  if (!confirmed) return;

  e.target.disabled = true;
  e.target.textContent = '処理中...';
  statusEl.textContent = '';

  try {
    await adminSetUserFieldFunc({ adminPassword: currentAdminPassword, nickname, fieldName });

    statusEl.textContent = `✅ "${fieldName}" を true にしました`;
    statusEl.style.color = '#2e7d32';
    input.value = '';
    row.querySelector('.admin-field-add-warning').textContent = '';

    // キャッシュとタグ表示を更新
    if (!userDetailCache[nickname]) userDetailCache[nickname] = [];
    if (!userDetailCache[nickname].includes(fieldName)) {
      userDetailCache[nickname].push(fieldName);
      userDetailCache[nickname].sort((a, b) => a.localeCompare(b));
    }
    const detailEl = row.querySelector('.admin-user-detail');
    renderUserDetail(detailEl, nickname, userDetailCache[nickname]);

  } catch (err) {
    console.error('adminSetUserField error:', err);
    statusEl.textContent = '❌ ' + (err.message || '保存に失敗しました');
    statusEl.style.color = '#d32f2f';
  } finally {
    const btn = row.querySelector('.admin-field-add-btn');
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'true にする';
    }
  }
});

/* ==========================================================
   タブ切替
   ========================================================== */

function switchTab(target) {
  adminTabBtnGoods.classList.toggle('admin-tab-btn-active', target === 'goods');
  adminTabBtnRequests.classList.toggle('admin-tab-btn-active', target === 'requests');
  adminTabBtnUsers.classList.toggle('admin-tab-btn-active', target === 'users');

  adminPanelGoods.style.display = target === 'goods' ? 'block' : 'none';
  adminPanelRequests.style.display = target === 'requests' ? 'block' : 'none';
  adminPanelUsers.style.display = target === 'users' ? 'block' : 'none';
}

adminTabBtnGoods.addEventListener('click', () => switchTab('goods'));

adminTabBtnRequests.addEventListener('click', async () => {
  switchTab('requests');
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

adminTabBtnUsers.addEventListener('click', async () => {
  switchTab('users');
  if (!usersLoaded) {
    adminUsersList.innerHTML = `<div class="note-text" style="text-align:center; padding:16px;">読み込み中...</div>`;
    try {
      const result = await adminGetUsersListFunc({ adminPassword: currentAdminPassword });
      if (result.data.success) {
        allUsers = result.data.users;
        usersLoaded = true;
      }
    } catch (err) {
      console.error('adminGetUsersList error:', err);
      adminUsersList.innerHTML = `<div class="note-text" style="text-align:center; padding:16px;">読み込みに失敗しました</div>`;
      return;
    }
  }
  renderUsersList();
});

/* ==========================================================
   ログイン・ログアウト・自動ログイン
   ========================================================== */

const ADMIN_SESSION_KEY = 'admin_password';

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
      switchTab('goods');
    }
    return true;
  } catch (err) {
    console.error('admin login error:', err);
    if (isAuto) {
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

adminLoginBtn.addEventListener('click', async () => {
  const pwd = adminPasswordInput.value;
  if (!pwd) {
    adminLoginMsg.textContent = 'パスワードを入力してください';
    return;
  }
  await loginWithPassword(pwd);
});

adminPasswordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') adminLoginBtn.click();
});

adminLogoutBtn.addEventListener('click', () => {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  location.reload();
});

(async function tryAutoLogin() {
  const saved = sessionStorage.getItem(ADMIN_SESSION_KEY);
  if (saved) {
    await loginWithPassword(saved, { isAuto: true });
  }
})();
