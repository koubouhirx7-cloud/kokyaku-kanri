/**
 * Main Application Logic
 */

// Global Error Handler for Mobile/User Debugging
window.onerror = function (msg, url, line, col, error) {
    alert(`システムエラーが発生しました: ${msg}\n行: ${line}`);
    console.error('Global Error:', error);
    return false;
};

window.testCloudConnection = async () => {
    const btn = document.querySelector('button[onclick="testCloudConnection()"]');
    if (btn) btn.textContent = 'テスト中...';

    try {
        if (!cloudStore.client) {
            alert('初期化エラー: Cloud Clientがありません。Configを確認してください。');
            return;
        }
        const { data, error } = await cloudStore.client.from('customers').select('id').limit(1);
        if (error) {
            alert('接続失敗: ' + (error.message || JSON.stringify(error)));
        } else {
            alert('接続成功！\nクラウドデータベースにアクセスできました。\nログインできない場合は、メールアドレスかパスワードが間違っています。');
        }
    } catch (e) {
        alert('テストエラー: ' + e.message);
    } finally {
        if (btn) btn.textContent = 'クラウド接続テスト';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    console.log('App starting...');
    try {
        initApp();
    } catch (e) {
        alert('初期化に失敗しました: ' + e.message);
    }
});

async function initApp() {
    console.log('Initializing components...');
    initClock();
    initNavigation();
    initModal();
    initAuth();

    // Google Calendar Init
    if (typeof googleCalendar !== 'undefined') {
        googleCalendar.loadGapi();
    }

    // Cloud Sync Initialization
    const cloudActive = cloudStore.init();
    updateSyncStatusUI();

    if (cloudActive) {
        // Check Session
        const session = await cloudStore.getSession();
        if (session) {
            setupAuthenticatedApp();
        } else {
            document.getElementById('auth-overlay').classList.remove('hidden');
            document.getElementById('app-main-container').classList.add('hidden');
        }
    } else {
        // No cloud config - just show app
        setupAuthenticatedApp();
    }
}

async function setupAuthenticatedApp() {
    document.getElementById('auth-overlay').classList.add('hidden');
    document.getElementById('app-main-container').classList.remove('hidden');

    // Auto Archive Check
    checkAndArchiveTasks();

    if (cloudStore.isActive) {
        await syncDataFromCloud();
    }

    loadView(localStorage.getItem('crm_current_view') || 'dashboard'); // Restore view or default
}

function initAuth() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        console.log('Login form found, binding events.');
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            console.log('Submitting login...');
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            const errorEl = document.getElementById('auth-error');

            try {
                const { data, error } = await cloudStore.signIn(email, password);

                if (error) {
                    console.error('Login error:', error);
                    errorEl.textContent = error.message;
                    errorEl.classList.remove('hidden');
                } else {
                    console.log('Login success');
                    setupAuthenticatedApp();
                }
            } catch (err) {
                console.error('SignIn Exception:', err);
                alert('ログインシステムエラー: ' + err.message);
            }
        };
    } else {
        console.warn('Login form NOT found');
    }
}

// Data Store (LocalStorage & Cloud Wrapper)
const store = {
    get(key) {
        const value = localStorage.getItem(`crm_${key}`);
        return value ? JSON.parse(value) : [];
    },
    async save(key, data) {
        // Save to LocalStorage
        try {
            const json = JSON.stringify(data);
            localStorage.setItem(`crm_${key}`, json);

            // Usage Check (Log if > 4MB)
            if (json.length > 4000000) {
                console.warn(`Warning: Data size for ${key} is large (${(json.length / 1024 / 1024).toFixed(2)} MB). Near LocalStorage limit.`);
            }
        } catch (e) {
            console.error('LocalStorage Save Error:', e);
            if (e.name === 'QuotaExceededError' || e.code === 22) {
                alert('【重要】データの保存容量が限界に達しました！\nこれ以上データを保存できません。\n\n・不要な画像を削除してください\n・「設定」からデータをバックアップ(書き出し)してください\n\n※このままリロードすると、今行った変更は失われます。');
                return;
            } else {
                alert('データの保存中にエラーが発生しました: ' + e.message);
            }
        }

        // Save to Cloud
        if (cloudStore.isActive && (key === 'customers' || key === 'tasks')) {
            console.log(`Syncing ${key} to cloud...`);
            const { error } = await cloudStore.client.from(key).upsert(data);
            if (error) {
                console.error(`Cloud sync error for ${key}:`, error);
            } else {
                console.log(`${key} synced successfully`);
            }
        }
    },
    async delete(key, id) {
        // Try to Delete from Cloud
        if (cloudStore.isActive) {
            console.log(`Deleting from cloud ${key}: ${id}`);
            const { error } = await cloudStore.client.from(key).delete().eq('id', id);
            if (error) {
                console.error(`Cloud delete error for ${key}:`, error);
            } else {
                console.log(`${key} deleted successfully`);
            }
        }
    }
};

// State Management
let appState = {
    currentView: 'dashboard',
    customers: store.get('customers'),
    tasks: store.get('tasks'),
    kanbanColumns: store.get('kanban_columns'),
    archivedTasks: store.get('archived_tasks')
};

async function syncDataFromCloud() {
    console.log('Syncing data from cloud...');
    const remoteCustomers = await cloudStore.fetchTable('customers');
    const remoteTasks = await cloudStore.fetchTable('tasks');

    // Get Last Sync Time
    const lastSyncStr = localStorage.getItem('crm_last_sync');
    const lastSyncTime = lastSyncStr ? parseInt(lastSyncStr) : 0;

    // SCENARIO 1: Cloud is empty, Local has data -> Push Local to Cloud
    // If the cloud is empty but we have local data, assume cloud was reset or we are restoring.
    // We prioritize Local Data safety over "Sync Deletion".
    if ((!remoteCustomers || remoteCustomers.length === 0) && appState.customers.length > 0) {
        console.log('Cloud is empty. Pushing local data to cloud (Restore Mode)...');
        await cloudStore.pushLocalToCloud(appState.customers, appState.tasks);
        localStorage.setItem('crm_last_sync', Date.now().toString());
        // Do not return, continue to ensure state is consistent
    }

    // SCENARIO 2: Smart Merge with Timestamp Truth
    let needsPush = false;

    if (remoteCustomers) {
        const { merged, hasLocalOnly } = mergeData(appState.customers, remoteCustomers, lastSyncTime);
        appState.customers = merged;
        if (hasLocalOnly) needsPush = true;
    }

    if (remoteTasks) {
        const { merged, hasLocalOnly } = mergeData(appState.tasks, remoteTasks, lastSyncTime);
        appState.tasks = merged;
        if (hasLocalOnly) needsPush = true;
    }

    // Local backup update
    store.save('customers', appState.customers);
    store.save('tasks', appState.tasks);

    // Update Sync Time
    localStorage.setItem('crm_last_sync', Date.now().toString());

    // Sync local-only items
    if (needsPush) {
        console.log('Found new local items. Pushing to cloud...');
        try {
            const { error: cErr } = await cloudStore.client.from('customers').upsert(appState.customers);
            if (cErr) throw cErr;

            const { error: tErr } = await cloudStore.client.from('tasks').upsert(appState.tasks);
            if (tErr) throw tErr;

            console.log('Cloud sync successful.');
        } catch (e) {
            console.error('Cloud Sync Failed:', e);
            const errorDetail = e.message || JSON.stringify(e);
            alert(`【注意】クラウドへの保存に失敗しました。\n\n詳細: ${errorDetail}\n\nデータは端末に保存されています。インターネット接続またはログイン状態を確認してください。`);
            updateSyncStatusIndicator(false);
        }
    }
}

function mergeData(localItems, remoteItems, lastSyncTime) {
    const remoteMap = new Map(remoteItems.map(i => [i.id, i]));
    const merged = [];
    let hasLocalOnly = false;

    // 1. Process Remote Items (Truth)
    remoteItems.forEach(remote => {
        merged.push(remote);
    });

    // 2. Process Local Items
    localItems.forEach(local => {
        if (!remoteMap.has(local.id)) {
            // Item exists locally but NOT in remote
            // Prevent data loss: Assume it's a new or unsynced local item
            merged.push(local);
            hasLocalOnly = true;
            console.log(`Preserving local-only item: ${local.id} (${local.title || local.name})`);
        }
    });

    return { merged, hasLocalOnly };
}

// Archive Logic
function checkAndArchiveTasks() {
    const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const now = new Date().getTime();
    let changed = false;

    // Filter tasks pending archive
    const activeTasks = [];
    const tasksToArchive = [];

    appState.tasks.forEach(task => {
        if (task.status === 'done' && task.completedAt) {
            const completedTime = new Date(task.completedAt).getTime();
            if (now - completedTime > ONE_WEEK_MS) {
                tasksToArchive.push(task);
            } else {
                activeTasks.push(task);
            }
        } else {
            activeTasks.push(task);
        }
    });

    if (tasksToArchive.length > 0) {
        console.log(`Archving ${tasksToArchive.length} tasks...`);

        // Initialize archive storage if needed
        if (!appState.archivedTasks) appState.archivedTasks = [];

        tasksToArchive.forEach(task => {
            // Add archive metadata
            task.archivedAt = new Date().toISOString();
            appState.archivedTasks.push(task);
        });

        appState.tasks = activeTasks;

        store.save('tasks', appState.tasks);
        store.save('archived_tasks', appState.archivedTasks);
        changed = true;

        showToast(`${tasksToArchive.length}件の完了タスクをアーカイブしました`);
    }
}

// Initialization with Sample Data
const defaultColumns = [
    { id: 'contact', title: '問い合わせ', color: '#94a3b8' },
    { id: 'todo', title: '未着手', color: '#64748b' },
    { id: 'inprogress', title: '作業中', color: '#4f46e5' },
    { id: 'waiting', title: '部品待ち/連絡待ち', color: '#f59e0b' },
    { id: 'done', title: '完了/納品', color: '#10b981' }
];

if (!appState.kanbanColumns || appState.kanbanColumns.length === 0) {
    appState.kanbanColumns = defaultColumns;
    store.save('kanban_columns', appState.kanbanColumns);
}

// Ensure kanban columns exist
if (!appState.kanbanColumns || appState.kanbanColumns.length === 0) {
    appState.kanbanColumns = defaultColumns;
    store.save('kanban_columns', appState.kanbanColumns);
}

// REMOVED: Default Sample Data Injection
// This was causing issues where wiping data would force-reload samples, or overwriting empty states.
// appState.customers and appState.tasks will remain empty if storage is empty.

// Navigation
function initNavigation() {
    const navItems = document.querySelectorAll('nav li');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const view = item.getAttribute('data-view');

            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            navigateTo(view);
        });
    });
}

const VIEW_MAPPING = {
    'taskDetail': 'kanban'
};

function navigateTo(view, param) {
    const container = document.getElementById('view-container');
    appState.currentView = view;

    // Save View State
    localStorage.setItem('crm_current_view', view);
    if (param) {
        localStorage.setItem('crm_current_view_param', typeof param === 'object' ? JSON.stringify(param) : param);
    } else {
        localStorage.removeItem('crm_current_view_param');
    }

    // Add transition effect
    container.classList.remove('fade-in');
    void container.offsetWidth; // Force reflow
    container.classList.add('fade-in');

    // Update Navigation UI
    const navItems = document.querySelectorAll('nav li');

    // Explicit Mapping for Sidebar Highlighting
    let targetSidebarView = view;
    if (view === 'taskDetail') {
        targetSidebarView = 'kanban';
    }

    navItems.forEach(item => {
        if (item.getAttribute('data-view') === targetSidebarView) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    switch (view) {
        case 'dashboard':
            renderDashboard(container);
            break;
        case 'customers':
            renderCustomers(container);
            break;
        case 'kanban':
            renderKanban(container);
            break;
        case 'parts':
            renderPartsView(container);
            break;
        case 'taskDetail':
            renderTaskDetail(container, param);
            break;
        case 'settings':
            renderSettings(container);
            break;
        case 'reservations':
            renderReservations(container);
            break;
    }
}

function renderSettings(container) {
    container.innerHTML = `
        <div class="glass p-24">
            <h2>設定</h2>
            
            <div class="mt-24">
                <h3>💾 データバックアップ</h3>
                <p class="text-secondary mb-16">
                    ブラウザの保存容量には制限があります。定期的にデータを書き出し、Google Drive等に保存することをお勧めします。
                </p>
                <div class="form-group">
                    <label>Google Drive (保存先)</label>
                    <div style="display:flex; gap:8px;">
                        <input type="text" value="https://drive.google.com/drive/folders/1RhK6aCBsJhhM_Wez1_L33-DSi8ZjEIYy?usp=sharing" readonly class="glass-input" style="flex:1; color:#aaa;">
                        <button class="btn btn-secondary" onclick="window.open('https://drive.google.com/drive/folders/1RhK6aCBsJhhM_Wez1_L33-DSi8ZjEIYy?usp=sharing', '_blank')">フォルダを開く</button>
                    </div>
                </div>
                <button class="btn btn-primary mt-16" onclick="exportData()">
                    📥 データを書き出し (バックアップ)
                </button>
                
                <div class="mt-24 p-16" style="border-top: 1px solid #444;">
                    <h3>📅 Google Calendar設定</h3>
                    <p class="text-secondary mb-8">予約システムと同期するためのAPI設定です。</p>
                    <div class="form-group">
                        <label>Client ID</label>
                        <input type="text" id="g-client-id" class="glass-input" value="${localStorage.getItem('crm_google_client_id') || (typeof CRM_CONFIG !== 'undefined' && CRM_CONFIG.google ? CRM_CONFIG.google.clientId : '')}" placeholder="xxxxxxxx.apps.googleusercontent.com">
                    </div>
                    <div class="form-group">
                        <label>API Key</label>
                        <input type="text" id="g-api-key" class="glass-input" value="${localStorage.getItem('crm_google_api_key') || (typeof CRM_CONFIG !== 'undefined' && CRM_CONFIG.google ? CRM_CONFIG.google.apiKey : '')}" placeholder="AIzaSy...">
                    </div>
                    <button class="btn btn-secondary mt-8" onclick="saveGoogleConfig()">設定を保存 & 再読み込み</button>
                </div>

                <div class="mt-24 p-16" style="border-top: 1px solid #444;">
                    <h3>📤 データの復元</h3>
                    <p class="text-secondary mb-8">バックアップファイル(.json)を読み込んで復元します。</p>
                    <input type="file" id="import-file" accept=".json" style="display:none" onchange="importData(this)">
                    <button class="btn btn-secondary" onclick="document.getElementById('import-file').click()">
                        📂 ファイルを選択して復元
                    </button>
                </div>
            </div>
        </div>
    `;
}

window.importData = (input) => {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (data.customers && data.tasks) {
                if (confirm('現在のデータを上書きして復元してもよろしいですか？')) {
                    appState.customers = data.customers;
                    appState.tasks = data.tasks;
                    store.save('customers', appState.customers);
                    store.save('tasks', appState.tasks);
                    alert('復元が完了しました。ページをリロードします。');
                    location.reload();
                }
            } else {
                alert('無効なバックアップファイルです。');
            }
        } catch (err) {
            console.error(err);
            alert('ファイルの読み込みに失敗しました。');
        }
    };
    reader.readAsText(file);
};

window.exportData = () => {
    const data = {
        customers: appState.customers,
        tasks: appState.tasks,
        timestamp: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crm_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert('バックアップファイルをダウンロードしました。\n指定のGoogle Driveフォルダにアップロードしてください。');
};

// Rename loadView to navigateTo for consistency or just proxy it
function loadView(view) {
    // Restore params if needed
    const savedParam = localStorage.getItem('crm_current_view_param');
    let param = null;
    if (savedParam) {
        try {
            param = JSON.parse(savedParam);
        } catch (e) {
            param = savedParam;
        }
    }
    navigateTo(view, param);
}

// Dashboard View
function renderDashboard(container) {
    const stats = calculateStats();
    const focusTask = appState.tasks.find(t => t.priority === 'high' && t.status !== 'done');

    container.innerHTML = `
        <div class="dashboard-grid">
            <div class="stat-card glass slide-up">
                <div class="stat-label">👥 総顧客数</div>
                <div class="stat-value">${stats.totalCustomers}</div>
                <div class="stat-trend up">+ ${stats.newCustomersThisMonth} (今月)</div>
            </div>
            <div class="stat-card glass slide-up" style="animation-delay: 0.1s">
                <div class="stat-label">⏳ 進行中のタスク</div>
                <div class="stat-value">${stats.activeTasks}</div>
            </div>
            <div class="stat-card glass slide-up" style="animation-delay: 0.2s">
                <div class="stat-label">✅ 完了済み</div>
                <div class="stat-value">${stats.completedTasks}</div>
            </div>
        </div>
        
        <div class="dashboard-layout mt-24">
            <div class="dashboard-main glass slide-up" style="animation-delay: 0.3s">
                <h3>📋 最近のタスク</h3>
                <div id="recent-tasks-list">
                    ${renderRecentTasks()}
                </div>
            </div>
            <div class="dashboard-side glass slide-up" style="animation-delay: 0.4s">
                <h3>🎯 今日のフォーカス</h3>
                <div class="focus-content">
                    ${focusTask ? `
                        <div class="focus-card highlight">
                            <div class="focus-title">${focusTask.title}</div>
                            <div class="focus-customer">${focusTask.customerName}</div>
                            <div class="focus-meta">期限: ${focusTask.dueDate || '未設定'}</div>
                        </div>
                    ` : '<p class="text-secondary">優先タスクはありません</p>'}
                </div>
            </div>
        </div>
    `;
}

function calculateStats() {
    return {
        totalCustomers: appState.customers.length,
        newCustomersThisMonth: 0,
        activeTasks: appState.tasks.filter(t => t.status !== 'done').length,
        completedTasks: appState.tasks.filter(t => t.status === 'done').length
    };
}

function renderRecentTasks() {
    if (appState.tasks.length === 0) return '<p class="text-secondary p-16">タスクがありません</p>';

    return appState.tasks.slice(-5).map(task => `
        <div class="recent-task-item">
            <span class="status-dot ${task.status}"></span>
            <span class="task-title">${task.title}</span>
            <span class="task-date">${task.dueDate || ''}</span>
        </div>
    `).join('');
}

// Real-time Clock
function initClock() {
    const clockEl = document.getElementById('real-time-clock');
    setInterval(() => {
        const now = new Date();
        clockEl.textContent = now.toLocaleTimeString('ja-JP', { hour12: false });
    }, 1000);
}

// Modal handling
function initModal() {
    const modal = document.getElementById('modal-container');
    const closeBtn = document.querySelector('.close-modal');

    closeBtn.onclick = () => modal.classList.add('hidden');
    // window.onclick = (e) => {
    //     if (e.target === modal) modal.classList.add('hidden');
    // };

    document.getElementById('add-new-btn').onclick = () => {
        if (appState.currentView === 'customers') {
            showAddCustomerModal();
        } else if (appState.currentView === 'kanban') {
            showAddTaskModal();
        } else {
            showAddTaskModal(); // Default to task if on dashboard
        }
    };
}

function showModal(title, bodyHtml) {
    const modal = document.getElementById('modal-container');
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    modal.classList.remove('hidden');
}

// Utility for CSS
const globalCSS = `
.dashboard-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 24px;
}
.stat-card {
    padding: 24px;
    border-radius: var(--radius);
}
.stat-label { color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 8px; }
.stat-value { font-size: 2rem; font-weight: 600; margin-bottom: 8px; }
.stat-trend { font-size: 0.75rem; }
.stat-trend.up { color: var(--success); }
.p-24 { padding: 24px; }
.mt-24 { margin-top: 24px; }
.p-16 { padding: 16px; }
.recent-task-item {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color);
    gap: 12px;
}
.status-dot { width: 8px; height: 8px; border-radius: 50%; }
.status-dot.todo { background: var(--text-secondary); }
.status-dot.inprogress { background: var(--accent-color); }
.status-dot.done { background: var(--success); }
`;

// Inject additional styles
const styleSheet = document.createElement("style");
styleSheet.innerText = globalCSS;
document.head.appendChild(styleSheet);

// Public Entry QR Logic
window.showCustomerEntryQR = () => {
    const publicUrl = localStorage.getItem('crm_public_form_url') || (typeof CRM_CONFIG !== 'undefined' ? CRM_CONFIG.publicUrl : '') || '入力してください';
    showModal('お客様受付QRコード', `
        <div class='p-16 text-center'>
            <p class='text-secondary mb-16'>お客様のスマホでこのQRコードを読み取ってもらってください。</p>
            <div id='qrcode-container' class='flex-center p-16 bg-white rounded-lg mb-16' style='display:inline-block; padding:10px; background:white;'></div>
            <div class='mt-16 text-left'>
                <label class='text-small text-secondary'>公開URL設定 (GitHub Pages等):</label>
                <div class='flex gap-8 mt-4'>
                    <input type='text' id='public-url-input' class='glass-input' value='${publicUrl}' style='width:100%; background:rgba(0,0,0,0.2); border:1px solid #444; color:white; padding:8px;'>
                    <button class='btn btn-small btn-primary' onclick='savePublicUrl()'>保存</button>
                </div>
            </div>
        </div>
    `);

    const container = document.getElementById('qrcode-container');
    if (publicUrl && publicUrl !== '入力してください') {
        new QRCode(container, {
            text: publicUrl,
            width: 200,
            height: 200,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H
        });
    } else {
        container.innerHTML = '<p class="text-danger">URLを設定してください</p>';
    }
};

window.savePublicUrl = () => {
    const url = document.getElementById('public-url-input').value;
    localStorage.setItem('crm_public_form_url', url);
    showToast('URLを保存しました');
    showCustomerEntryQR(); // Refresh QR
};

window.saveGoogleConfig = () => {
    const cid = document.getElementById('g-client-id').value;
    const key = document.getElementById('g-api-key').value;

    if (!cid || !key) {
        alert('Client IDとAPI Keyの両方を入力してください。');
        return;
    }

    localStorage.setItem('crm_google_client_id', cid);
    localStorage.setItem('crm_google_api_key', key);
    alert('設定を保存しました。システムをリロードします。');
    location.reload();
};



// Global Image Compression Utility
window.resizeImage = (file, maxWidth = 800, maxHeight = 800, quality = 0.7) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                // Return compressed base64
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

window.showToast = (message) => {
    let toast = document.getElementById('toast-msg');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast-msg';
        toast.style.cssText = `
            position: fixed; bottom: 24px; right: 24px; 
            background: rgba(30, 41, 59, 0.9); border: 1px solid var(--primary);
            color: white; padding: 12px 24px; border-radius: 8px; 
            z-index: 3000; box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            transition: opacity 0.3s, transform 0.3s;
        `;
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
    }, 3000);
};
