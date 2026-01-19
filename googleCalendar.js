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
        // Fallback to global CRM_CONFIG if localStorage is empty
        const configClientId = typeof CRM_CONFIG !== 'undefined' && CRM_CONFIG.google ? CRM_CONFIG.google.clientId : '';
        const configApiKey = typeof CRM_CONFIG !== 'undefined' && CRM_CONFIG.google ? CRM_CONFIG.google.apiKey : '';

        return {
            clientId: localStorage.getItem('crm_google_client_id') || configClientId || '',
            apiKey: localStorage.getItem('crm_google_api_key') || configApiKey || '',
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
                        // Save token with expiration (default 1 hour = 3600s)
                        const expiresAt = Date.now() + (tokenResponse.expires_in || 3599) * 1000;
                        localStorage.setItem('crm_gcal_token', this.accessToken);
                        localStorage.setItem('crm_gcal_expires', expiresAt);

                        this.isAuthorized = true;
                        this.updateStatus('Google認証完了');
                        // Trigger UI update if needed
                        if (typeof updateGCalStatusUI === 'function') updateGCalStatusUI(true);
                        // Refresh calendar if view is active
                        if (appState.currentView === 'reservations') renderReservations(document.getElementById('view-container'));
                    }
                },
            });

            // Try to restore token from localStorage
            this.restoreToken();

            this.updateStatus('準備完了');
            return true;
        } catch (err) {
            console.error('Error initializing Google API:', err);
            this.updateStatus('エラー: API初期化失敗', true);
            // ... (alert logic)
            return false;
        }
    },

    restoreToken() {
        const token = localStorage.getItem('crm_gcal_token');
        const expires = localStorage.getItem('crm_gcal_expires');

        if (token && expires) {
            if (Date.now() < parseInt(expires)) {
                console.log('Restoring valid Google Token');
                this.accessToken = token;
                gapi.client.setToken({ access_token: token });
                this.isAuthorized = true;
                this.updateStatus('Google認証済み (復元)');
                if (typeof updateGCalStatusUI === 'function') setTimeout(() => updateGCalStatusUI(true), 1000);
            } else {
                console.log('Google Token expired');
                localStorage.removeItem('crm_gcal_token');
                localStorage.removeItem('crm_gcal_expires');
            }
        }
    },

    loadGapi() {
        // ... (existing loadGapi logic)
        let attempts = 0;
        const checkGapi = setInterval(() => {
            if (typeof gapi !== 'undefined' && typeof google !== 'undefined') {
                clearInterval(checkGapi);
                this.initClient();
            } else {
                attempts++;
                if (attempts > 20) {
                    clearInterval(checkGapi);
                    console.error('Google API script timed out');
                    this.updateStatus('エラー: Google Scripts 読み込みタイムアウト', true);
                }
            }
        }, 500);
    },

    // ... (waitForGoogleIdentity, updateStatus, handleAuthClick logic remains)

    handleSignoutClick() {
        const token = gapi.client.getToken();
        if (token !== null) {
            google.accounts.oauth2.revoke(token.access_token);
            gapi.client.setToken('');
            this.accessToken = null;
            this.isAuthorized = false;
            // Clear storage
            localStorage.removeItem('crm_gcal_token');
            localStorage.removeItem('crm_gcal_expires');

            this.updateStatus('ログアウトしました');
            if (typeof updateGCalStatusUI === 'function') updateGCalStatusUI(false);
            if (appState.currentView === 'reservations') renderReservations(document.getElementById('view-container'));
        }
    },

    // Calendar Operations
    async listEvents(timeMin, timeMax) {
        if (!this.isAuthorized) return [];

        try {
            const params = {
                'calendarId': 'primary',
                'timeMin': timeMin.toISOString(),
                'showDeleted': false,
                'singleEvents': true,
                'orderBy': 'startTime'
            };
            if (timeMax) {
                params.timeMax = timeMax.toISOString();
            } else {
                params.maxResults = 20; // Default limit if no end date
            }

            const response = await gapi.client.calendar.events.list(params);
            return response.result.items;
        } catch (err) {
            console.error('Error fetching events:', err);
            if (err.status === 401) {
                // Token invalid
                this.handleSignoutClick();
                alert('Google認証の有効期限が切れました。再度ログインしてください。');
            }
            return [];
        }
    },

    // Legacy support alias
    async listUpcomingEvents(maxResults = 10) {
        return this.listEvents(new Date(), null);
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
}
};

// Ensure global scope access
window.googleCalendar = googleCalendar;
