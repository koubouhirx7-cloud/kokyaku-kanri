/**
 * Kanban Board Logic
 */

const defaultColors = [
    { name: 'グレー', val: '#94a3b8' },
    { name: '青', val: '#4f46e5' },
    { name: '黄', val: '#f59e0b' },
    { name: '緑', val: '#10b981' },
    { name: '赤', val: '#ef4444' },
    { name: '紫', val: '#8b5cf6' },
    { name: 'ピンク', val: '#ec4899' }
];

function renderKanban(container) {
    container.innerHTML = `
        <div class="view-header">
            <h2>受注リスト (案件管理)</h2>
            <div class="view-actions flex gap-8" style="display: flex; gap: 8px;">
                <button class="btn btn-secondary" onclick="showArchiveModal()">📂 完了アーカイブ</button>
                <button class="btn btn-secondary" onclick="showAddColumnModal()">+ ステータス追加</button>
                <button class="btn btn-primary" onclick="showAddTaskModal()">+ 案件を追加</button>
            </div>
        </div>
        <div class="kanban-board mt-24">
            ${renderKanbanColumns()}
        </div>
    `;

    initDragAndDrop();
}

// The global 'columns' array is now assumed to be part of appState.kanbanColumns
// const columns = [
//     { id: 'todo', title: '未着手', color: '#94a3b8' },
//     { id: 'inprogress', title: '進行中', color: '#4f46e5' },
//     { id: 'review', title: '確認中', color: '#f59e0b' },
//     { id: 'done', title: '完了', color: '#10b981' }
// ];

function renderKanbanColumns() {
    return appState.kanbanColumns.map(col => `
        <div class="kanban-column glass" data-status="${col.id}">
            <div class="column-header">
                <span class="status-indicator" style="background-color: ${col.color}"></span>
                <h3>${col.title}</h3>
                <span class="task-count">${appState.tasks.filter(t => t.status === col.id).length}</span>
                <button class="btn-icon-small ml-auto" onclick="deleteColumn('${col.id}')" title="列を削除">×</button>
            </div>
            <div class="task-list" id="list-${col.id}">
                ${renderTasksByStatus(col.id)}
            </div>
        </div>
    `).join('');
}

function renderTasksByStatus(status) {
    const tasks = appState.tasks.filter(t => t.status === status);
    if (tasks.length === 0) return '<div class="empty-list-placeholder">タスクなし</div>';

    return tasks.map(task => `
        <div class="task-card glass" draggable="true" data-id="${task.id}" onclick="if(!this.classList.contains('dragging')) navigateTo('taskDetail', '${task.id}')">
            <div class="task-category">顧客: ${task.customerName || '未指定'}</div>
            <div class="task-title-inner">${task.title}</div>
            <div class="task-meta">
                <span class="task-date">📅 ${task.dueDate || '期限なし'}</span>
                <span class="task-priority ${task.priority}">${task.priority === 'high' ? '高' : task.priority === 'low' ? '低' : '中'}</span>
            </div>
            <div class="task-indicators mt-8 flex gap-8">
                ${task.memo ? '<span title="メモあり">📝</span>' : ''}
                ${task.attachment ? '<span title="画像添付あり">📎</span>' : ''}
            </div>
        </div>
    `).join('');
}

function initDragAndDrop() {
    const cards = document.querySelectorAll('.task-card');
    const lists = document.querySelectorAll('.task-list');

    cards.forEach(card => {
        card.addEventListener('dragstart', () => card.classList.add('dragging'));
        card.addEventListener('dragend', () => card.classList.remove('dragging'));
    });

    lists.forEach(list => {
        list.addEventListener('dragover', (e) => {
            e.preventDefault();
            const draggingCard = document.querySelector('.dragging');
            // This logic needs to be more sophisticated for proper drag-and-drop reordering
            // For now, just append to the end
            if (draggingCard) {
                list.appendChild(draggingCard);
            }
        });

        list.addEventListener('drop', (e) => {
            e.preventDefault();
            const draggingCard = document.querySelector('.dragging');
            if (!draggingCard) return; // Ensure a card is actually being dragged

            const taskId = draggingCard.getAttribute('data-id');
            const newStatus = list.id.replace('list-', '');

            // Update state
            const taskIndex = appState.tasks.findIndex(t => t.id === taskId);
            if (taskIndex !== -1) {
                appState.tasks[taskIndex].status = newStatus;

                // Track completion time for auto-archive
                if (newStatus === 'done') {
                    appState.tasks[taskIndex].completedAt = new Date().toISOString();
                } else {
                    // Reset if moved out of done
                    delete appState.tasks[taskIndex].completedAt;
                }

                store.save('tasks', appState.tasks);
                // Refresh counts
                updateTaskCounts();
            }
        });
    });
}

function updateTaskCounts() {
    appState.kanbanColumns.forEach(col => {
        const countEl = document.querySelector(`.kanban-column[data-status="${col.id}"] .task-count`);
        if (countEl) {
            countEl.textContent = appState.tasks.filter(t => t.status === col.id).length;
        }
    });
}

window.showAddColumnModal = () => {
    const colorOptions = defaultColors.map(c => `<option value="${c.val}">${c.name}</option>`).join('');

    showModal('新しい列を追加', `
        <form id="column-form" class="modal-form">
            <div class="form-group">
                <label>列の名前 (ステータス名)</label>
                <input type="text" name="title" required placeholder="例: 保留中">
            </div>
            <div class="form-group">
                <label>色</label>
                <select name="color" class="glass-select">
                    ${colorOptions}
                </select>
            </div>
            <div class="form-footer">
                <button type="submit" class="btn btn-primary">作成</button>
            </div>
        </form>
    `);

    document.getElementById('column-form').onsubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        // Generate a random ID or slugify name
        const id = 'col_' + Date.now();

        const newCol = {
            id: id,
            title: formData.get('title'),
            color: formData.get('color')
        };

        // Ensure appState.kanbanColumns exists, initialize if not
        if (!appState.kanbanColumns) {
            appState.kanbanColumns = [];
        }
        appState.kanbanColumns.push(newCol);
        store.save('kanban_columns', appState.kanbanColumns);

        document.getElementById('modal-container').classList.add('hidden');
        renderKanban(document.getElementById('view-container'));
    };
};

window.deleteColumn = (id) => {
    // Check for tasks
    const hasTasks = appState.tasks.some(t => t.status === id);
    if (hasTasks) {
        alert('この列にはタスクが存在するため削除できません。まずはタスクを別の列に移動してください。');
        return;
    }

    if (confirm('この列を削除してもよろしいですか？')) {
        appState.kanbanColumns = appState.kanbanColumns.filter(c => c.id !== id);
        store.save('kanban_columns', appState.kanbanColumns);
        renderKanban(document.getElementById('view-container'));
    }
};

window.showArchiveModal = () => {
    // Group archived tasks by Month
    const groups = {};
    const archives = appState.archivedTasks || [];

    if (archives.length === 0) {
        alert('アーカイブされたタスクはありません。');
        return;
    }

    archives.forEach(task => {
        // Use completedAt or createdAt fallback
        const dateStr = task.completedAt || task.createdAt;
        const date = new Date(dateStr);
        const monthKey = `${date.getFullYear()}年${date.getMonth() + 1}月`;

        if (!groups[monthKey]) groups[monthKey] = [];
        groups[monthKey].push(task);
    });

    // Sort keys desc
    const sortedKeys = Object.keys(groups).sort((a, b) => {
        // Simple string compare works for YYYY年MM月 format if MM is padded, but here it isn't.
        // Let's just rely on creation order or basic sort for now, refining strictly later if needed.
        // Actually, let's just parse the year/month to be safe.
        const [yA, mA] = a.match(/(\d+)年(\d+)月/).slice(1).map(Number);
        const [yB, mB] = b.match(/(\d+)年(\d+)月/).slice(1).map(Number);
        return (yB * 12 + mB) - (yA * 12 + mA);
    });

    const contentHtml = sortedKeys.map(key => `
        <div class="archive-month-group mb-16">
            <h3 class="text-secondary border-bottom mb-8" style="border-bottom:1px solid #444; padding-bottom:4px;">${key} (${groups[key].length})</h3>
            <div class="archive-list">
                ${groups[key].map(t => `
                    <div class="archive-item p-8 glass flex justify-between items-center mb-4" style="background:rgba(255,255,255,0.02)">
                        <div>
                            <div class="text-small text-accent">${t.customerName}</div>
                            <div class="font-bold">${t.title}</div>
                        </div>
                        <div class="text-xs text-secondary">
                            完了: ${new Date(t.completedAt).toLocaleDateString()}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');

    showModal('タスクアーカイブ', `
        <div class="archive-container" style="max-height: 60vh; overflow-y: auto;">
            ${contentHtml}
        </div>
    `);
};

window.showAddTaskModal = () => {
    const customerOptions = appState.customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    // Helper for rows
    const generateInputRows = (type) => {
        let html = '';
        for (let i = 0; i < 5; i++) {
            if (type === 'order') {
                html += `
                <div class="grid-row mb-4" style="display: grid; grid-template-columns: 3fr 1fr 1fr; gap: 8px;">
                    <input type="text" name="order_name_${i}" placeholder="部品名" class="glass-input">
                    <input type="number" name="order_price_${i}" placeholder="金額" class="glass-input">
                    <select name="order_status_${i}" class="glass-select">
                        <option value="pending">未発注</option>
                        <option value="ordered">発注済</option>
                    </select>
                </div>`;
            } else {
                html += `
                <div class="grid-row mb-4" style="display: grid; grid-template-columns: 3fr 1fr 2fr; gap: 8px;">
                    <input type="text" name="work_content_${i}" placeholder="作業内容" class="glass-input">
                    <input type="number" name="work_hours_${i}" step="0.5" placeholder="時間" class="glass-input">
                    <input type="text" name="work_notes_${i}" placeholder="備考" class="glass-input">
                </div>`;
            }
        }
        return html;
    };

    showModal('新規案件の登録', `
        <form id="task-form" class="modal-form" style="max-height: 70vh; overflow-y: auto; padding-right: 8px;">
            <div class="form-group">
                <label>案件名</label>
                <input type="text" name="title" required placeholder="例: オーバーホール依頼" class="glass-input">
            </div>
            
            <div class="grid-2" style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
                <div class="form-group">
                    <label>関連顧客</label>
                    <div class="flex gap-8">
                        <select name="customerId" class="glass-select" id="task-customer-select">
                            <option value="">顧客を選択...</option>
                            ${customerOptions}
                        </select>
                    </div>
                    <div class="mt-4">
                        <label class="text-xs flex items-center gap-4 cursor-pointer">
                            <input type="checkbox" id="toggle-new-customer" onchange="toggleNewCustomerFields(this)">
                            新規顧客を入力する
                        </label>
                    </div>
                </div>
                <div class="form-group">
                    <label>期限日</label>
                    <input type="date" name="dueDate" class="glass-input">
                </div>
            </div>

            <!-- New Customer Fields (Hidden by default) -->
            <div id="new-customer-fields" class="glass p-12 mt-8 mb-16 hidden">
                <div class="form-group mb-8">
                    <label class="text-xs">お名前</label>
                    <input type="text" name="new_customer_name" placeholder="顧客名" class="glass-input">
                </div>
                <div class="grid-2" style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
                    <div class="form-group">
                        <label class="text-xs">電話番号</label>
                        <input type="tel" name="new_customer_phone" placeholder="090-0000-0000" class="glass-input">
                    </div>
                    <div class="form-group">
                        <label class="text-xs">Email</label>
                        <input type="email" name="new_customer_email" placeholder="mail@example.com" class="glass-input">
                    </div>
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label>優先度</label>
                    <select name="priority" class="glass-select">
                        <option value="medium">中</option>
                        <option value="high">高</option>
                        <option value="low">低</option>
                    </select>
                </div>
            </div>

            <div class="form-group mt-16">
                 <label>詳細メモ</label>
                 <textarea name="memo" rows="3" class="glass-input" placeholder="作業の詳細や顧客の要望など"></textarea>
            </div>

            <div class="form-group mt-16">
                 <label>添付画像</label>
                 <div class="file-upload-box" onclick="document.getElementById('task-image-upload').click()">
                    <span id="upload-placeholder">📎 画像を選択またはドロップ</span>
                    <img id="image-preview" class="preview-thumb hidden">
                    <button type="button" id="remove-image-btn" class="remove-img-btn hidden" onclick="event.stopPropagation(); removeImage();">×</button>
                 </div>
                 <input type="file" id="task-image-upload" accept="image/*" class="hidden" onchange="handleTaskImageUpload(this)">
                 <input type="hidden" name="attachment" id="task-attachment-data">
            </div>

            <!-- Enhanced Input Areas -->
            <div class="mt-24">
                <label class="block mb-8 font-bold">📦 発注部品 (最大5件)</label>
                <div class="text-xs text-secondary mb-4 grid-row" style="display: grid; grid-template-columns: 3fr 1fr 1fr; gap: 8px;">
                    <span>部品名</span><span>金額</span><span>状態</span>
                </div>
                ${generateInputRows('order')}
            </div>

            <div class="mt-24">
                <label class="block mb-8 font-bold">🛠️ 作業内容 (最大5件)</label>
                 <div class="text-xs text-secondary mb-4 grid-row" style="display: grid; grid-template-columns: 3fr 1fr 2fr; gap: 8px;">
                    <span>内容</span><span>時間(h)</span><span>備考</span>
                </div>
                ${generateInputRows('work')}
            </div>

            <div class="form-footer mt-24">
                <button type="submit" class="btn btn-primary w-full">案件を作成</button>
            </div>
        </form>
    `);

    document.getElementById('task-form').onsubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        // Handle Customer (New vs Existing)
        let customerId = formData.get('customerId');
        let customerName = '未指定';

        const isNewCustomer = document.getElementById('toggle-new-customer').checked;
        if (isNewCustomer) {
            const newName = formData.get('new_customer_name');
            if (newName) {
                const newCustomer = {
                    id: Date.now().toString(),
                    name: newName,
                    phone: formData.get('new_customer_phone'),
                    email: formData.get('new_customer_email'),
                    createdAt: new Date().toISOString()
                };
                appState.customers.push(newCustomer);
                store.save('customers', appState.customers);
                customerId = newCustomer.id;
                customerName = newCustomer.name;
            }
        } else {
            const customer = appState.customers.find(c => c.id === customerId);
            if (customer) customerName = customer.name;
        }

        // Collect Order Items
        const orderItems = [];
        for (let i = 0; i < 5; i++) {
            const name = formData.get(`order_name_${i}`);
            if (name) {
                orderItems.push({
                    name: name,
                    price: formData.get(`order_price_${i}`),
                    status: formData.get(`order_status_${i}`)
                });
            }
        }

        // Collect Work Items
        const workItems = [];
        for (let i = 0; i < 5; i++) {
            const content = formData.get(`work_content_${i}`);
            if (content) {
                workItems.push({
                    content: content,
                    hours: formData.get(`work_hours_${i}`),
                    notes: formData.get(`work_notes_${i}`)
                });
            }
        }

        const newTask = {
            id: Date.now().toString(),
            title: formData.get('title'),
            customerId: customerId,
            customerName: customerName,
            dueDate: formData.get('dueDate'),
            priority: formData.get('priority'),
            status: appState.kanbanColumns.find(c => c.id === 'contact') ? 'contact' : 'todo',
            memo: formData.get('memo'),
            attachment: document.getElementById('task-attachment-data').value,
            orderItems: orderItems,
            workItems: workItems,
            createdAt: new Date().toISOString()
        };

        appState.tasks.push(newTask);
        store.save('tasks', appState.tasks);

        document.getElementById('modal-container').classList.add('hidden');
        renderKanban(document.getElementById('view-container'));
        showToast('案件を作成しました');
    };
};

// Kanban specific styles
const kanbanCSS = `
.kanban-board {
    display: flex;
    gap: 16px;
    height: calc(100% - 72px);
    overflow-x: auto;
    padding-bottom: 24px;
}
.kanban-column {
    min-width: 300px;
    width: 300px;
    border-radius: var(--radius);
    padding: 16px;
    display: flex;
    flex-direction: column;
}
.column-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 20px;
}
.status-indicator { width: 10px; height: 10px; border-radius: 50%; }
.task-count { margin-left: auto; background: rgba(255, 255, 255, 0.1); padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; }
.task-list { flex: 1; min-height: 200px; }
.task-card {
    background: rgba(255, 255, 255, 0.03);
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 12px;
    cursor: grab;
    transition: transform 0.2s, background 0.2s;
}
.task-card:hover { background: rgba(255, 255, 255, 0.08); }
.task-card.dragging { opacity: 0.5; cursor: grabbing; transform: scale(1.02); }
.task-category { font-size: 0.7rem; color: var(--accent-light); margin-bottom: 8px; }
.task-title-inner { font-weight: 600; margin-bottom: 12px; line-height: 1.4; }
.task-meta { display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: var(--text-secondary); }
.task-priority { padding: 2px 6px; border-radius: 4px; }
.task-priority.high { background: rgba(239, 68, 68, 0.2); color: var(--danger); }
.task-priority.medium { background: rgba(245, 158, 11, 0.2); color: var(--warning); }
.task-priority.low { background: rgba(148, 163, 184, 0.2); color: var(--text-secondary); }
.empty-list-placeholder { text-align: center; color: var(--text-secondary); font-size: 0.875rem; padding-top: 40px; border: 2px dashed rgba(255, 255, 255, 0.05); border-radius: 12px; height: 100px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.glass-select { width: 100%; padding: 10px; border-radius: 8px; background: rgba(0, 0, 0, 0.2); border: 1px solid var(--border-color); color: white; outline: none; appearance: none; }
.btn-icon-small { background: rgba(255,255,255,0.1); border: none; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background 0.2s; margin-left: 8px; }
.btn-icon-small:hover { background: rgba(239, 68, 68, 0.5); }
.ml-auto { margin-left: auto; }
`;

const kanbanStyleSheet = document.createElement("style");
kanbanStyleSheet.innerText = kanbanCSS;
document.head.appendChild(kanbanStyleSheet);
