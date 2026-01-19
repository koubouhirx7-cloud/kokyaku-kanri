/**
 * Customer Management Logic
 */

function renderCustomers(container) {
    container.innerHTML = `
        <div class="view-header">
            <h2>顧客一覧</h2>
            <div class="view-actions">
                <input type="text" id="customer-search" placeholder="顧客を検索..." class="glass-input">
            </div>
        </div>
        <div class="customer-list-container glass mt-24">
            <table class="customer-table">
                <thead>
                    <tr>
                        <th>名前</th>
                        <th>メール</th>
                        <th>電話番号</th>
                        <th>最終取引日</th>
                        <th>ステータス</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody id="customer-table-body">
                    ${renderCustomerRows()}
                </tbody>
            </table>
        </div>
    `;

    // Add event listeners for table
    attachCustomerListeners();
}

function renderCustomerRows() {
    if (appState.customers.length === 0) {
        return '<tr><td colspan="6" class="p-24 text-center">顧客データがありません</td></tr>';
    }
    return appState.customers.map(customer => renderCustomerRow(customer)).join('');
}

function renderCustomerRow(customer) {
    return `
        <tr>
            <td>
                <div class="customer-name-cell" onclick="viewCustomerDetails('${customer.id}')" style="cursor: pointer;">
                    <div class="avatar-small">${customer.name.charAt(0)}</div>
                    <span class="customer-link">${customer.name}</span>
                </div>
            </td>
            <td>${customer.email}</td>
            <td>${customer.phone}</td>
            <td>${customer.lastContact || '-'}</td>
            <td><span class="badge badge-active">アクティブ</span></td>
            <td>
                <button class="btn-icon" onclick="editCustomer('${customer.id}')">✏️</button>
                <button class="btn-icon" onclick="deleteCustomer('${customer.id}')">🗑️</button>
            </td>
        </tr>
    `;
}

function attachCustomerListeners() {
    const searchInput = document.getElementById('customer-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const filteredCustomers = appState.customers.filter(c =>
                c.name.toLowerCase().includes(query) ||
                c.email.toLowerCase().includes(query)
            );
            const body = document.getElementById('customer-table-body');
            if (filteredCustomers.length === 0) {
                body.innerHTML = '<tr><td colspan="6" class="p-24 text-center">顧客が見つかりません</td></tr>';
            } else {
                body.innerHTML = filteredCustomers.map(c => renderCustomerRow(c)).join('');
            }
        });
    }
}

function showAddCustomerModal() {
    showModal('新規顧客登録', `
        <form id="customer-form" class="modal-form">
            <div class="form-group">
                <label>お名前</label>
                <input type="text" name="name" required placeholder="山田 太郎">
            </div>
            <div class="form-group">
                <label>メールアドレス</label>
                <input type="email" name="email" required placeholder="example@mail.com">
            </div>
            <div class="form-group">
                <label>電話番号</label>
                <input type="tel" name="phone" placeholder="090-0000-0000">
            </div>
            <div class="form-group">
                <label>LINE ID / 連絡先URL</label>
                <input type="text" name="lineId" placeholder="IDを入力">
            </div>
            <div class="form-group">
                <label>メモ</label>
                <textarea name="notes" rows="3"></textarea>
            </div>
            <div class="form-footer">
                <button type="submit" class="btn btn-primary">登録する</button>
            </div>
        </form>
    `);

    document.getElementById('customer-form').onsubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const newCustomer = {
            id: Date.now().toString(),
            name: formData.get('name'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            lineId: formData.get('lineId'),
            notes: formData.get('notes'),
            bikes: [],
            maintenanceLogs: [],
            maintenanceLogs: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        appState.customers.push(newCustomer);
        store.save('customers', appState.customers);
        document.getElementById('modal-container').classList.add('hidden');
        renderCustomers(document.getElementById('view-container'));
    };
}

// Image Compression Utility
async function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // Config for resizing - REDUCED for LocalStorage
                const MAX_WIDTH = 800; // Reduced from 1000
                const MAX_HEIGHT = 800; // Reduced from 1000
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
                ctx.drawImage(img, 0, 0, width, height);

                // Compress to JPEG 0.5 quality (Reduced from 0.7)
                const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.5);
                resolve(compressedDataUrl);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}

function handleImageUpload(input, previewId) {
    const file = input.files[0];
    if (!file) return;

    const previewEl = document.getElementById(previewId);
    previewEl.innerHTML = '<span class="text-secondary">処理中...</span>';

    compressImage(file).then(dataUrl => {
        // Store in a data attribute temporarily or update the global object directly if feasible
        // Here we'll just update the visual and let the form submit handler grab the data.
        // ACTUALLY: Form submit is easier if we store it in a hidden input or data attrib.
        // Let's use the preview element's data-value attribute.
        previewEl.setAttribute('data-value', dataUrl);
        previewEl.innerHTML = `<img src="${dataUrl}" class="preview-thumb" onclick="event.stopPropagation(); window.expandImage(this.src)" /><button type="button" class="remove-img-btn" onclick="event.stopPropagation(); window.clearImage('${previewId}')">×</button>`;
    }).catch(err => {
        console.error(err);
        alert('画像の処理に失敗しました');
        previewEl.innerHTML = '<span class="text-danger">エラー</span>';
    });
}

window.clearImage = (previewId) => {
    const previewEl = document.getElementById(previewId);
    if (previewEl) {
        previewEl.removeAttribute('data-value');
        previewEl.innerHTML = '<span style="opacity:0.5">＋ 写真を追加</span>';
    }
    // Clear file input
    const inputId = previewId.replace('preview', 'input');
    const input = document.getElementById(inputId);
    if (input) input.value = '';
};

// Image Zoom Utility
window.expandImage = (src) => {
    let modal = document.getElementById('image-zoom-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'image-zoom-modal';
        modal.className = 'image-zoom-modal';
        // Close on click
        modal.onclick = () => {
            modal.style.display = 'none';
        };
        modal.innerHTML = '<img id="zoomed-image" />';
        document.body.appendChild(modal);
    }
    const img = modal.querySelector('img');
    img.src = src;
    modal.style.display = 'flex';
};

// Global scope functions for buttons
window.editCustomer = (id) => {
    const customer = appState.customers.find(c => c.id === id);
    if (!customer) return;

    showModal('顧客情報の編集', `
        <form id="edit-customer-form" class="modal-form">
            <div class="form-group">
                <label>お名前</label>
                <input type="text" name="name" value="${customer.name}" required>
            </div>
            <div class="form-group">
                <label>メールアドレス</label>
                <input type="email" name="email" value="${customer.email}" required>
            </div>
            <div class="form-group">
                <label>電話番号</label>
                <input type="tel" name="phone" value="${customer.phone || ''}">
            </div>
            <div class="form-footer">
                <button type="submit" class="btn btn-primary">保存する</button>
            </div>
        </form>
    `);

    document.getElementById('edit-customer-form').onsubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const index = appState.customers.findIndex(c => c.id === id);
        appState.customers[index] = {
            ...customer,
            ...Object.fromEntries(formData),
            updatedAt: new Date().toISOString()
        };
        store.save('customers', appState.customers);
        document.getElementById('modal-container').classList.add('hidden');
        renderCustomers(document.getElementById('view-container'));
    };
};

window.deleteCustomer = (id) => {
    if (confirm('この顧客情報を削除してもよろしいですか？')) {
        appState.customers = appState.customers.filter(c => c.id !== id);
        store.save('customers', appState.customers);
        store.delete('customers', id);
        renderCustomers(document.getElementById('view-container'));
    }
};

window.viewCustomerDetails = (id) => {
    const customer = appState.customers.find(c => c.id === id);
    if (!customer) return;

    const customerTasks = appState.tasks.filter(t => t.customerId === id);
    const tasksHtml = customerTasks.length > 0
        ? customerTasks.map(t => `
            <div class="mini-task-card">
                <span class="status-dot ${t.status}"></span>
                <span class="task-title">${t.title}</span>
                <span class="task-date">${t.dueDate || ''}</span>
            </div>
        `).join('')
        : '<p class="text-secondary">関連するタスクはありません</p>';

    const bikesHtml = (customer.bikes || []).length > 0
        ? customer.bikes.map(b => `
            <div class="bike-card-mini" onclick="showEditBikeForm('${customer.id}', '${b.id}')" style="cursor: pointer;">
                <div style="display:flex; justify-content:space-between;">
                    <span class="bike-model">${b.model}</span>
                    <span class="badge ${b.regType ? 'badge-active' : ''}">${b.regType || '未登録'}</span>
                </div>
                <div class="bike-serial">防犯登録: ${b.regNo || '-'} / 車体: ${b.frameNo || '-'}</div>
            </div>
        `).join('')
        : '<p class="text-secondary">自転車情報がありません</p>';

    const logsHtml = (customer.maintenanceLogs || []).length > 0
        ? customer.maintenanceLogs.map(l => `
            <div class="log-item">
                <div class="log-date">${l.date}</div>
                <div class="log-work">${l.work}</div>
                <div class="log-notes">${l.notes || ''}</div>
            </div>
        `).join('')
        : '<p class="text-secondary">整備記録はありません</p>';

    showModal('顧客詳細', `
        <div class="customer-details-container">
            <div class="detail-header">
                <h3>${customer.name} 様</h3>
                ${customer.lineId ? `<button class="btn btn-line" onclick="window.open('https://line.me/ti/p/~${customer.lineId}', '_blank')">LINEで連絡</button>` : ''}
            </div>
            
            <div class="detail-tabs">
                <button class="tab-btn active" onclick="switchDetailTab(this, 'info')">基本情報</button>
                <button class="tab-btn" onclick="switchDetailTab(this, 'bikes')">自転車・整備</button>
                <button class="tab-btn" onclick="switchDetailTab(this, 'tasks')">タスク</button>
            </div>

            <div id="detail-tab-content">
                <div id="tab-info" class="tab-pane active">
                    <div class="detail-section">
                        <h4>プロフィール</h4>
                        <p><strong>メール:</strong> ${customer.email}</p>
                        <p><strong>電話:</strong> ${customer.phone || '-'}</p>
                        <p><strong>LINE ID:</strong> ${customer.lineId || '-'}</p>
                    </div>
                    <div class="detail-section mt-16">
                        <h4>メモ</h4>
                        <div class="notes-box">${customer.notes || 'メモなし'}</div>
                    </div>
                </div>

                <div id="tab-bikes" class="tab-pane">
                    <div class="detail-section">
                        <h4>保有自転車</h4>
                        <div class="bikes-list">${bikesHtml}</div>
                        <button class="btn btn-small mt-8" onclick="showAddBikeForm('${customer.id}')">+ 自転車を追加</button>
                    </div>
                    <div class="detail-section mt-16">
                        <h4>整備記録</h4>
                        <div class="logs-list">${logsHtml}</div>
                        <button class="btn btn-small mt-8" onclick="showAddMaintenanceForm('${customer.id}')">+ 整備記録を追加</button>
                    </div>
                </div>

                <div id="tab-tasks" class="tab-pane">
                    <div class="mini-task-list">${tasksHtml}</div>
                </div>
            </div>
        </div>
    `);
};

window.switchDetailTab = (btn, tabId) => {
    const parent = btn.closest('.customer-details-container');
    parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    parent.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

    btn.classList.add('active');
    document.getElementById(`tab-${tabId}`).classList.add('active');
};

window.showAddBikeForm = (customerId) => {
    renderBikeForm(customerId, null);
};

window.showEditBikeForm = (customerId, bikeId) => {
    const customer = appState.customers.find(c => c.id === customerId);
    const bike = customer.bikes.find(b => b.id === bikeId);
    renderBikeForm(customerId, bike);
};

function renderBikeForm(customerId, bike) {
    const isEdit = !!bike;
    const pane = document.getElementById('tab-bikes');
    const originalContent = pane.innerHTML;

    // Default values
    const data = bike || {
        model: '',
        frameNo: '',
        regType: '',
        bikeType: '',
        keyNo: '',
        manufacturerNo: '',
        otherCode: '',
        deliverySchedule: '',
        deliveryDate: '',
        price: '',
        year: '',
        tsMark: '',
        notes: ''
    };

    pane.innerHTML = `
        <h4>${isEdit ? '自転車情報の編集' : '新規自転車登録'}</h4>
        <h4>${isEdit ? '自転車情報の編集' : '新規自転車登録'}</h4>
        <form id="bike-form" class="modal-form">
            <div style="text-align: right; margin-bottom: 16px;">
                <button type="submit" class="btn btn-primary btn-small">変更を保存</button>
            </div>
            <div class="form-grid">
                <div class="form-group">
                    <label>登録種別</label>
                    <select name="regType" class="glass-select">
                        <option value="" disabled ${!data.regType ? 'selected' : ''}>選択してください</option>
                        <option value="防犯登録" ${data.regType === '防犯登録' ? 'selected' : ''}>防犯登録</option>
                        <option value="TSマーク" ${data.regType === 'TSマーク' ? 'selected' : ''}>TSマーク</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label>車種 (MTB等)</label>
                    <select name="bikeType" class="glass-select">
                         <option value="" disabled ${!data.bikeType ? 'selected' : ''}>選択してください</option>
                         <option value="ロードバイク" ${data.bikeType === 'ロードバイク' ? 'selected' : ''}>ロードバイク</option>
                         <option value="クロスバイク" ${data.bikeType === 'クロスバイク' ? 'selected' : ''}>クロスバイク</option>
                         <option value="MTB" ${data.bikeType === 'MTB' ? 'selected' : ''}>MTB</option>
                         <option value="一般車" ${data.bikeType === '一般車' ? 'selected' : ''}>一般車</option>
                         <option value="その他" ${data.bikeType === 'その他' ? 'selected' : ''}>その他</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>キーナンバー</label>
                    <input type="text" name="keyNo" value="${data.keyNo || ''}">
                </div>

                <div class="form-group">
                    <label>メーカー番号</label>
                    <input type="text" name="manufacturerNo" value="${data.manufacturerNo || ''}">
                </div>

                <div class="form-group">
                     <label>その他コード</label>
                     <input type="text" name="otherCode" value="${data.otherCode || ''}">
                </div>

                <div class="form-group form-full">
                    <label>モデル名</label>
                    <input type="text" name="model" value="${data.model}" required>
                </div>

                <div class="form-group">
                    <label>納車予定日</label>
                    <input type="date" name="deliverySchedule" value="${data.deliverySchedule || ''}">
                </div>

                <div class="form-group">
                    <label>納車日</label>
                    <input type="date" name="deliveryDate" value="${data.deliveryDate || ''}">
                </div>

                <div class="form-group">
                    <label>販売価格(数字)</label>
                    <input type="number" name="price" value="${data.price || ''}">
                </div>

                <div class="form-group">
                    <label>価格帯(選択式)</label>
                    <select name="priceRange" class="glass-select" disabled>
                        <option>使用しない</option>
                    </select>
                </div>

                 <div class="form-group">
                    <label>年式</label>
                    <select name="year" class="glass-select">
                        <option value="">選択してください</option>
                        ${generateYearOptions(data.year)}
                    </select>
                </div>

                 <div class="form-group">
                    <label>TSマーク</label>
                    <select name="tsMark" class="glass-select">
                         <option value="" disabled ${!data.tsMark ? 'selected' : ''}>選択してください</option>
                         <option value="加入" ${data.tsMark === '加入' ? 'selected' : ''}>加入</option>
                         <option value="未加入" ${data.tsMark === '未加入' ? 'selected' : ''}>未加入</option>
                    </select>
                </div>
                
                 <div class="form-group">
                    <label>防犯登録番号 (旧車体番号)</label>
                    <input type="text" name="frameNo" value="${data.frameNo || ''}">
                </div>
            </div>

            <!-- Photos -->
            <div class="mt-16">
                <label>購入証明、レシート写真</label>
                <input type="file" id="receipt-input" accept="image/*" style="display:none" onchange="window.handleImageUpload(this, 'receipt-preview')">
                <div class="file-upload-box" id="receipt-preview" onclick="document.getElementById('receipt-input').click()" data-value="${data.receiptPhoto || ''}">
                   ${data.receiptPhoto ? `<img src="${data.receiptPhoto}" class="preview-thumb" onclick="event.stopPropagation(); window.expandImage(this.src)" /><button type="button" class="remove-img-btn" onclick="event.stopPropagation(); window.clearImage('receipt-preview')">×</button>` : '<span style="opacity:0.5">＋ 写真を追加</span>'}
                </div>
            </div>
             <div class="mt-8">
                <label>防犯写真</label>
                <input type="file" id="security-input" accept="image/*" style="display:none" onchange="window.handleImageUpload(this, 'security-preview')">
                <div class="file-upload-box" id="security-preview" onclick="document.getElementById('security-input').click()" data-value="${data.securityPhoto || ''}">
                   ${data.securityPhoto ? `<img src="${data.securityPhoto}" class="preview-thumb" onclick="event.stopPropagation(); window.expandImage(this.src)" /><button type="button" class="remove-img-btn" onclick="event.stopPropagation(); window.clearImage('security-preview')">×</button>` : '<span style="opacity:0.5">＋ 写真を追加</span>'}
                </div>
            </div>
             <div class="mt-8">
                <label>車体写真</label>
                <input type="file" id="body-input" accept="image/*" style="display:none" onchange="window.handleImageUpload(this, 'body-preview')">
                <div class="file-upload-box" id="body-preview" onclick="document.getElementById('body-input').click()" data-value="${data.bodyPhoto || ''}">
                   ${data.bodyPhoto ? `<img src="${data.bodyPhoto}" class="preview-thumb" onclick="event.stopPropagation(); window.expandImage(this.src)" /><button type="button" class="remove-img-btn" onclick="event.stopPropagation(); window.clearImage('body-preview')">×</button>` : '<span style="opacity:0.5">＋ 写真を追加</span>'}
                </div>
            </div>

            <div class="form-group mt-16">
                <label>追加メモ</label>
                <textarea name="notes" rows="2">${data.notes || ''}</textarea>
            </div>

            <div class="form-footer">
                <button type="button" class="btn btn-secondary" id="cancel-bike">キャンセル</button>
                <button type="submit" class="btn btn-primary">変更を保存</button>
            </div>
        </form>
    `;

    document.getElementById('cancel-bike').onclick = () => {
        pane.innerHTML = originalContent;
    };

    document.getElementById('bike-form').onsubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const customer = appState.customers.find(c => c.id === customerId);
        if (!customer.bikes) customer.bikes = [];

        const bikeData = {
            id: isEdit ? bike.id : Date.now().toString(),
            model: formData.get('model'),
            frameNo: formData.get('frameNo'),
            regType: formData.get('regType'),
            bikeType: formData.get('bikeType'),
            keyNo: formData.get('keyNo'),
            manufacturerNo: formData.get('manufacturerNo'),
            otherCode: formData.get('otherCode'),
            deliverySchedule: formData.get('deliverySchedule'),
            deliveryDate: formData.get('deliveryDate'),
            price: formData.get('price'),
            year: formData.get('year'),
            tsMark: formData.get('tsMark'),
            notes: formData.get('notes'),
            // Get photos from data attributes
            receiptPhoto: document.getElementById('receipt-preview').getAttribute('data-value') || '',
            securityPhoto: document.getElementById('security-preview').getAttribute('data-value') || '',
            bodyPhoto: document.getElementById('body-preview').getAttribute('data-value') || ''
        };

        if (isEdit) {
            const index = customer.bikes.findIndex(b => b.id === bikeId);
            customer.bikes[index] = bikeData;
        } else {
            customer.bikes.push(bikeData);
        }

        console.log('Saving bike data:', bikeData);
        // Update customer timestamp
        customer.updatedAt = new Date().toISOString();
        store.save('customers', appState.customers);
        alert('変更を保存しました！'); // EXPLICIT FEEDBACK
        window.viewCustomerDetails(customerId); // Refresh modal
        setTimeout(() => window.switchDetailTab(document.querySelectorAll('.tab-btn')[1], 'bikes'), 50);
    };
}

function generateYearOptions(selected) {
    let options = '';
    const currentYear = new Date().getFullYear();
    for (let i = currentYear + 1; i >= 2000; i--) {
        options += `<option value="${i}" ${selected == i ? 'selected' : ''}>${i}</option>`;
    }
    return options;
}

window.showAddMaintenanceForm = (customerId) => {
    const customer = appState.customers.find(c => c.id === customerId);
    const bikeOptions = (customer.bikes || []).map(b => `<option value="${b.id}">${b.model}</option>`).join('');
    const pane = document.getElementById('tab-bikes');
    const originalContent = pane.innerHTML;

    pane.innerHTML = `
        <h4>整備記録の追加</h4>
        <form id="add-logs-form" class="modal-form">
            <select name="bikeId" class="glass-select">
                <option value="">対象の自転車を選択...</option>
                ${bikeOptions}
            </select>
            <input type="date" name="date" value="${new Date().toISOString().split('T')[0]}" class="mt-8" required>
            <input type="text" name="work" placeholder="作業内容 (例: タイヤ交換)" class="mt-8" required>
            <textarea name="notes" placeholder="詳細備考" class="mt-8" rows="2"></textarea>
            <div class="form-footer">
                <button type="button" class="btn btn-secondary" id="cancel-logs">キャンセル</button>
                <button type="submit" class="btn btn-primary">記録する</button>
            </div>
        </form>
    `;

    document.getElementById('cancel-logs').onclick = () => {
        pane.innerHTML = originalContent;
    };

    document.getElementById('add-logs-form').onsubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        if (!customer.maintenanceLogs) customer.maintenanceLogs = [];

        customer.maintenanceLogs.push({
            id: Date.now().toString(),
            bikeId: formData.get('bikeId'),
            date: formData.get('date'),
            notes: formData.get('notes')
        });

        customer.updatedAt = new Date().toISOString();
        store.save('customers', appState.customers);
        window.viewCustomerDetails(customerId); // Refresh modal
        setTimeout(() => window.switchDetailTab(document.querySelectorAll('.tab-btn')[1], 'bikes'), 50);
    };
};

// Injection of Customer-specific styles
const customerCSS = `
.view-header { display: flex; justify-content: space-between; align-items: center; }
.glass-input { 
    background: rgba(255, 255, 255, 0.05); 
    border: 1px solid var(--border-color); 
    border-radius: 8px; 
    padding: 8px 16px; 
    color: white; 
    outline: none; 
}
.customer-table { width: 100%; border-collapse: collapse; }
.customer-table th { text-align: left; padding: 16px; color: var(--text-secondary); font-weight: 400; font-size: 0.875rem; border-bottom: 1px solid var(--border-color); }
.customer-table td { padding: 16px; border-bottom: 1px solid var(--border-color); vertical-align: middle; }
.customer-name-cell { display: flex; align-items: center; gap: 12px; }
.avatar-small { width: 28px; height: 28px; background: var(--accent-gradient); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: bold; }
.badge { padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; }
.badge-active { background: rgba(16, 185, 129, 0.2); color: var(--success); }
.btn-icon { background: none; border: none; cursor: pointer; font-size: 1.1rem; padding: 4px; border-radius: 4px; transition: background 0.2s; }
.btn-icon:hover { background: rgba(255, 255, 255, 0.1); }
.modal-form .form-group { margin-bottom: 20px; }
.modal-form label { display: block; margin-bottom: 8px; font-size: 0.875rem; color: var(--text-secondary); }
.modal-form input, .modal-form textarea { width: 100%; padding: 10px; border-radius: 8px; background: rgba(0, 0, 0, 0.2); border: 1px solid var(--border-color); color: white; outline: none; }
.form-footer { margin-top: 24px; text-align: right; }
.customer-link { color: var(--accent-light); text-decoration: none; }
.customer-link:hover { text-decoration: underline; }
.detail-section h4 { font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 8px; border-bottom: 1px solid var(--border-color); padding-bottom: 4px; }
.notes-box { padding: 12px; background: rgba(0,0,0,0.2); border-radius: 8px; font-size: 0.9rem; }
.mini-task-card { display: flex; align-items: center; gap: 10px; padding: 8px; border-bottom: 1px solid var(--border-color); font-size: 0.85rem; }
.mini-task-list { max-height: 200px; overflow-y: auto; }
.mt-16 { margin-top: 16px; }
`;

const customerStyleSheet = document.createElement("style");
customerStyleSheet.innerText = customerCSS;
document.head.appendChild(customerStyleSheet);
