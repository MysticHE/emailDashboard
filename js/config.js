// Debug Configuration Helper
// This file provides fallback configuration for development/debugging

if (typeof window.CONFIG === 'undefined') {
    console.warn('⚠️ Main config.js not found, using debug configuration');
    
    window.CONFIG = {
        SUPABASE_URL: 'https://bfrrhocucsdhyrufpeuw.supabase.co',
        SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmcnJob2N1Y3NkaHlydWZwZXV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg2MzU2NjIsImV4cCI6MjA1NDIxMTY2Mn0.P9nAucvnnagoaGJZkYZl9drmbGF0e0vuE1ItpPqr49k',
        APP_NAME: 'Employee Support Portal (Debug)',
        APP_VERSION: '1.0.0-debug',
        REFRESH_INTERVAL: 30000,
        DEBUG_MODE: 'true',
        
        // API Configuration
        API_BASE_URL: 'https://your-project.supabase.co/rest/v1',
        REALTIME_URL: 'wss://your-project.supabase.co/realtime/v1',
        
        // UI Configuration
        CHARTS_CONFIG: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { 
                    position: 'bottom' 
                }
            }
        },
        
        // Build Information
        BUILD_TIME: new Date().toISOString(),
        NODE_ENV: 'development'
    };
    
    console.log('🔧 Debug configuration loaded');
    console.log('📝 Please set proper environment variables in Render for production');
}
