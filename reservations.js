/**
 * Reservations View Logic
 */


function renderReservations(container) {
    const isAuth = googleCalendar.isAuthorized;

    container.innerHTML = `
        <div class="glass p-24 h-full flex flex-col">
            <div class="flex justify-between items-center mb-16">
                <div>
                    <h2>📅 予約管理 (Google Calendar)</h2>
                    <p id="gcal-status-text" class="text-small text-secondary mt-4">${isAuth ? '同期中' : 'Google同期未完了'}</p>
                </div>
                <div>
                    ${!isAuth ?
            `<button class="btn btn-primary" onclick="googleCalendar.handleAuthClick()">
                            <i class="fab fa-google"></i> Google認証
                        </button>` :
            `<span class="text-success mr-16">✅ 同期済み</span>
                        <button class="btn btn-secondary" onclick="showAddReservationModal()">+ 予約作成</button>
                        <button class="btn btn-small" onclick="googleCalendar.handleSignoutClick()">ログアウト</button>`
        }
                </div>
            </div>

            <div id="calendar" class="flex-1 bg-white rounded-lg p-4" style="min-height: 600px; color: #1e293b;">
                ${!isAuth ?
            `<div class="flex-center h-full text-secondary">
                    <div class="text-center">
                        <p class="mb-8">Googleカレンダーを表示するには認証が必要です</p>
                        <button class="btn btn-primary" onclick="googleCalendar.handleAuthClick()">Google認証</button>
                    </div>
                </div>` : ''}
            </div>
        </div>
    `;

    if (isAuth) {
        initFullCalendar();
    }
}

// Global update hook called by googleCalendar.js
window.updateGCalStatusUI = (isAuthorized) => {
    const el = document.getElementById('gcal-status-text');
    if (el) el.textContent = isAuthorized ? '同期中' : 'Google同期未完了';

    // Re-render to show/hide calendar
    if (appState.currentView === 'reservations') {
        const container = document.getElementById('view-container');
        if (container) renderReservations(container);
    }
};

function initFullCalendar() {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;

    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        locale: 'ja',
        height: '100%',
        navLinks: true, // can click day/week names to navigate views
        selectable: true,
        selectMirror: true,
        nowIndicator: true,

        // Fetch events from Google Calendar
        events: async function (info, successCallback, failureCallback) {
            try {
                const events = await googleCalendar.listEvents(info.start, info.end);
                // Map GCal events to FullCalendar format
                const fcEvents = events.map(e => ({
                    title: e.summary,
                    start: e.start.dateTime || e.start.date,
                    end: e.end.dateTime || e.end.date,
                    url: e.htmlLink,
                    backgroundColor: '#3b82f6',
                    borderColor: '#2563eb',
                    extendedProps: {
                        description: e.description
                    }
                }));
                successCallback(fcEvents);
            } catch (err) {
                failureCallback(err);
            }
        },

        eventClick: function (info) {
            info.jsEvent.preventDefault(); // Don't let browser visit the URL immediately
            if (info.event.url) {
                window.open(info.event.url);
            }
        },

        select: function (info) {
            // Pre-fill modal with selected dates
            showAddReservationModal(info.start, info.end);
        }
    });

    calendar.render();
}

function showAddReservationModal(start = null, end = null) {
    // Current date/time as default if not provided
    let startStr, endStr;

    if (start) {
        // Adjust for timezone offset if needed, or simple ISO slice
        // FullCalendar returns local Date objects usually
        const s = new Date(start);
        s.setMinutes(s.getMinutes() - s.getTimezoneOffset());
        startStr = s.toISOString().slice(0, 16);

        const e = end ? new Date(end) : new Date(s.getTime() + 60 * 60 * 1000);
        e.setMinutes(e.getMinutes() - e.getTimezoneOffset());
        endStr = e.toISOString().slice(0, 16);
    } else {
        const now = new Date();
        now.setMinutes(0, 0, 0);
        now.setHours(now.getHours() + 1);
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        startStr = now.toISOString().slice(0, 16);

        now.setHours(now.getHours() + 2);
        endStr = now.toISOString().slice(0, 16);
    }

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

        // Refresh calendar
        const calendarEl = document.getElementById('calendar');
        // If we kept a reference to 'calendar' instance properly we could call .refetchEvents()
        // But re-rendering the view is safer/easier to implement in this scope
        renderReservations(document.getElementById('view-container'));
    }
}
