// Debug Configuration Helper
// This file provides fallback configuration for development/debugging

if (typeof window.CONFIG === 'undefined') {
    console.warn('⚠️ Main config.js not found, using debug configuration');
    
    // Try to detect if we're in a Supabase environment
    const debugSupabaseUrl = 'https://your-project.supabase.co';
    
    window.CONFIG = {
        SUPABASE_URL: debugSupabaseUrl,
        SUPABASE_ANON_KEY: 'your-anon-key-here',
        APP_NAME: 'Employee Support Portal (Debug)',
        APP_VERSION: '1.0.0-debug',
        REFRESH_INTERVAL: 30000,
        DEBUG_MODE: 'true',
        
        // API Configuration (auto-generated)
        API_BASE_URL: debugSupabaseUrl + '/rest/v1',
        REALTIME_URL: debugSupabaseUrl.replace('https://', 'wss://') + '/realtime/v1',
        
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
    console.log('🔗 Current API URL:', window.CONFIG.API_BASE_URL);
    console.log('🔗 Current Realtime URL:', window.CONFIG.REALTIME_URL);
}
