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
    const tasks = appState.tasks
        .filter(t => t.status === status)
        .sort((a, b) => (a.order || 0) - (b.order || 0)); // Sort by order

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
                ${(task.attachments && task.attachments.length > 0) || task.attachment ? '<span title="画像添付あり">📎</span>' : ''}
            </div>
        </div>
    `).join('');
}

function initDragAndDrop() {
    const cards = document.querySelectorAll('.task-card');
    const lists = document.querySelectorAll('.task-list');

    cards.forEach(card => {
        card.addEventListener('dragstart', () => {
            card.classList.add('dragging');
        });
        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
            // Cleanup any placeholders if implemented
        });
    });

    lists.forEach(list => {
        list.addEventListener('dragover', (e) => {
            e.preventDefault();
            const afterElement = getDragAfterElement(list, e.clientY);
            const draggingCard = document.querySelector('.dragging');
            if (afterElement == null) {
                list.appendChild(draggingCard);
            } else {
                list.insertBefore(draggingCard, afterElement);
            }
        });

        list.addEventListener('drop', (e) => {
            e.preventDefault();
            const draggingCard = document.querySelector('.dragging');
            if (!draggingCard) return;

            const taskId = draggingCard.getAttribute('data-id');
            const newStatus = list.id.replace('list-', '');

            // Calc new order logic
            // We need to re-scan the list to get the new order of ALL items in this column
            const cardsInList = [...list.querySelectorAll('.task-card')];

            // Identify tasks in this column and update their order/status
            cardsInList.forEach((card, index) => {
                const cId = card.getAttribute('data-id');
                const taskIndex = appState.tasks.findIndex(t => t.id === cId);
                if (taskIndex !== -1) {
                    appState.tasks[taskIndex].status = newStatus;
                    appState.tasks[taskIndex].order = index; // Simple 0, 1, 2... order

                    // Completion date logic
                    if (newStatus === 'done' && !appState.tasks[taskIndex].completedAt) {
                        appState.tasks[taskIndex].completedAt = new Date().toISOString();
                    } else if (newStatus !== 'done') {
                        delete appState.tasks[taskIndex].completedAt;
                    }
                }
            });

            store.save('tasks', appState.tasks);
            updateTaskCounts();
        });
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.task-card:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
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
    const customerOptions = appState.customers.map(c => `<option value="${c.name}"></option>`).join('');

    // Reset images
    currentTaskImages = [];

    showModal('新規案件の登録', `
        <form id="task-form" class="modal-form" style="max-height: 70vh; overflow-y: auto; padding-right: 8px;">
            <div class="form-group">
                <label>案件名</label>
                <input type="text" name="title" required placeholder="例: オーバーホール依頼" class="glass-input">
            </div>
            
                <div class="form-group">
                    <label>関連顧客 (名前を入力または選択)</label>
                    <input type="text" name="customerInput" list="customer-list" class="glass-input" placeholder="顧客名を入力..." autocomplete="off" oninput="handleCustomerInput(this)">
                    <datalist id="customer-list">
                        ${customerOptions}
                    </datalist>
                </div>
                <div class="form-group">
                    <label>期限日</label>
                    <input type="date" name="dueDate" class="glass-input">
                </div>
            </div>

            <!-- New Customer Fields (Hidden by default, shown if input doesn't match existing) -->
            <div id="new-customer-fields" class="glass p-12 mt-8 mb-16 hidden">
                <div class="text-xs text-accent mb-8">※新規顧客として登録されます</div>
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
                 <label>添付画像 (複数可)</label>
                 <div class="file-upload-box" onclick="document.getElementById('task-image-upload').click()">
                    <span id="upload-placeholder">📎 画像を選択またはドロップ</span>
                    <div id="image-preview-container" class="hidden" style="text-align: left;"></div>
                 </div>
                 <input type="file" id="task-image-upload" accept="image/*" multiple class="hidden" onchange="handleTaskImageUpload(this)">
                 <input type="hidden" name="attachment" id="task-attachment-data">
            </div>

            <!-- Dynamic Input Areas -->
            <div class="mt-24">
                <div class="flex justify-between items-center mb-8">
                    <label class="font-bold">📦 発注部品</label>
                    <button type="button" class="btn btn-small btn-secondary" onclick="addOrderRow()">+ 部品を追加</button>
                </div>
                <div id="order-items-container">
                    <!-- Dynamic Rows go here -->
                </div>
            </div>

            <div class="mt-24">
                <div class="flex justify-between items-center mb-8">
                    <label class="font-bold">🛠️ 作業内容</label>
                    <button type="button" class="btn btn-small btn-secondary" onclick="addWorkRow()">+ 作業を追加</button>
                </div>
                <div id="work-items-container">
                    <!-- Dynamic Rows go here -->
                </div>
            </div>

            <div class="form-footer mt-24">
                <button type="submit" class="btn btn-primary w-full">案件を作成</button>
            </div>
        </form>
    `);

    // Add initial rows
    addOrderRow();
    addWorkRow();

    document.getElementById('task-form').onsubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        // Handle Customer (New vs Existing)
        const inputValue = formData.get('customerInput').trim();
        let customerId = '';
        let customerName = inputValue;

        // Check if matching existing customer
        const existingCustomer = appState.customers.find(c => c.name === inputValue);

        if (existingCustomer) {
            customerId = existingCustomer.id;
            customerName = existingCustomer.name;
        } else if (inputValue) {
            // New Customer
            const newCustomer = {
                id: Date.now().toString(),
                name: inputValue,
                phone: formData.get('new_customer_phone'),
                email: formData.get('new_customer_email'),
                createdAt: new Date().toISOString()
            };
            appState.customers.push(newCustomer);
            store.save('customers', appState.customers);
            customerId = newCustomer.id;
            customerName = newCustomer.name;
        } else {
            alert('顧客名を入力してください');
            return;
        }

        // Collect Order Items (Dynamic)
        const orderItems = [];
        document.querySelectorAll('.order-item-row').forEach(row => {
            const name = row.querySelector('[name="order_name"]').value;
            if (name) {
                orderItems.push({
                    name: name,
                    price: row.querySelector('[name="order_price"]').value,
                    status: row.querySelector('[name="order_status"]').value,
                    supplier: row.querySelector('[name="order_supplier"]').value,
                    code: row.querySelector('[name="order_code"]').value,
                    url: row.querySelector('[name="order_url"]').value,
                    memo: row.querySelector('[name="order_memo"]').value
                });
            }
        });

        // Collect Work Items (Dynamic)
        const workItems = [];
        document.querySelectorAll('.work-item-row').forEach(row => {
            const content = row.querySelector('[name="work_content"]').value;
            if (content) {
                workItems.push({
                    content: content,
                    hours: row.querySelector('[name="work_hours"]').value,
                    notes: row.querySelector('[name="work_notes"]').value,
                    description: row.querySelector('[name="work_description"]').value
                });
            }
        });

        const newTask = {
            id: Date.now().toString(),
            title: formData.get('title'),
            customerId: customerId,
            customerName: customerName,
            dueDate: formData.get('dueDate'),
            priority: formData.get('priority'),
            status: appState.kanbanColumns.find(c => c.id === 'contact') ? 'contact' : 'todo',
            memo: formData.get('memo'),
            attachments: document.getElementById('task-attachment-data').value ? JSON.parse(document.getElementById('task-attachment-data').value) : [],
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

window.handleCustomerInput = (input) => {
    const val = input.value.trim();
    const fields = document.getElementById('new-customer-fields');
    if (!val) {
        fields.classList.add('hidden');
        return;
    }

    // Check if exact match
    const exists = appState.customers.some(c => c.name === val);
    if (exists) {
        fields.classList.add('hidden');
    } else {
        fields.classList.remove('hidden');
    }
};

// Temporary storage for images
let currentTaskImages = [];

window.handleTaskImageUpload = (input) => {
    if (!input.files || input.files.length === 0) return;

    // Convert FileList to Array
    const files = Array.from(input.files);

    // Process each file
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target.result;
            currentTaskImages.push(base64);
            updateImagePreview();
        };
        reader.readAsDataURL(file);
    });
};

window.removeImage = (index) => {
    currentTaskImages.splice(index, 1);
    updateImagePreview();
};

function updateImagePreview() {
    const container = document.getElementById('image-preview-container');
    const hiddenInput = document.getElementById('task-attachment-data');
    const placeholder = document.getElementById('upload-placeholder');

    // Update Hidden Input
    hiddenInput.value = JSON.stringify(currentTaskImages);

    // Render Thumbnails
    container.innerHTML = '';

    if (currentTaskImages.length > 0) {
        placeholder.classList.add('hidden');
        container.classList.remove('hidden');

        currentTaskImages.forEach((src, index) => {
            const thumb = document.createElement('div');
            thumb.className = 'preview-thumb-wrapper';
            thumb.style.cssText = 'position: relative; display: inline-block; margin: 4px;';
            thumb.innerHTML = `
                <img src="${src}" class="preview-thumb" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px; border: 1px solid #555;">
                <button type="button" onclick="event.stopPropagation(); removeImage(${index})" 
                    style="position: absolute; top: -5px; right: -5px; background: red; color: white; border-radius: 50%; border: none; width: 18px; height: 18px; font-size: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                    ×
                </button>
            `;
            container.appendChild(thumb);
        });
    } else {
        placeholder.classList.remove('hidden');
        container.classList.add('hidden');
    }
}

// Dynamic Row Helpers
window.addOrderRow = () => {
    const container = document.getElementById('order-items-container');
    const index = Date.now() + Math.random().toString(36).substr(2, 9); // Unique ID for toggle
    const div = document.createElement('div');
    div.className = 'glass p-8 mb-8 order-item-row moving-gradient-border';
    div.innerHTML = `
        <div class="flex gap-4 items-center mb-4">
            <input type="text" name="order_name" placeholder="部品名" class="glass-input flex-1" required>
            <input type="number" name="order_price" placeholder="金額" class="glass-input" style="width: 80px;">
             <select name="order_status" class="glass-select" style="width: 90px;">
                <option value="pending">未発注</option>
                <option value="ordered">発注済</option>
            </select>
            <button type="button" class="btn-icon-small" onclick="toggleDetail('detail-${index}')" title="詳細">🔽</button>
            <button type="button" class="btn-icon-small text-danger" onclick="removeRow(this)" title="削除">×</button>
        </div>
        <div id="detail-${index}" class="hidden p-8 bg-darker rounded mt-4" style="background: rgba(0,0,0,0.3);">
            <div class="grid-2 gap-8 mb-4" style="display:grid; grid-template-columns: 1fr 1fr;">
                <input type="text" name="order_supplier" placeholder="仕入れ先/メーカー" class="glass-input text-sm">
                <input type="text" name="order_code" placeholder="品番" class="glass-input text-sm">
            </div>
            <div class="mb-4">
                <input type="url" name="order_url" placeholder="商品URL" class="glass-input text-sm">
            </div>
            <textarea name="order_memo" placeholder="備考・メモ" class="glass-input text-sm" rows="1"></textarea>
        </div>
    `;
    container.appendChild(div);
};

window.addWorkRow = () => {
    const container = document.getElementById('work-items-container');
    const index = Date.now() + Math.random().toString(36).substr(2, 9);
    const div = document.createElement('div');
    div.className = 'glass p-8 mb-8 work-item-row moving-gradient-border';
    div.innerHTML = `
        <div class="flex gap-4 items-center mb-4">
            <input type="text" name="work_content" placeholder="作業内容" class="glass-input flex-1" required>
            <input type="number" name="work_hours" step="0.5" placeholder="時間(h)" class="glass-input" style="width: 80px;">
            <button type="button" class="btn-icon-small" onclick="toggleDetail('detail-${index}')" title="詳細">🔽</button>
            <button type="button" class="btn-icon-small text-danger" onclick="removeRow(this)" title="削除">×</button>
        </div>
        <div id="detail-${index}" class="hidden p-8 bg-darker rounded mt-4" style="background: rgba(0,0,0,0.3);">
             <div class="mb-4">
                <textarea name="work_description" placeholder="詳細手順など" class="glass-input text-sm" rows="2"></textarea>
            </div>
            <input type="text" name="work_notes" placeholder="備考" class="glass-input text-sm">
        </div>
    `;
    container.appendChild(div);
};

window.toggleDetail = (id) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden');
};

window.removeRow = (btn) => {
    const row = btn.closest('.glass'); // Assuming parent wrapper is .glass
    if (confirm('削除してもよろしいですか？')) {
        row.remove();
    }
};
