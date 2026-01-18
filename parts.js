/**
 * Parts Ordering View
 * Aggregates all order items from tasks
 */

function renderPartsView(container) {
    container.innerHTML = `
        <div class="view-header">
            <h2>📦 部品発注・入荷管理</h2>
            <div class="view-actions ml-auto">
                <button class="btn btn-secondary" onclick="renderPartsView(document.getElementById('view-container'))">🔄 更新</button>
            </div>
        </div>
        
        <div class="parts-dashboard mt-24">
            <div class="dashboard-layout" style="grid-template-columns: 1fr; gap: 32px;">
                
                <!-- Pending Orders -->
                <div class="glass p-24">
                    <div class="section-header mb-16">
                        <h3 class="text-warning">⚠️ 未発注リスト (To Order)</h3>
                        <span class="task-count" id="count-pending">0</span>
                    </div>
                    <div id="pending-list" class="overflow-x-auto"></div>
                </div>

                <!-- Ordered / Waiting -->
                <div class="glass p-24">
                    <div class="section-header mb-16">
                        <h3 class="text-primary">🚚 発注済・入荷待ち (Waiting)</h3>
                        <span class="task-count" id="count-ordered">0</span>
                    </div>
                    <div id="ordered-list" class="overflow-x-auto"></div>
                </div>

                <!-- Arrived / Completed -->
                <div class="glass p-24">
                    <div class="section-header mb-16 flex justify-between items-center" style="display: flex; justify-content: space-between;">
                        <h3 class="text-success">✅ 入荷完了 (Arrived)</h3>
                        <div class="flex items-center gap-8">
                            <span class="task-count" id="count-arrived">0</span>
                            <button class="btn btn-small" onclick="toggleArrivedList()">表示/非表示</button>
                        </div>
                    </div>
                    <div id="arrived-list" class="overflow-x-auto hidden"></div>
                </div>

            </div>
        </div>
    `;

    renderPartsLists();
}

let showArrived = false;
window.toggleArrivedList = () => {
    showArrived = !showArrived;
    const el = document.getElementById('arrived-list');
    if (showArrived) el.classList.remove('hidden');
    else el.classList.add('hidden');
};

function renderPartsLists() {
    const pendingItems = [];
    const orderedItems = [];
    const arrivedItems = [];

    appState.tasks.forEach(task => {
        if (!task.orderItems) return;
        task.orderItems.forEach((item, index) => {
            const enrichedItem = { ...item, taskTitle: task.title, taskId: task.id, itemIndex: index };
            if (!item.name) return;

            if (item.status === 'pending') {
                pendingItems.push(enrichedItem);
            } else if (item.status === 'ordered') {
                orderedItems.push(enrichedItem);
            } else if (item.status === 'arrived') {
                arrivedItems.push(enrichedItem);
            }
        });
    });

    document.getElementById('count-pending').textContent = pendingItems.length;
    document.getElementById('pending-list').innerHTML = generatePartsTable(pendingItems, 'pending');

    document.getElementById('count-ordered').textContent = orderedItems.length;
    document.getElementById('ordered-list').innerHTML = generatePartsTable(orderedItems, 'ordered');

    document.getElementById('count-arrived').textContent = arrivedItems.length;
    document.getElementById('arrived-list').innerHTML = generatePartsTable(arrivedItems, 'arrived');
}

function generatePartsTable(items, type) {
    if (items.length === 0) return '<div class="p-16 text-center text-secondary">該当する部品はありません</div>';

    return `
        <table class="detail-table" style="width:100%">
            <thead>
                <tr>
                    <th>部品名</th>
                    <th>価格</th>
                    <th>関連案件</th>
                    <th style="width: 150px;">操作</th>
                </tr>
            </thead>
            <tbody>
                ${items.map(item => `
                    <tr>
                        <td class="font-bold">${item.name}</td>
                        <td>${item.price ? '¥' + parseInt(item.price).toLocaleString() : '-'}</td>
                        <td>
                            <a href="#" class="text-accent hover:underline" onclick="navigateToTask('${item.taskId}')">
                                ${item.taskTitle}
                            </a>
                        </td>
                        <td>
                            ${type === 'pending'
            ? `<button class="btn btn-small btn-primary" onclick="updatePartStatus('${item.taskId}', ${item.itemIndex}, 'ordered')">発注済にする</button>`
            : type === 'ordered'
                ? `<button class="btn btn-small btn-success" onclick="updatePartStatus('${item.taskId}', ${item.itemIndex}, 'arrived')">入荷完了</button>`
                : `<button class="btn btn-small btn-secondary" onclick="updatePartStatus('${item.taskId}', ${item.itemIndex}, 'ordered')">発注済に戻す</button>`
        }
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

window.updatePartStatus = (taskId, itemIndex, newStatus) => {
    const task = appState.tasks.find(t => t.id === taskId);
    if (task && task.orderItems && task.orderItems[itemIndex]) {
        task.orderItems[itemIndex].status = newStatus;
        store.save('tasks', appState.tasks);

        showToast(newStatus === 'ordered' ? '発注済みにしました' : '入荷完了しました');
        renderPartsView(document.getElementById('view-container'));
    }
};

window.navigateToTask = (taskId) => {
    // A bit hacky: switch nav manually or just call render
    /* 
       Ideally app.js should handle navigation state, 
       but for now we can just trigger the detail view logic.
    */
    renderTaskDetail(document.getElementById('view-container'), taskId);
};
