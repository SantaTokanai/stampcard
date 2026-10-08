// 管理者ページの「アイコン」タブ：画像のアップロード／スタンプ配置の設定／ユーザーへのアイコン付与
// admin.js から initIconsTab() を呼んで使います。

const BUCKET = 'stampcard-project.firebasestorage.app';
const MAX_BYTES = 5 * 1024 * 1024;
const CARD_BG = 'images/card_background.png'; // 台紙（GitHub側に置いたまま）

export function storageUrl(path) {
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(path)}?alt=media`;
}

function resolveImg(path) {
  if (!path) return '';
  if (/^(https?:|data:)/i.test(path)) return path;
  return storageUrl(path.replace(/^\.?\//, ''));
}

function fmtSize(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + 'MB';
  return Math.max(1, Math.round(bytes / 1024)) + 'KB';
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('ファイルを読み込めませんでした'));
    reader.readAsDataURL(file);
  });
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function initIconsTab({ functions, httpsCallable, getPassword, escapeHtml: esc, showConfirmModal }) {
  const root = document.getElementById('admin-panel-icons');

  const call = async (name, data = {}) => {
    const res = await httpsCallable(functions, name)({ adminPassword: getPassword(), ...data });
    return res.data;
  };

  const state = {
    images: null,       // [{path,size,updated}]
    keywords: null,     // [{id,img,x,y,widthPercent,actualFieldName}]
    users: null,        // [{nickname,...}]
    sub: 'images',
    editing: null       // { isNew, id }
  };

  root.innerHTML = `
    <nav class="ic-subnav">
      <button type="button" class="admin-tab-btn admin-tab-btn-active" data-sub="images">🖼 画像</button>
      <button type="button" class="admin-tab-btn" data-sub="stamps">📍 スタンプ配置</button>
      <button type="button" class="admin-tab-btn" data-sub="users">🎁 ユーザーのアイコン</button>
    </nav>

    <datalist id="ic-img-datalist"></datalist>
    <datalist id="ic-folder-list"></datalist>
    <datalist id="ic-user-datalist"></datalist>

    <!-- 画像 -->
    <section id="ic-sub-images">
      <div class="admin-panel ic-box">
        <div class="ic-title">画像をアップロード</div>
        <label class="field-label">保存先フォルダ（空欄なら images 直下。例: akkii）</label>
        <input type="text" id="ic-up-folder" list="ic-folder-list" placeholder="フォルダ名（半角英数字・_・-）" autocomplete="off">
        <label class="field-label" style="margin-top:8px;">画像ファイル（複数選択OK／1枚5MBまで／png・jpg・gif・webp）</label>
        <input type="file" id="ic-up-files" accept="image/png,image/jpeg,image/gif,image/webp" multiple>
        <label class="admin-checkbox-label" style="margin-top:8px;">
          <input type="checkbox" id="ic-up-overwrite"> 同じ名前の画像があれば上書きする
        </label>
        <button type="button" id="ic-up-btn" class="btn-cta" style="margin-top:8px;">アップロード</button>
        <div id="ic-up-status" class="ic-status"></div>
      </div>

      <div class="admin-panel ic-box">
        <div class="ic-title">登録済みの画像 <span id="ic-img-count" class="ic-muted"></span></div>
        <input type="text" id="ic-img-filter" placeholder="絞り込み（例: souki）" autocomplete="off">
        <div id="ic-img-grid"></div>
      </div>
    </section>

    <!-- スタンプ配置 -->
    <section id="ic-sub-stamps" style="display:none;">
      <div id="ic-stamp-list-view">
        <div class="admin-panel ic-box">
          <button type="button" id="ic-stamp-new" class="btn-cta">＋ 新しいスタンプ設定を作る</button>
          <input type="text" id="ic-stamp-filter" placeholder="絞り込み（例: souki）" autocomplete="off" style="margin-top:8px;">
        </div>
        <div id="ic-stamp-list"></div>
      </div>

      <div id="ic-stamp-edit-view" style="display:none;">
        <div class="admin-panel ic-box">
          <div class="ic-title" id="ic-ed-title"></div>

          <label class="field-label">合言葉（キーワードID）</label>
          <input type="text" id="ic-ed-id" autocomplete="off" placeholder="例: souki_07">

          <label class="field-label" style="margin-top:8px;">画像（登録済みから選択。入力して絞り込めます）</label>
          <input type="text" id="ic-ed-img" list="ic-img-datalist" autocomplete="off" placeholder="例: images/akkii/souki_01.png">

          <div class="note-text" style="margin-top:10px;">台紙をタップ（またはドラッグ）すると、スタンプの中心がその位置に移ります</div>
          <div id="ic-ed-preview" class="ic-preview">
            <img class="ic-card-bg" src="${esc(CARD_BG)}" alt="台紙">
            <img id="ic-ed-stamp" class="ic-stamp" alt="" style="display:none;">
          </div>

          <label class="field-label">大きさ（台紙の横幅に対する％）： <strong id="ic-ed-w-label"></strong></label>
          <input type="range" id="ic-ed-w" min="2" max="80" step="0.5" value="15">

          <div class="ic-xy">
            <label class="field-label">横位置（%） <input type="number" id="ic-ed-x" min="0" max="100" step="0.1"></label>
            <label class="field-label">縦位置（%） <input type="number" id="ic-ed-y" min="0" max="100" step="0.1"></label>
          </div>

          <label class="field-label" style="margin-top:8px;">実際に保存する項目名（通常は空欄。合言葉と違う名前で記録したい場合のみ）</label>
          <input type="text" id="ic-ed-actual" autocomplete="off" placeholder="空欄でOK">

          <div class="ic-btn-row">
            <button type="button" id="ic-ed-save" class="btn-cta">保存</button>
            <button type="button" id="ic-ed-delete" class="admin-tab-btn">この設定を削除</button>
            <button type="button" id="ic-ed-back" class="admin-tab-btn">戻る</button>
          </div>
          <div id="ic-ed-status" class="ic-status"></div>
        </div>
      </div>
    </section>

    <!-- ユーザーのアイコン -->
    <section id="ic-sub-users" style="display:none;">
      <div class="admin-panel ic-box">
        <label class="field-label">ユーザーを選ぶ</label>
        <input type="text" id="ic-user-input" list="ic-user-datalist" autocomplete="off" placeholder="ニックネームを入力 または 候補から選択">
        <button type="button" id="ic-user-load" class="btn-cta" style="margin-top:8px;">表示する</button>
      </div>
      <div id="ic-user-detail"></div>
    </section>
  `;

  const $ = (id) => root.querySelector('#' + id);

  // ---------- 共通 ----------
  function setStatus(el, message, kind = '') {
    el.textContent = message;
    el.style.color = kind === 'ok' ? '#2e7d32' : kind === 'error' ? '#d32f2f' : '';
  }

  async function withBusy(btn, busyLabel, fn) {
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = busyLabel;
    try {
      return await fn();
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  }

  function errMsg(err) {
    return (err && err.message) ? err.message : '通信に失敗しました';
  }

  function showSub(name) {
    state.sub = name;
    root.querySelectorAll('.ic-subnav [data-sub]').forEach(b => {
      b.classList.toggle('admin-tab-btn-active', b.dataset.sub === name);
    });
    $('ic-sub-images').style.display = name === 'images' ? 'block' : 'none';
    $('ic-sub-stamps').style.display = name === 'stamps' ? 'block' : 'none';
    $('ic-sub-users').style.display = name === 'users' ? 'block' : 'none';
    if (name === 'stamps') loadKeywords();
    if (name === 'users') loadUsers();
  }

  // ---------- 画像 ----------
  async function loadImages(force = false) {
    if (state.images && !force) return;
    $('ic-img-grid').innerHTML = `<div class="note-text" style="text-align:center;padding:16px;">読み込み中...</div>`;
    try {
      const result = await call('adminListImages');
      state.images = result.images;
    } catch (err) {
      console.error('adminListImages error:', err);
      $('ic-img-grid').innerHTML = `<div class="note-text" style="text-align:center;padding:16px;">読み込みに失敗しました：${esc(errMsg(err))}</div>`;
      return;
    }
    renderImages();
    refreshDatalists();
  }

  function refreshDatalists() {
    const images = state.images || [];
    $('ic-img-datalist').innerHTML = images.map(i => `<option value="${esc(i.path)}"></option>`).join('');
    const folders = [...new Set(images.map(i => i.path.split('/').length > 2 ? i.path.split('/')[1] : null).filter(Boolean))].sort();
    $('ic-folder-list').innerHTML = folders.map(f => `<option value="${esc(f)}"></option>`).join('');
  }

  function renderImages() {
    const q = $('ic-img-filter').value.trim().toLowerCase();
    const all = state.images || [];
    const list = all.filter(i => !q || i.path.toLowerCase().includes(q));
    $('ic-img-count').textContent = `（${list.length} / ${all.length}枚）`;

    if (list.length === 0) {
      $('ic-img-grid').innerHTML = `<div class="note-text" style="text-align:center;padding:16px;">画像がありません</div>`;
      return;
    }

    const groups = {};
    list.forEach(i => {
      const parts = i.path.split('/');
      const folder = parts.length > 2 ? parts.slice(1, -1).join('/') : '（images 直下）';
      (groups[folder] = groups[folder] || []).push(i);
    });

    $('ic-img-grid').innerHTML = Object.keys(groups).sort().map(folder => `
      <div class="ic-folder">
        <div class="ic-folder-name">📁 ${esc(folder)} <span class="ic-muted">（${groups[folder].length}枚）</span></div>
        <div class="ic-tiles">
          ${groups[folder].map(i => `
            <div class="ic-tile">
              <img loading="lazy" src="${esc(storageUrl(i.path) + '&t=' + encodeURIComponent(i.updated || ''))}" alt="">
              <div class="ic-tile-name" title="${esc(i.path)}">${esc(i.path.split('/').pop())}</div>
              <div class="ic-muted">${fmtSize(i.size)}</div>
              <button type="button" class="ic-del-img" data-path="${esc(i.path)}">削除</button>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
  }

  function sanitizeSegment(s) {
    return String(s || '').trim().replace(/[^A-Za-z0-9_-]/g, '_');
  }

  async function uploadSelected() {
    const files = Array.from($('ic-up-files').files || []);
    const statusEl = $('ic-up-status');
    if (files.length === 0) {
      setStatus(statusEl, '画像ファイルを選んでください', 'error');
      return;
    }
    const folder = sanitizeSegment($('ic-up-folder').value);
    const overwrite = $('ic-up-overwrite').checked;
    const lines = [];
    let okCount = 0;

    for (const file of files) {
      const m = file.name.match(/^(.*)\.(png|jpe?g|gif|webp)$/i);
      if (!m) {
        lines.push(`❌ ${file.name}：対応していない形式です`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        lines.push(`❌ ${file.name}：5MBを超えています`);
        continue;
      }
      const base = sanitizeSegment(m[1]).replace(/^_+$/, '') || '';
      if (!base) {
        lines.push(`❌ ${file.name}：ファイル名を半角英数字に変更してから選び直してください`);
        continue;
      }
      const path = `images/${folder ? folder + '/' : ''}${base}.${m[2].toLowerCase()}`;
      setStatus(statusEl, lines.concat([`⏳ ${path} をアップロード中...`]).join('\n'));

      try {
        const dataUrl = await readAsDataUrl(file);
        const dataBase64 = dataUrl.split(',')[1];
        const result = await call('adminUploadImage', { path, dataBase64, overwrite });
        lines.push(`✅ ${result.path}${result.overwritten ? '（上書き）' : ''}`);
        okCount++;
      } catch (err) {
        console.error('adminUploadImage error:', err);
        lines.push(`❌ ${path}：${errMsg(err)}`);
      }
    }

    setStatus(statusEl, lines.join('\n'), okCount === files.length ? 'ok' : 'error');
    if (okCount > 0) {
      $('ic-up-files').value = '';
      await loadImages(true);
    }
  }

  async function deleteImage(path) {
    const ok = await showConfirmModal(`「${path}」を削除します。元に戻せません。よろしいですか？\n（ユーザーのアイコン置き場に入っている場合は、先に外してください）`);
    if (!ok) return;
    try {
      await call('adminDeleteImage', { path });
    } catch (err) {
      if (err.code === 'functions/failed-precondition') {
        const force = await showConfirmModal(`${errMsg(err)}\nそれでも削除しますか？（スタンプが表示されなくなります）`);
        if (!force) return;
        try {
          await call('adminDeleteImage', { path, force: true });
        } catch (err2) {
          setStatus($('ic-up-status'), '❌ 削除に失敗しました：' + errMsg(err2), 'error');
          return;
        }
      } else {
        setStatus($('ic-up-status'), '❌ 削除に失敗しました：' + errMsg(err), 'error');
        return;
      }
    }
    setStatus($('ic-up-status'), `✅ 削除しました：${path}`, 'ok');
    await loadImages(true);
  }

  // ---------- スタンプ配置 ----------
  async function loadKeywords(force = false) {
    await loadImages();
    if (state.keywords && !force) {
      renderKeywords();
      return;
    }
    $('ic-stamp-list').innerHTML = `<div class="note-text" style="text-align:center;padding:16px;">読み込み中...</div>`;
    try {
      const result = await call('adminListKeywords');
      state.keywords = result.keywords;
    } catch (err) {
      console.error('adminListKeywords error:', err);
      $('ic-stamp-list').innerHTML = `<div class="note-text" style="text-align:center;padding:16px;">読み込みに失敗しました：${esc(errMsg(err))}</div>`;
      return;
    }
    renderKeywords();
  }

  function pct(v) {
    return v == null ? '—' : (Math.round(v * 1000) / 10) + '%';
  }

  function renderKeywords() {
    const q = $('ic-stamp-filter').value.trim().toLowerCase();
    const list = (state.keywords || []).filter(k => !q || k.id.toLowerCase().includes(q) || k.img.toLowerCase().includes(q));
    if (list.length === 0) {
      $('ic-stamp-list').innerHTML = `<div class="note-text" style="text-align:center;padding:16px;">該当する設定がありません</div>`;
      return;
    }
    $('ic-stamp-list').innerHTML = list.map(k => `
      <div class="ic-kw-row" data-id="${esc(k.id)}">
        <img loading="lazy" class="ic-kw-thumb" src="${esc(resolveImg(k.img))}" alt="">
        <div class="ic-kw-info">
          <div class="ic-kw-id">${esc(k.id)}</div>
          <div class="ic-muted">${esc(k.img || '画像未設定')}</div>
          <div class="ic-muted">横${pct(k.x)} ／ 縦${pct(k.y)} ／ 大きさ${pct(k.widthPercent)}</div>
        </div>
        <button type="button" class="admin-tab-btn ic-kw-edit">編集</button>
      </div>
    `).join('');
  }

  // 編集画面
  const preview = $('ic-ed-preview');
  const stampImg = $('ic-ed-stamp');
  const inId = $('ic-ed-id');
  const inImg = $('ic-ed-img');
  const inW = $('ic-ed-w');
  const inX = $('ic-ed-x');
  const inY = $('ic-ed-y');
  const inActual = $('ic-ed-actual');

  function updatePreview() {
    const x = clamp(Number(inX.value) || 0, 0, 100);
    const y = clamp(Number(inY.value) || 0, 0, 100);
    const w = Number(inW.value) || 15;
    $('ic-ed-w-label').textContent = w + '%';
    stampImg.style.left = x + '%';
    stampImg.style.top = y + '%';
    stampImg.style.width = w + '%';

    const path = inImg.value.trim();
    if (path) {
      const src = resolveImg(path);
      if (stampImg.dataset.src !== src) {
        stampImg.dataset.src = src;
        stampImg.src = src;
      }
      stampImg.style.display = 'block';
    } else {
      stampImg.style.display = 'none';
    }
  }

  function openEditor(kw) {
    const isNew = !kw;
    state.editing = { isNew, id: kw ? kw.id : '' };
    $('ic-ed-title').textContent = isNew ? '新しいスタンプ設定' : `スタンプ設定を編集：${kw.id}`;
    inId.value = kw ? kw.id : '';
    inId.disabled = !isNew;
    inImg.value = kw ? kw.img : '';
    inW.value = kw && kw.widthPercent ? Math.round(kw.widthPercent * 1000) / 10 : 15;
    inX.value = kw && kw.x != null ? Math.round(kw.x * 1000) / 10 : 50;
    inY.value = kw && kw.y != null ? Math.round(kw.y * 1000) / 10 : 50;
    inActual.value = kw ? kw.actualFieldName : '';
    $('ic-ed-delete').style.display = isNew ? 'none' : '';
    setStatus($('ic-ed-status'), '');
    stampImg.dataset.src = '';
    $('ic-stamp-list-view').style.display = 'none';
    $('ic-stamp-edit-view').style.display = 'block';
    updatePreview();
    window.scrollTo({ top: 0 });
  }

  function closeEditor() {
    state.editing = null;
    $('ic-stamp-edit-view').style.display = 'none';
    $('ic-stamp-list-view').style.display = 'block';
    renderKeywords();
  }

  // 台紙をタップ／ドラッグして位置を決める
  let dragging = false;
  function moveStampTo(e) {
    const rect = preview.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const x = clamp((e.clientX - rect.left) / rect.width, 0, 1) * 100;
    const y = clamp((e.clientY - rect.top) / rect.height, 0, 1) * 100;
    inX.value = Math.round(x * 10) / 10;
    inY.value = Math.round(y * 10) / 10;
    updatePreview();
  }
  preview.addEventListener('pointerdown', (e) => {
    dragging = true;
    try { preview.setPointerCapture(e.pointerId); } catch (_) { /* 無視 */ }
    moveStampTo(e);
  });
  preview.addEventListener('pointermove', (e) => { if (dragging) moveStampTo(e); });
  const stopDrag = () => { dragging = false; };
  preview.addEventListener('pointerup', stopDrag);
  preview.addEventListener('pointercancel', stopDrag);

  [inW, inX, inY, inImg].forEach(el => el.addEventListener('input', updatePreview));

  async function saveKeyword() {
    const statusEl = $('ic-ed-status');
    const keywordId = inId.value.trim();
    const img = inImg.value.trim();
    if (!keywordId) { setStatus(statusEl, '合言葉（ID）を入力してください', 'error'); return; }
    if (!img) { setStatus(statusEl, '画像を選んでください', 'error'); return; }
    if (state.images && !state.images.some(i => i.path === img)) {
      const go = await showConfirmModal('この画像はまだアップロードされていません。このまま保存しますか？');
      if (!go) return;
    }
    if (state.editing.isNew && (state.keywords || []).some(k => k.id === keywordId)) {
      setStatus(statusEl, 'その合言葉は既に存在します。一覧から「編集」してください', 'error');
      return;
    }

    await withBusy($('ic-ed-save'), '保存中...', async () => {
      try {
        await call('adminSetKeyword', {
          keywordId,
          img,
          x: Number(inX.value) / 100,
          y: Number(inY.value) / 100,
          widthPercent: Number(inW.value) / 100,
          actualFieldName: inActual.value.trim()
        });
        await loadKeywordsSilently();
        setStatus(statusEl, '✅ 保存しました', 'ok');
        state.editing = { isNew: false, id: keywordId };
        inId.disabled = true;
        $('ic-ed-title').textContent = `スタンプ設定を編集：${keywordId}`;
        $('ic-ed-delete').style.display = '';
      } catch (err) {
        console.error('adminSetKeyword error:', err);
        setStatus(statusEl, '❌ ' + errMsg(err), 'error');
      }
    });
  }

  async function loadKeywordsSilently() {
    const result = await call('adminListKeywords');
    state.keywords = result.keywords;
  }

  async function deleteKeyword() {
    const id = state.editing && state.editing.id;
    if (!id) return;
    const ok = await showConfirmModal(`スタンプ設定「${id}」を削除します。\n（ユーザー側の「押した」記録は消えませんが、台紙に表示されなくなります）よろしいですか？`);
    if (!ok) return;
    try {
      await call('adminDeleteKeyword', { keywordId: id });
      await loadKeywordsSilently();
      closeEditor();
    } catch (err) {
      console.error('adminDeleteKeyword error:', err);
      setStatus($('ic-ed-status'), '❌ ' + errMsg(err), 'error');
    }
  }

  // ---------- ユーザーのアイコン ----------
  async function loadUsers() {
    await loadImages();
    if (state.users) return;
    try {
      const result = await httpsCallable(functions, 'adminGetUsersList')({ adminPassword: getPassword() });
      state.users = result.data.users || [];
      $('ic-user-datalist').innerHTML = state.users
        .map(u => u.nickname).sort((a, b) => a.localeCompare(b, 'ja'))
        .map(n => `<option value="${esc(n)}"></option>`).join('');
    } catch (err) {
      console.error('adminGetUsersList error:', err);
    }
  }

  let currentUser = '';

  function renderUserImages(images, message = '', kind = '') {
    $('ic-user-detail').innerHTML = `
      <div class="admin-panel ic-box">
        <div class="ic-title">${esc(currentUser)} さんのアイコン <span class="ic-muted">（${images.length}枚）</span></div>
        ${images.length === 0
          ? `<div class="note-text">まだアイコンがありません</div>`
          : `<div class="ic-tiles">${images.map(p => `
              <div class="ic-tile">
                <img loading="lazy" src="${esc(resolveImg(p))}" alt="">
                <div class="ic-tile-name" title="${esc(p)}">${esc(p.split('/').pop())}</div>
                <button type="button" class="ic-user-remove" data-path="${esc(p)}">外す</button>
              </div>`).join('')}</div>`}
        <label class="field-label" style="margin-top:12px;">アイコンを追加（登録済みの画像から選択）</label>
        <input type="text" id="ic-user-add-input" list="ic-img-datalist" autocomplete="off" placeholder="例: images/akkii/souki_01.png">
        <button type="button" id="ic-user-add-btn" class="btn-cta" style="margin-top:8px;">追加する</button>
        <div id="ic-user-status" class="ic-status"></div>
      </div>
    `;
    const st = $('ic-user-status');
    if (st) setStatus(st, message, kind);
  }

  async function showUser() {
    const nickname = $('ic-user-input').value.trim();
    if (!nickname) return;
    await withBusy($('ic-user-load'), '読み込み中...', async () => {
      try {
        const result = await call('adminGetUserImages', { nickname });
        currentUser = nickname;
        renderUserImages(result.images);
      } catch (err) {
        console.error('adminGetUserImages error:', err);
        $('ic-user-detail').innerHTML = `<div class="note-text" style="text-align:center;padding:16px;color:#d32f2f;">${esc(errMsg(err))}</div>`;
      }
    });
  }

  async function changeUserImage(action, path) {
    const st = $('ic-user-status');
    try {
      const result = await call('adminSetUserImage', { nickname: currentUser, path, action });
      renderUserImages(result.images, action === 'add' ? '✅ 追加しました' : '✅ 外しました', 'ok');
    } catch (err) {
      console.error('adminSetUserImage error:', err);
      setStatus(st, '❌ ' + errMsg(err), 'error');
    }
  }

  // ---------- イベント ----------
  root.addEventListener('click', async (e) => {
    const t = e.target;

    const subBtn = t.closest('.ic-subnav [data-sub]');
    if (subBtn) { showSub(subBtn.dataset.sub); return; }

    if (t.id === 'ic-up-btn') {
      await withBusy(t, 'アップロード中...', uploadSelected);
      return;
    }
    if (t.classList.contains('ic-del-img')) { await deleteImage(t.dataset.path); return; }

    if (t.id === 'ic-stamp-new') { openEditor(null); return; }
    if (t.classList.contains('ic-kw-edit')) {
      const id = t.closest('.ic-kw-row').dataset.id;
      openEditor((state.keywords || []).find(k => k.id === id));
      return;
    }
    if (t.id === 'ic-ed-save') { await saveKeyword(); return; }
    if (t.id === 'ic-ed-delete') { await deleteKeyword(); return; }
    if (t.id === 'ic-ed-back') { closeEditor(); return; }

    if (t.id === 'ic-user-load') { await showUser(); return; }
    if (t.classList.contains('ic-user-remove')) {
      const ok = await showConfirmModal(`${currentUser} さんから「${t.dataset.path}」を外します。よろしいですか？`);
      if (ok) await changeUserImage('remove', t.dataset.path);
      return;
    }
    if (t.id === 'ic-user-add-btn') {
      const path = ($('ic-user-add-input').value || '').trim();
      if (!path) { setStatus($('ic-user-status'), '画像を選んでください', 'error'); return; }
      await withBusy(t, '追加中...', () => changeUserImage('add', path));
    }
  });

  $('ic-img-filter').addEventListener('input', renderImages);
  $('ic-stamp-filter').addEventListener('input', renderKeywords);
  $('ic-user-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') showUser(); });

  return {
    // 「アイコン」タブが開かれたときに admin.js から呼ばれる
    activate() {
      showSub(state.sub);
      loadImages();
    }
  };
}
