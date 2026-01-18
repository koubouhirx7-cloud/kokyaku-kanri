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
    const defaultLayout = ['info', 'memo', 'orders', 'work'];
    const layout = appState.detailLayout || defaultLayout;

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
                
                 ${task.attachment ? `
                <div class="info-group mt-24">
                    <label class="mb-4 block">📎 添付画像</label>
                    <div>
                        <img src="${task.attachment}" style="max-width: 100%; border-radius: 8px; border: 1px solid #555; cursor: pointer;" onclick="openImageZoom('${task.attachment}')">
                    </div>
                </div>` : ''}
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
                <button class="btn btn-primary" onclick="saveTaskDetail('${task.id}')">保存する</button>
            </div>
        </div>

        <div id="widget-container" class="dashboard-grid mt-24" style="grid-template-columns: repeat(2, 1fr); align-items: start;">
            ${layout.map(id => widgets[id]).join('')}
        </div>
    `;

    // Drag and Drop Logic
    function initDragAndDrop() {
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

        // Helper to find position
        function getDragAfterElement(container, y, x) {
            const draggableElements = [...container.querySelectorAll('.draggable-widget:not(.dragging)')];

            return draggableElements.reduce((closest, child) => {
                const box = child.getBoundingClientRect();
                // Simple interaction: based on vertical center if stacking, 
                // but here we have a grid. Let's rely on standard flow.
                // Finding the closest element center.
                const offsetX = x - (box.left + box.width / 2);
                const offsetY = y - (box.top + box.height / 2);
                // Logic: We want "closest" in terms of euclidean distance or just flow?
                // Since it's a grid, "insert before" logic depends on reading order.
                // If mouse is "before" the center of an element, we insert before it.

                /* Simplified Logic for 2D Grid:
                   If y is substantially above/below, row matters.
                   If in same row, x matters.
                */

                // Let's use simple distance to center point for now, works reasonably well for grids.
                const distance = Math.hypot(offsetX, offsetY);

                // Wait, standard DnD logic:
                // "Insert before the element whose center is AFTER the cursor"
                // If cursor < element_center => offset is negative.
                // We want the element with the smallest negative offset?? No.

                /* Correct "Insert Before" logic:
                   The browser handles 'appendChild' vs 'insertBefore'.
                   We need to find the element that is immediately AFTER the mouse position in DOM order.
                */

                // Let's try the robust 2D sort approach:
                if (y < box.top + box.height / 2) {
                    // Mouse is above bottom half -> candidate for "after"
                    // Check horizontal?
                    // Simple: just closest element that is "after" the mouse in reading order?
                    return closest; // TODO: Refine for grid if janky
                }
                return closest;
            }, { offset: Number.NEGATIVE_INFINITY }).element;
        }
    }

    // Better 2D Drag Approach
    function getDragAfterElement(container, y, x) {
        const draggableElements = [...container.querySelectorAll('.draggable-widget:not(.dragging)')]

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect()
            // Calculate distance between mouse and center of the box
            const offset = y - box.top - box.height / 2
            // Also consider X for grid
            // If we are in the same "row" (y is within box top/bottom), then check x

            // Simplest robust 2D: find element with minimum distance to center
            const dist = Math.hypot(x - (box.left + box.width / 2), y - (box.top + box.height / 2));

            if (dist < closest.dist) {
                return { dist: dist, element: child }
            } else {
                return closest
            }
        }, { dist: Number.POSITIVE_INFINITY }).element
    }

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
        const currentTaskId = document.querySelector('.view-actions button[onclick^="saveTaskDetail"]').getAttribute('onclick').match(/'(.+)'/)[1];
        renderTaskDetail(document.getElementById('view-container'), currentTaskId);
    };

    // Styles for Task Detail
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

    const detailStyleSheet = document.createElement("style");
    detailStyleSheet.innerText = taskDetailStyle;
    document.head.appendChild(detailStyleSheet);
}

// Also include the missing update function
window.updateTaskStatusInDetail = (taskId, newStatus) => {
    const task = appState.tasks.find(t => t.id === taskId);
    if (task) {
        task.status = newStatus;
        store.save('tasks', appState.tasks);
        showToast('ステータスを更新しました');
    }
};
