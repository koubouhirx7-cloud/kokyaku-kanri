/**
 * CRM Configuration
 * 
 * Edit this file to persist your keys effectively.
 * This file is loaded before the application starts.
 */

const CRM_CONFIG = {
    // Supabase Configuration (Sync)
    supabase: {
        url: 'https://isoqzliuqtgobipilioh.supabase.co', // e.g.https://isoqzliuqtgobipilioh.supabase.co
        key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlzb3F6bGl1cXRnb2JpcGlsaW9oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNzE1ODMsImV4cCI6MjA4Mzk0NzU4M30.nKG60pQ0b90paMpwrNfhbB__RnlNxglvOtqmo3ztE8c'  // e.g. eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlzb3F6bGl1cXRnb2JpcGlsaW9oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNzE1ODMsImV4cCI6MjA4Mzk0NzU4M30.nKG60pQ0b90paMpwrNfhbB__RnlNxglvOtqmo3ztE8c
    },

    // Google Services
    google: {
        clientId: '', // e.g. xxxx.apps.googleusercontent.com
        apiKey: ''    // e.g. AIza...
    },

    // Public Form URL (for QR Code)
    publicUrl: '' // e.g. https://yourname.github.io/crm-form/
};
