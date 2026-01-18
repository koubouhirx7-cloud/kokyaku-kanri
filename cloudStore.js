/**
 * Cloud Synchronization Module (Supabase)
 */

const cloudStore = {
    client: null,
    config: JSON.parse(localStorage.getItem('crm_cloud_config') || 'null') || (typeof CRM_CONFIG !== 'undefined' && CRM_CONFIG.supabase.url ? CRM_CONFIG.supabase : null),
    isActive: false,

    init() {
        // Refresh config from global if valid and local is missing (double check)
        if (!this.config && typeof CRM_CONFIG !== 'undefined' && CRM_CONFIG.supabase.url) {
            this.config = CRM_CONFIG.supabase;
        }

        if (this.config && this.config.url && this.config.key) {
            try {
                // Ensure supabase global is available (loaded in index.html)
                if (typeof supabase === 'undefined') {
                    console.error('Supabase library not loaded');
                    return false;
                }
                this.client = supabase.createClient(this.config.url, this.config.key);
                this.isActive = true;
                console.log('Cloud Sync Initialized');
                return true;
            } catch (e) {
                console.error('Cloud Sync Init Failed:', e);
                return false;
            }
        }
        return false;
    },

    saveConfig(url, key) {
        this.config = { url, key };
        localStorage.setItem('crm_cloud_config', JSON.stringify(this.config));
        return this.init();
    },

    async fetchTable(table) {
        if (!this.isActive) return null;
        const { data, error } = await this.client.from(table).select('*');
        if (error) {
            console.error(`Error fetching ${table}:`, error);
            return null;
        }
        return data;
    },

    async saveRecord(table, record) {
        if (!this.isActive) return false;
        const { error } = await this.client.from(table).upsert(record);
        if (error) {
            console.error(`Error saving to ${table}:`, error);
            return false;
        }
        return true;
    },

    async deleteRecord(table, id) {
        if (!this.isActive) return false;
        const { error } = await this.client.from(table).delete().eq('id', id);
        if (error) {
            console.error(`Error deleting from ${table}:`, error);
            return false;
        }
        return true;
    },

    async pushLocalToCloud(localCustomers, localTasks) {
        if (!this.isActive) return { success: false, message: 'Cloud not active' };

        try {
            // Push customers
            if (localCustomers.length > 0) {
                const { error: cError } = await this.client.from('customers').upsert(localCustomers);
                if (cError) throw cError;
            }

            // Push tasks
            if (localTasks.length > 0) {
                const { error: tError } = await this.client.from('tasks').upsert(localTasks);
                if (tError) throw tError;
            }

            return { success: true };
        } catch (e) {
            return { success: false, message: e.message };
        }
    },

    // --- Authentication Methods ---

    async signIn(email, password) {
        if (!this.isActive) return { error: { message: 'Cloud sync is not configured.' } };
        return await this.client.auth.signInWithPassword({ email, password });
    },

    async signOut() {
        if (!this.isActive) {
            location.reload(); // Just reload if no cloud
            return;
        }
        await this.client.auth.signOut();
        location.reload();
    },

    async getSession() {
        if (!this.isActive) return null;
        const { data: { session }, error } = await this.client.auth.getSession();
        return session;
    }
};

window.showCloudSyncSetup = () => {
    const config = cloudStore.config || { url: '', key: '' };
    showModal('クラウド同期のセットアップ', `
        <div class="p-8">
            <p class="text-secondary mb-16">Supabaseの情報を入力すると、複数の端末でデータを共有できるようになります。</p>
            <form id="cloud-setup-form" class="modal-form">
                <div class="form-group">
                    <label>Supabase Project URL</label>
                    <input type="text" name="url" value="${config.url}" placeholder="https://xxxx.supabase.co" required>
                </div>
                <div class="form-group">
                    <label>Supabase Anon Key</label>
                    <input type="password" name="key" value="${config.key}" placeholder="eyJhbG..." required>
                </div>
                <div class="mb-16 p-12 bg-accent-dim rounded text-small">
                    <p>💡 <b>設定手順:</b></p>
                    <ol class="mt-8 ml-16">
                        <li>Supabaseで project を作成。</li>
                        <li>Table Editorで 'customers' と 'tasks' テーブルを作成。</li>
                        <li>各テーブルのカラムを設定（ID, Name, Status等）。</li>
                    </ol>
                </div>
                <div class="form-footer">
                    <button type="submit" class="btn btn-primary">設定を保存</button>
                    <button type="button" class="btn btn-secondary" onclick="window.open('https://app.supabase.com', '_blank')">Supabaseを開く</button>
                </div>
            </form>
            <div id="migration-section" class="mt-24 pt-16 border-top ${cloudStore.isActive ? '' : 'hidden'}">
                <p class="text-small mb-8">現在のローカルデータをクラウドへアップロードしますか？</p>
                <button class="btn btn-secondary w-full" onclick="handleCloudMigration()">ローカルデータを同期する</button>
            </div>
        </div>
    `);

    document.getElementById('cloud-setup-form').onsubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const success = cloudStore.saveConfig(formData.get('url'), formData.get('key'));
        if (success) {
            showToast('クラウド設定を保存しました');
            updateSyncStatusUI();
            location.reload(); // Reload to start sync
        } else {
            alert('接続に失敗しました。URLとキーを確認してください。\nSupabaseライブラリが読み込まれていない可能性があります。');
        }
    };
};

window.handleCloudMigration = async () => {
    if (!confirm('既存のローカルデータをクラウドに送信します。よろしいですか？')) return;

    const result = await cloudStore.pushLocalToCloud(appState.customers, appState.tasks);
    if (result.success) {
        showToast('データの移行が完了しました！');
        document.getElementById('migration-section').classList.add('hidden');
    } else {
        alert('エラーが発生しました: ' + result.message);
    }
};

window.updateSyncStatusUI = () => {
    const statusEl = document.getElementById('sync-status-indicator');
    if (!statusEl) return;

    if (cloudStore.isActive) {
        statusEl.innerHTML = '<span class="status-dot success"></span> クラウド同期中';
        statusEl.title = 'データはクラウドに保存されています';
        statusEl.onclick = showCloudSyncSetup;
    } else {
        statusEl.innerHTML = '<span class="status-dot warning"></span> ☁️ 同期設定';
        statusEl.title = 'クリックして同期設定を行う';
        statusEl.onclick = showCloudSyncSetup;
    }
    statusEl.style.cursor = 'pointer';
};
