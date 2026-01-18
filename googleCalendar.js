/**
 * Google Calendar API Integration
 * Handles Auth and Calendar API interactions
 */

const googleCalendar = {
    tokenClient: null,
    accessToken: null,
    isAuthorized: false,

    // Config loaded from LocalStorage
    getConfig() {
        return {
            clientId: localStorage.getItem('crm_google_client_id') || '',
            apiKey: localStorage.getItem('crm_google_api_key') || '',
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
            scopes: 'https://www.googleapis.com/auth/calendar'
        };
    },

    saveConfig(clientId, apiKey) {
        localStorage.setItem('crm_google_client_id', clientId);
        localStorage.setItem('crm_google_api_key', apiKey);
    },

    // Initialize the Google API client
    async initClient() {
        const config = this.getConfig();
        // Trim whitespace
        config.clientId = config.clientId.trim();
        config.apiKey = config.apiKey.trim();

        if (!config.clientId || !config.apiKey) {
            console.log('Google API Config missing');
            this.updateStatus('Client IDまたはAPI Keyが設定されていません');
            return false;
        }

        this.updateStatus('Google API: GAPI loading...');

        try {
            await new Promise((resolve, reject) => {
                gapi.load('client', { callback: resolve, onerror: reject });
            });

            this.updateStatus('Google API: Client Init...');

            // Create a timeout promise
            const initTimeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Initialization timed out (5s). Network or CORS issue suspected.')), 5000)
            );

            // Race gapi.client.init against timeout
            await Promise.race([
                gapi.client.init({
                    apiKey: config.apiKey,
                    discoveryDocs: config.discoveryDocs,
                }),
                initTimeout
            ]);

            this.updateStatus('Google API: Waiting for Identity...');

            // Wait for Identity Services (google.accounts.oauth2)
            await this.waitForGoogleIdentity();

            this.updateStatus('Google API: Token Client Init...');

            // Initialize Identity Services
            this.tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: config.clientId,
                scope: config.scopes,
                callback: (tokenResponse) => {
                    if (tokenResponse && tokenResponse.access_token) {
                        this.accessToken = tokenResponse.access_token;
                        this.isAuthorized = true;
                        this.updateStatus('Google認証完了');
                        console.log('Google Auth Success');
                        // Trigger UI update if needed
                        if (typeof updateGCalStatusUI === 'function') updateGCalStatusUI(true);
                        // Refresh calendar if view is active
                        if (appState.currentView === 'reservations') renderReservations(document.getElementById('view-container'));
                    }
                },
            });

            this.updateStatus('準備完了 - Google認証を行ってください');
            return true;
        } catch (err) {
            console.error('Error initializing Google API:', err);
            this.updateStatus('エラー: API初期化失敗', true);

            // More user-friendly error
            if (err.details) {
                alert(`Google API 初期化エラー: ${err.details}`);
            } else if (err.message) {
                alert(`Google API エラー: ${err.message}`);
            } else {
                alert('Google APIの初期化に失敗しました。Client IDとAPI Keyが正しいか、コンソールを確認してください。');
            }
            return false;
        }
    },

    loadGapi() {
        // Wrapper to ensure basic gapi is loaded with polling
        let attempts = 0;
        const checkGapi = setInterval(() => {
            if (typeof gapi !== 'undefined' && typeof google !== 'undefined') {
                clearInterval(checkGapi);
                this.initClient();
            } else {
                attempts++;
                if (attempts > 20) { // 10 seconds timeout
                    clearInterval(checkGapi);
                    console.error('Google API script timed out');
                    this.updateStatus('エラー: Google Scripts 読み込みタイムアウト', true);
                }
            }
        }, 500);
    },

    waitForGoogleIdentity() {
        return new Promise((resolve, reject) => {
            if (typeof google !== 'undefined' && google.accounts) {
                resolve();
                return;
            }
            let attempts = 0;
            const check = setInterval(() => {
                if (typeof google !== 'undefined' && google.accounts) {
                    clearInterval(check);
                    resolve();
                } else {
                    attempts++;
                    if (attempts > 20) {
                        clearInterval(check);
                        reject(new Error('Google Identity Services script not loaded'));
                    }
                }
            }, 200);
        });
    },

    statusListeners: [],

    updateStatus(message, isError = false) {
        this.currentStatus = { message, isError };
        console.log(`[GCal Status] ${message}`);
        this.statusListeners.forEach(cb => cb(message, isError));

        // Also update DOM element if it exists
        const el = document.getElementById('gcal-status-text');
        if (el) {
            el.textContent = message;
            el.className = isError ? 'text-danger' : 'text-secondary';
        }
    },

    handleAuthClick() {
        if (!this.tokenClient) {
            alert('Google APIが初期化されていません。\nステータス: ' + (this.currentStatus?.message || '不明'));
            return;
        }

        if (gapi.client.getToken() === null) {
            this.tokenClient.requestAccessToken({ prompt: 'consent' });
        } else {
            this.tokenClient.requestAccessToken({ prompt: '' });
        }
    },

    handleSignoutClick() {
        const token = gapi.client.getToken();
        if (token !== null) {
            google.accounts.oauth2.revoke(token.access_token);
            gapi.client.setToken('');
            this.accessToken = null;
            this.isAuthorized = false;
            this.updateStatus('ログアウトしました');
            if (typeof updateGCalStatusUI === 'function') updateGCalStatusUI(false);
            if (appState.currentView === 'reservations') renderReservations(document.getElementById('view-container'));
        }
    },

    // Calendar Operations
    async listUpcomingEvents(maxResults = 10) {
        if (!this.isAuthorized) return [];

        try {
            const response = await gapi.client.calendar.events.list({
                'calendarId': 'primary',
                'timeMin': (new Date()).toISOString(),
                'showDeleted': false,
                'singleEvents': true,
                'maxResults': maxResults,
                'orderBy': 'startTime'
            });
            return response.result.items;
        } catch (err) {
            console.error('Error fetching events:', err);
            return [];
        }
    },

    async addEvent(eventData) {
        if (!this.isAuthorized) {
            alert('Googleアカウントにログインしていません。');
            return null;
        }

        try {
            const event = {
                'summary': eventData.summary,
                'location': 'Highlander / Satoyama Bicycle Shop',
                'description': eventData.description,
                'start': {
                    'dateTime': eventData.start, // ISOString
                    'timeZone': 'Asia/Tokyo'
                },
                'end': {
                    'dateTime': eventData.end, // ISOString
                    'timeZone': 'Asia/Tokyo'
                }
            };

            const request = gapi.client.calendar.events.insert({
                'calendarId': 'primary',
                'resource': event
            });

            const response = await request;
            console.log('Event created:', response.result.htmlLink);
            return response.result;
        } catch (err) {
            console.error('Error adding event:', err);
            alert('予約の追加に失敗しました: ' + err.message);
            return null;
        }
    }
};
