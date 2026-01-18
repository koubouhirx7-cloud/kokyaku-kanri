/**
 * Reservations View Logic
 */

function renderReservations(container) {
    const isAuth = googleCalendar.isAuthorized;

    container.innerHTML = `
        <div class="glass p-24">
            <div class="flex justify-between items-center mb-24">
                <div>
                    <h2>📅 予約管理 (Google Calendar)</h2>
                    <p id="gcal-status-text" class="text-small text-secondary mt-4">初期化中...</p>
                </div>
                <div>
                    ${!isAuth ?
            `<button class="btn btn-primary" onclick="googleCalendar.handleAuthClick()">
                            <i class="fab fa-google"></i> Google認証
                        </button>` :
            `<span class="text-success mr-16">✅ 認証済み</span>
                        <button class="btn btn-secondary" onclick="showAddReservationModal()">+ 予約作成</button>
                        <button class="btn btn-small" onclick="googleCalendar.handleSignoutClick()">ログアウト</button>`
        }
                </div>
            </div>

            <div id="reservation-calendar-view">
                ${!isAuth ?
            `<div class="text-center p-24 text-secondary">
                        <p>Googleカレンダーと同期するには、右上のボタンからGoogle認証を行ってください。</p>
                        <p class="text-small mt-8">※設定画面でClient IDとAPI Keyが設定されている必要があります。</p>
                    </div>` :
            `<div class="loading-spinner">読み込み中...</div>`
        }
            </div>
        </div>
    `;

    if (isAuth) {
        loadReservations();
    }
}

async function loadReservations() {
    const listContainer = document.getElementById('reservation-calendar-view');
    const events = await googleCalendar.listUpcomingEvents(20);

    if (!events || events.length === 0) {
        listContainer.innerHTML = '<p class="text-center p-24 text-secondary">直近の予約はありません。</p>';
        return;
    }

    let html = '<div class="reservation-list">';
    html += events.map(event => {
        const start = new Date(event.start.dateTime || event.start.date);
        const end = new Date(event.end.dateTime || event.end.date);
        const dateStr = start.toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit', weekday: 'short' });
        const timeStr = start.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) + ' - ' +
            end.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

        return `
            <div class="glass p-16 mb-16 flex justify-between items-center" style="background:rgba(255,255,255,0.05);">
                <div>
                    <div class="text-primary font-bold text-lg">${event.summary}</div>
                    <div class="text-secondary"><i class="far fa-clock"></i> ${dateStr} ${timeStr}</div>
                    ${event.description ? `<div class="text-small text-secondary mt-4">${event.description}</div>` : ''}
                </div>
                <div>
                    <a href="${event.htmlLink}" target="_blank" class="btn btn-small btn-secondary">Googleで開く</a>
                </div>
            </div>
        `;
    }).join('');
    html += '</div>';

    listContainer.innerHTML = html;
}

function showAddReservationModal() {
    // Current date/time as default
    const now = new Date();
    // Round up to next hour
    now.setMinutes(0, 0, 0);
    now.setHours(now.getHours() + 1);
    const startStr = now.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm

    // Default duration 2 hours
    now.setHours(now.getHours() + 2);
    const endStr = now.toISOString().slice(0, 16);

    showModal('新規予約作成', `
        <form onsubmit="handleReservationSubmit(event)">
            <div class="form-group">
                <label>予約タイトル (内容など)</label>
                <input type="text" id="res-title" required class="glass-input" placeholder="例: ロードバイクレンタル">
            </div>

            <div class="form-group">
                <label>お客様名 (フルネーム)</label>
                <input type="text" id="res-customer-name" required class="glass-input" placeholder="例: 山田 太郎">
            </div>
            
            <div class="form-grid">
                <div class="form-group">
                    <label>開始日時</label>
                    <input type="datetime-local" id="res-start" required class="glass-input" value="${startStr}">
                </div>
                <div class="form-group">
                    <label>終了日時</label>
                    <input type="datetime-local" id="res-end" required class="glass-input" value="${endStr}">
                </div>
            </div>

            <div id="res-contact-fields" class="form-grid">
                <div class="form-group">
                    <label>電話番号</label>
                    <input type="tel" id="res-phone" class="glass-input" placeholder="090-0000-0000">
                </div>
                <div class="form-group">
                    <label>メールアドレス</label>
                    <input type="email" id="res-email" class="glass-input" placeholder="mail@example.com">
                </div>
            </div>

            <div class="form-group">
                <label>詳細・メモ</label>
                <textarea id="res-desc" class="glass-input" rows="3" placeholder="車種、身長、オプションなど"></textarea>
            </div>

            <div class="form-group">
                <label class="checkbox-label">
                    <input type="checkbox" id="res-sync-customer" checked>
                    <span>新規顧客としてリストにも追加する</span>
                </label>
            </div>
            
            <div class="flex justify-end mt-16">
                <button type="submit" class="btn btn-primary">予約を作成</button>
            </div>
        </form>
    `);
}

async function handleReservationSubmit(e) {
    e.preventDefault();

    const title = document.getElementById('res-title').value;
    const customerName = document.getElementById('res-customer-name').value;
    const start = document.getElementById('res-start').value;
    const end = document.getElementById('res-end').value;
    const desc = document.getElementById('res-desc').value;
    const phone = document.getElementById('res-phone').value;
    const email = document.getElementById('res-email').value;
    const syncCustomer = document.getElementById('res-sync-customer').checked;

    const startObj = new Date(start);
    const endObj = new Date(end);

    const fullTitle = `${customerName}様: ${title}`;

    const eventData = {
        summary: fullTitle,
        description: `お客様: ${customerName}\n電話: ${phone}\nEmail: ${email}\n\n${desc}` + (syncCustomer ? '\n[Created from CRM]' : ''),
        start: startObj.toISOString(),
        end: endObj.toISOString()
    };

    // 1. Add to Google Calendar
    const result = await googleCalendar.addEvent(eventData);

    if (result) {
        // 2. Sync to Customer List if checked
        if (syncCustomer) {
            const newCustomer = {
                id: Date.now().toString(),
                name: customerName,
                email: email,
                phone: phone,
                notes: `予約: ${startObj.toLocaleDateString()}\n${desc}`,
                bikes: [],
                maintenanceLogs: [],
                createdAt: new Date().toISOString()
            };

            appState.customers.push(newCustomer);
            store.save('customers', appState.customers);
            showToast('顧客リストに追加しました');
        }

        document.getElementById('modal-container').classList.add('hidden');
        showToast('予約を作成しました');
        loadReservations(); // Refresh list
    }
}
