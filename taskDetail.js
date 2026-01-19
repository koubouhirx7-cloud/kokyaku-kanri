/**
 * Task Detail View Logic
 */

function renderTaskDetail(container, taskId) {
    const task = appState.tasks.find(t => t.id === taskId);
    if (!task) {
        container.innerHTML = '<div class="p-20">案件が見つかりません</div>';
        return;
    }

    // Initialize items if not present
    if (!task.orderItems) task.orderItems = Array(5).fill({ name: '', price: '', status: '' });
    if (!task.workItems) task.workItems = Array(5).fill({ content: '', hours: '', notes: '' });

    // Helper to generate 5 rows
    const generateRows = (items, type) => {
        return items.map((item, i) => {
            if (type === 'order') {
                return `
                    <div class="grid-row mb-4" style="display: grid; grid-template-columns: 3fr 1fr 1fr; gap: 8px;">
                        <input type="text" placeholder="部品名 / 品番" value="${item.name || ''}" class="glass-input order-name-${i}">
                        <input type="number" placeholder="金額" value="${item.price || ''}" class="glass-input order-price-${i}">
                        <select class="glass-select order-status-${i}">
                            <option value="pending" ${item.status === 'pending' ? 'selected' : ''}>未発注</option>
                            <option value="ordered" ${item.status === 'ordered' ? 'selected' : ''}>発注済</option>
                            <option value="arrived" ${item.status === 'arrived' ? 'selected' : ''}>入荷</option>
                        </select>
                    </div>
                `;
            } else {
                return `
                    <div class="grid-row mb-4" style="display: grid; grid-template-columns: 3fr 1fr 2fr; gap: 8px;">
                        <input type="text" placeholder="作業内容" value="${item.content || ''}" class="glass-input work-content-${i}">
                        <input type="number" step="0.5" placeholder="時間(h)" value="${item.hours || ''}" class="glass-input work-hours-${i}">
                        <input type="text" placeholder="備考" value="${item.notes || ''}" class="glass-input work-notes-${i}">
                    </div>
                `;
            }
        }).join('');
    };

    // Load Layout Preference
    const defaultLayout = ['info', 'memo', 'photos', 'orders', 'work'];
    const layout = appState.detailLayout || defaultLayout;

    // Normalize attachments
    let images = [];
    if (task.attachments && Array.isArray(task.attachments)) {
        images = task.attachments;
    } else if (task.attachment) {
        images = [task.attachment];
    }

    // Widget Generators
    const widgets = {
        'info': `
            <div class="draggable-widget glass p-24 h-full" draggable="true" data-id="info">
                <div class="widget-header mb-16 flex justify-between items-center cursor-move">
                    <div class="section-title mb-0">📌 基本情報</div>
                    <span class="drag-handle text-secondary">:::</span>
                </div>
                <div class="info-group">
                    <label>顧客名</label>
                    <div class="info-value link" onclick="viewCustomerDetails('${task.customerId}')">${task.customerName}</div>
                </div>
                <div class="info-group mt-12">
                    <label>期限</label>
                    <div class="info-value">${task.dueDate || '-'}</div>
                </div>
                <div class="info-group mt-12">
                    <label>優先度</label>
                    <span class="priority-badge ${task.priority}">${task.priority}</span>
                </div>
                <div class="info-group mt-12">
                    <label>ステータス</label>
                    <select class="glass-select mt-4" onchange="updateTaskStatusInDetail('${task.id}', this.value)">
                         <option value="contact" ${task.status === 'contact' ? 'selected' : ''}>問い合わせ</option>
                         <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>未着手</option>
                         <option value="inprogress" ${task.status === 'inprogress' ? 'selected' : ''}>作業中</option>
                         <option value="waiting" ${task.status === 'waiting' ? 'selected' : ''}>部品待ち</option>
                         <option value="done" ${task.status === 'done' ? 'selected' : ''}>完了</option>
                    </select>
                </div>
            </div>
        `,
        'memo': `
            <div class="draggable-widget glass p-24 h-full" draggable="true" data-id="memo">
                <div class="widget-header mb-16 flex justify-between items-center cursor-move">
                    <label class="block font-bold text-lg mb-0 text-white">📝 詳細メモ (編集可)</label>
                    <span class="drag-handle text-secondary">:::</span>
                </div>
                <textarea id="task-memo-input" class="glass p-20 w-full" style="background: rgba(255,255,255,0.03); border: 1px solid var(--accent); white-space: pre-wrap; font-size: 1.1rem; line-height: 1.6; min-height: 200px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.2); border-radius: 8px; color: var(--text-main); resize: vertical; outline: none;">${task.memo || ''}</textarea>
            </div>
        `,
        'photos': `
            <div class="draggable-widget glass p-24 h-full" draggable="true" data-id="photos">
                <div class="widget-header mb-16 flex justify-between items-center cursor-move">
                    <div class="flex items-center gap-8">
                        <h3>📷 添付画像 (${images.length})</h3>
                        <label class="btn btn-small btn-secondary cursor-pointer" style="padding: 4px 8px; font-size: 0.8rem;">
                            + 追加
                            <input type="file" multiple accept="image/*" style="display:none" onchange="handleTaskDetailAttachment(event, '${task.id}')">
                        </label>
                    </div>
                    <span class="drag-handle text-secondary">:::</span>
                </div>
                ${images.length > 0 ? `
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 12px;">
                        ${images.map(img => `
                            <div class="glass flex-center" style="height: 120px; overflow: hidden; cursor: pointer; border: 1px solid rgba(255,255,255,0.1);" onclick="openImageZoom('${img}')">
                                <img src="${img}" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
                            </div>
                        `).join('')}
                    </div>
                ` : '<p class="text-secondary text-sm">画像はありません</p>'}
            </div>
        `,
        'orders': `
            <div class="draggable-widget glass p-24 h-full" draggable="true" data-id="orders">
                <div class="widget-header mb-16 flex justify-between items-center cursor-move">
                    <h3>📦 商品発注 (最大5件)</h3>
                    <span class="drag-handle text-secondary">:::</span>
                </div>
                <div class="orders-list">
                     <div class="grid-row mb-8 text-secondary text-xs" style="display: grid; grid-template-columns: 3fr 1fr 1fr; gap: 8px;">
                        <div>品名 / 品番</div>
                        <div>金額</div>
                        <div>ステータス</div>
                     </div>
                    ${generateRows(task.orderItems, 'order')}
                </div>
            </div>
        `,
        'work': `
            <div class="draggable-widget glass p-24 h-full" draggable="true" data-id="work">
                <div class="widget-header mb-16 flex justify-between items-center cursor-move">
                    <h3>🛠️ 作業内容 (最大5件)</h3>
                    <span class="drag-handle text-secondary">:::</span>
                </div>
                <div class="works-list">
                     <div class="grid-row mb-8 text-secondary text-xs" style="display: grid; grid-template-columns: 3fr 1fr 2fr; gap: 8px;">
                        <div>作業内容</div>
                        <div>時間(h)</div>
                        <div>備考</div>
                     </div>
                    ${generateRows(task.workItems, 'work')}
                </div>
            </div>
        `
    };

    container.innerHTML = `
        <div class="view-header">
            <div class="breadcrumb">
                <button class="btn btn-secondary" onclick="navigateTo('kanban')">← 受注リストに戻る</button>
            </div>
            <h2 class="ml-16">${task.title}</h2>
            <div class="view-actions ml-auto">
                <button class="btn btn-secondary mr-8" onclick="resetLayout()">レイアウト初期化</button>
                <button class="btn btn-secondary mr-8 text-danger" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3);" onclick="deleteTask(event, '${task.id}')">削除</button>
                <button class="btn btn-primary" onclick="saveTaskDetail('${task.id}')">保存する</button>
            </div>
        </div>

        <div id="widget-container" class="dashboard-grid mt-24" style="grid-template-columns: repeat(2, 1fr); align-items: start;">
            ${layout.map(id => widgets[id] || '').join('')}
        </div>
    `;

    // Ensure Zoom Modal HTML exists
    if (!document.getElementById('image-zoom-modal')) {
        const modalHtml = `
            <div id="image-zoom-modal" class="image-zoom-modal" onclick="closeImageZoom()">
                <img id="image-zoom-target" src="" alt="Zoomed Image">
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    // Drag and Drop Logic
    function initDragAndDrop() {
        // ... (existing DnD logic) matches previous but ensure it works with new widgets
        const container = document.getElementById('widget-container');
        const draggables = document.querySelectorAll('.draggable-widget');

        draggables.forEach(draggable => {
            draggable.addEventListener('dragstart', () => {
                draggable.classList.add('dragging');
            });

            draggable.addEventListener('dragend', () => {
                draggable.classList.remove('dragging');
                saveLayoutOrder();
            });
        });

        container.addEventListener('dragover', e => {
            e.preventDefault();
            const afterElement = getDragAfterElement(container, e.clientY, e.clientX);
            const draggable = document.querySelector('.dragging');
            if (afterElement == null) {
                container.appendChild(draggable);
            } else {
                container.insertBefore(draggable, afterElement);
            }
        });
    }

    // Better 2D Drag Approach
    function getDragAfterElement(container, y, x) {
        const draggableElements = [...container.querySelectorAll('.draggable-widget:not(.dragging)')]

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect()
            const dist = Math.hypot(x - (box.left + box.width / 2), y - (box.top + box.height / 2));

            if (dist < closest.dist) {
                return { dist: dist, element: child }
            } else {
                return closest
            }
        }, { dist: Number.POSITIVE_INFINITY }).element
    }

    // Initialize DnD
    initDragAndDrop();

    function saveLayoutOrder() {
        const container = document.getElementById('widget-container');
        const newLayout = [...container.querySelectorAll('.draggable-widget')].map(el => el.getAttribute('data-id'));
        appState.detailLayout = newLayout;
        store.save('detail_layout', newLayout);
    }

    window.resetLayout = () => {
        appState.detailLayout = null;
        store.save('detail_layout', null);
        // Reload current view
        const currentTaskId = task.id; // Corrected to use closure var
        renderTaskDetail(document.getElementById('view-container'), currentTaskId);
    };

    const taskDetailStyle = `
.draggable-widget { 
    transition: transform 0.2s, box-shadow 0.2s; 
    cursor: default; 
}
.draggable-widget.dragging { 
    opacity: 0.5; 
    border: 2px dashed var(--accent); 
}
.widget-header {
    border-bottom: 1px solid rgba(255,255,255,0.05);
    padding-bottom: 8px;
    margin-bottom: 16px;
}
.drag-handle {
    cursor: grab;
    padding: 4px 8px;
    border-radius: 4px;
}
.drag-handle:hover {
    background: rgba(255,255,255,0.1);
}
.task-detail-grid { display: grid; grid-template-columns: 300px 1fr; gap: 24px; align-items: start; }

.task-info-panel { padding: 24px; position: sticky; top: 24px; }
.section-title { font-weight: bold; font-size: 1.1rem; margin-bottom: 20px; color: var(--accent-light); }
.info-group { margin-bottom: 20px; }
.info-group label { display: block; font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 4px; }
.info-value { font-size: 1rem; }
.info-value.link { color: var(--accent-light); cursor: pointer; text-decoration: underline; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.detail-table { width: 100%; border-collapse: collapse; }
.detail-table th { text-align: left; padding: 12px; font-size: 0.8rem; border-bottom: 1px solid var(--border-color); color: var(--text-secondary); }
.detail-table td { padding: 12px; border-bottom: 1px solid var(--border-color); font-size: 0.9rem; }
.status-badge { padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; }
.status-badge.ordered { background: rgba(59, 130, 246, 0.2); color: #60a5fa; }
.status-badge.delivered { background: rgba(16, 185, 129, 0.2); color: #34d399; }
.status-badge.pending { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }
.work-log-item { position: relative; padding: 16px; background: rgba(255, 255, 255, 0.02); border-radius: 8px; margin-bottom: 12px; border-left: 3px solid var(--accent-color); }
.log-meta { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 0.8rem; }
.log-date { color: var(--accent-light); font-weight: bold; }
.log-duration { color: var(--text-secondary); }
.log-desc { font-size: 0.95rem; line-height: 1.5; }
.btn-delete-log { position: absolute; top: 8px; right: 8px; opacity: 0; transition: opacity 0.2s; }
.work-log-item:hover .btn-delete-log { opacity: 1; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.breadcrumb { font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 8px; }
.breadcrumb.link { cursor: pointer; }
.breadcrumb.link:hover { color: var(--accent-light); }
`;
    // Removed duplicate style injection to prevent bloat on re-renders, or keep simple check
    if (!document.getElementById('task-detail-styles')) {
        const detailStyleSheet = document.createElement("style");
        detailStyleSheet.id = 'task-detail-styles';
        detailStyleSheet.innerText = taskDetailStyle;
        document.head.appendChild(detailStyleSheet);
    }
}

// Logic for Image Zoom
window.openImageZoom = (src) => {
    const modal = document.getElementById('image-zoom-modal');
    const img = document.getElementById('image-zoom-target');
    if (modal && img) {
        img.src = src;
        modal.style.display = 'flex';
    }
};

window.closeImageZoom = () => {
    const modal = document.getElementById('image-zoom-modal');
    if (modal) {
        modal.style.display = 'none';
    }
};

// Also include the missing update function
window.updateTaskStatusInDetail = (taskId, newStatus) => {
    const task = appState.tasks.find(t => t.id === taskId);
    if (task) {
        task.status = newStatus;
        store.save('tasks', appState.tasks);
    }
};

window.handleTaskDetailAttachment = async (event, taskId) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const task = appState.tasks.find(t => t.id === taskId);
    if (!task) return;

    if (!task.attachments) task.attachments = [];
    // Ensure array if it was a single string previously (legacy data support)
    if (!Array.isArray(task.attachments) && task.attachment) {
        task.attachments = [task.attachment];
    }

    // Resize Utility (Inlined for simplicity in this module)
    const resizeImage = (file) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 800;
                    const MAX_HEIGHT = 800;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.7));
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    };

    try {
        showToast('画像を処理中...');
        const promises = Array.from(files).map(file => resizeImage(file));
        const resizedImages = await Promise.all(promises);

        task.attachments = [...task.attachments, ...resizedImages];

        // Update Store
        store.save('tasks', appState.tasks);

        // Refresh View
        renderTaskDetail(document.getElementById('view-container'), taskId);
        showToast(`${resizedImages.length}枚の画像を追加しました`);
    } catch (e) {
        console.error(e);
        showToast('画像のアップロードに失敗しました');
    }
};
