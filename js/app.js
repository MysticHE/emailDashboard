/**
 * Employee Support Portal - Main Application
 * Initializes the application and manages global state
 */

class SupportPortalApp {
    constructor() {
        this.supabase = null;
        this.currentAgent = null;
        this.refreshInterval = null;
        this.charts = {};
        this.isLoading = false;
    }

    async init() {
        try {
            this.showLoading();
            this.initializeUI();
            this.validateConfiguration();
            this.initSupabase();
            await this.loadCurrentAgent();
            await this.loadDashboardData();
            this.setupRealTimeUpdates();
            this.setupAutoRefresh();
            this.setupEventListeners();
            showSection('dashboard'); // Call global function, not class method
            this.hideLoading();
            
            if (window.CONFIG.DEBUG_MODE === 'true') {
                console.log('✅ Application initialized successfully');
            }
        } catch (error) {
            console.error('❌ Application initialization failed:', error);
            this.showError('Failed to initialize application. Please check your configuration and try again.');
            this.hideLoading();
        }
    }

    initializeUI() {
        // Set app name and version
        document.getElementById('appName').textContent = window.CONFIG.APP_NAME;
        document.getElementById('appVersion').textContent = `v${window.CONFIG.APP_VERSION}`;
        
        // Set page title
        document.title = window.CONFIG.APP_NAME;
    }

    validateConfiguration() {
        if (!window.CONFIG) {
            throw new Error('Configuration not loaded. Please check if config.js is properly generated.');
        }

        const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
        const missing = required.filter(key => 
            !window.CONFIG[key] || 
            window.CONFIG[key].includes('your-') || 
            window.CONFIG[key] === 'your-anon-key-here'
        );

        if (missing.length > 0) {
            console.warn('⚠️ Missing configuration values:', missing);
            if (window.CONFIG.NODE_ENV === 'production') {
                throw new Error(`Missing required configuration: ${missing.join(', ')}`);
            }
        }
    }

    initSupabase() {
        if (!window.supabase) {
            throw new Error('Supabase client not loaded. Please check if the Supabase script is included.');
        }

        this.supabase = window.supabase.createClient(
            window.CONFIG.SUPABASE_URL,
            window.CONFIG.SUPABASE_ANON_KEY
        );

        if (window.CONFIG.DEBUG_MODE === 'true') {
            console.log('🔗 Supabase client initialized');
        }
    }

    async loadCurrentAgent() {
        try {
            // For demo purposes, we'll use the first available agent
            // In production, this would be based on authentication
            const { data: agents, error } = await this.supabase
                .from('agents')
                .select('*')
                .eq('status', 'available')
                .limit(1);
            
            if (error) throw error;
            
            if (agents && agents.length > 0) {
                this.currentAgent = agents[0];
                document.getElementById('currentAgent').textContent = this.currentAgent.name;
                this.updateAgentStatus(this.currentAgent.status);
            } else {
                document.getElementById('currentAgent').textContent = 'No Agent';
                this.updateAgentStatus('offline');
            }
        } catch (error) {
            console.error('Error loading current agent:', error);
            document.getElementById('currentAgent').textContent = 'Error';
            this.updateAgentStatus('offline');
        }
    }

    updateAgentStatus(status) {
        const indicator = document.getElementById('statusIndicator');
        const text = document.getElementById('statusText');
        
        const statusConfig = {
            'available': { color: 'bg-green-500', text: 'Available' },
            'busy': { color: 'bg-yellow-500', text: 'Busy' },
            'break': { color: 'bg-orange-500', text: 'On Break' },
            'offline': { color: 'bg-gray-500', text: 'Offline' }
        };
        
        const config = statusConfig[status] || statusConfig['available'];
        indicator.className = `w-3 h-3 ${config.color} rounded-full`;
        text.textContent = config.text;
    }

    async loadDashboardData() {
        if (this.isLoading) return;
        
        try {
            this.isLoading = true;
            this.showLoading();
            
            await Promise.all([
                this.loadTeamOverview(),
                this.loadAgentPerformance(),
                this.loadRecentCases(),
                this.updateDashboardCharts()
            ]);
            
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            this.showError('Failed to load dashboard data');
        } finally {
            this.isLoading = false;
            this.hideLoading();
        }
    }

    async loadTeamOverview() {
        try {
            const { data, error } = await this.supabase
                .from('team_overview')
                .select('*')
                .single();
            
            if (error) {
                // If view doesn't exist, calculate manually
                console.warn('team_overview view not found, calculating manually');
                return this.calculateTeamOverviewManually();
            }
            
            this.updateTeamMetrics(data);
            this.checkPriorityAlerts(data);
            
        } catch (error) {
            console.error('Error loading team overview:', error);
            // Fallback to manual calculation
            await this.calculateTeamOverviewManually();
        }
    }

    async calculateTeamOverviewManually() {
    try {
        console.log('🔄 Starting manual team overview calculation...');
        
        const { data: cases, error } = await this.supabase
            .from('cases')
            .select('*');
            
        if (error) {
            console.error('❌ Supabase query error:', error);
            throw error;
        }
        
        console.log(`📊 Retrieved ${cases ? cases.length : 0} cases from Supabase`);
        
        if (!cases || cases.length === 0) {
            console.warn('⚠️ No cases found in database');
            const emptyMetrics = {
                total_cases: 0,
                total_resolved: 0,
                total_pending: 0,
                pending_breakdown: {vip: 0, urgent: 0, normal: 0, low: 0},
                team_avg_response_time: 0
            };
            this.updateTeamMetrics(emptyMetrics);
            this.checkPriorityAlerts(emptyMetrics);
            return;
        }
        
        // Log sample case for debugging
        console.log('📝 Sample case structure:', cases[0]);
        
        // FIXED: Total cases and resolved calculation
        const totalCases = cases.length;
        const resolvedStatuses = ['resolved', 'closed'];
        const totalResolvedCases = cases.filter(c => 
            c.status && resolvedStatuses.includes(c.status.toLowerCase())
        ).length;
        
        console.log(`📈 Total cases: ${totalCases}`);
        console.log(`✅ Resolved cases: ${totalResolvedCases}`);
        
        // FIXED: Pending cases calculation 
        const pendingCases = cases.filter(c => 
            c.status && !resolvedStatuses.includes(c.status.toLowerCase())
        );
        
        console.log(`⏳ Pending cases: ${pendingCases.length}`);
        
        // FIXED: Priority breakdown with better error handling
        const pendingBreakdown = {
            vip: 0,
            urgent: 0,
            normal: 0,
            low: 0
        };
        
        pendingCases.forEach(c => {
            if (c.priority) {
                const priority = c.priority.toLowerCase();
                if (pendingBreakdown.hasOwnProperty(priority)) {
                    pendingBreakdown[priority]++;
                } else {
                    console.warn(`⚠️ Unknown priority found: ${c.priority}`);
                }
            } else {
                console.warn('⚠️ Case without priority found:', c.id);
            }
        });
        
        console.log('📊 Pending breakdown:', pendingBreakdown);
        
        // FIXED: Team average response time calculation
        const casesWithResponseTime = cases.filter(c => 
            c.response_time_minutes && 
            typeof c.response_time_minutes === 'number' && 
            c.response_time_minutes > 0
        );
        
        let teamAvgResponseTime = 0;
        if (casesWithResponseTime.length > 0) {
            const totalResponseTime = casesWithResponseTime.reduce((sum, c) => 
                sum + c.response_time_minutes, 0
            );
            teamAvgResponseTime = Math.round(totalResponseTime / casesWithResponseTime.length);
        }
        
        console.log(`⏱️ Cases with response time: ${casesWithResponseTime.length}`);
        console.log(`⏱️ Average response time: ${teamAvgResponseTime} minutes`);
        
        const metrics = {
            total_cases: totalCases,
            total_resolved: totalResolvedCases,
            total_pending: pendingCases.length,
            pending_breakdown: pendingBreakdown,
            team_avg_response_time: teamAvgResponseTime
        };
        
        console.log('✅ Final metrics:', metrics);
        
        this.updateTeamMetrics(metrics);
        this.checkPriorityAlerts(metrics);
        
    } catch (error) {
        console.error('❌ Error calculating team overview:', error);
        showNotification('Failed to load dashboard metrics. Check console for details.', 'error');
        
        // Show error state in metrics
        this.updateTeamMetrics({
            total_cases: 0,
            total_resolved: 0,
            total_pending: 0,
            pending_breakdown: {vip: 0, urgent: 0, normal: 0, low: 0},
            team_avg_response_time: 0
        });
    }
}

    calculateAverageResponseTime(cases) {
    const casesWithResponse = cases.filter(c => 
        c.created_at && c.first_response_at && c.response_time_minutes && c.response_time_minutes > 0
    );
    
    if (casesWithResponse.length === 0) return 0;
    
    const total = casesWithResponse.reduce((sum, c) => sum + c.response_time_minutes, 0);
    return Math.round(total / casesWithResponse.length);
}

    updateTeamMetrics(data) {
    try {
        console.log('🔄 Updating team metrics with data:', data);
        
        // FIXED: Total Cases Resolved (with error handling)
        const totalResolvedEl = document.getElementById('totalResolved');
        if (totalResolvedEl) {
            const displayText = `${data.total_resolved || 0}/${data.total_cases || 0}`;
            totalResolvedEl.textContent = displayText;
            console.log(`✅ Updated totalResolved: ${displayText}`);
        } else {
            console.error('❌ Element #totalResolved not found');
        }
        
        // FIXED: Pending Cases (with error handling)
        const pendingCasesEl = document.getElementById('pendingCases');
        if (pendingCasesEl) {
            const pendingCount = data.total_pending || 0;
            pendingCasesEl.textContent = pendingCount.toString();
            console.log(`✅ Updated pendingCases: ${pendingCount}`);
        } else {
            console.error('❌ Element #pendingCases not found');
        }
        
        // FIXED: Pending Breakdown (with better formatting)
        const pendingBreakdownEl = document.getElementById('pendingBreakdown');
        if (pendingBreakdownEl) {
            const breakdown = data.pending_breakdown || {vip: 0, urgent: 0, normal: 0, low: 0};
            const breakdownParts = [];
            
            if (breakdown.vip > 0) breakdownParts.push(`${breakdown.vip} vip`);
            if (breakdown.urgent > 0) breakdownParts.push(`${breakdown.urgent} urgent`);  
            if (breakdown.normal > 0) breakdownParts.push(`${breakdown.normal} normal`);
            if (breakdown.low > 0) breakdownParts.push(`${breakdown.low} low`);
            
            const breakdownText = breakdownParts.length > 0 
                ? breakdownParts.join(', ') 
                : 'No pending cases';
            
            pendingBreakdownEl.textContent = breakdownText;
            console.log(`✅ Updated pendingBreakdown: ${breakdownText}`);
        } else {
            console.error('❌ Element #pendingBreakdown not found');
        }
        
        // FIXED: Team Average Response Time (with error handling)
        const avgResponseTimeEl = document.getElementById('avgResponseTime');
        if (avgResponseTimeEl) {
            const displayText = data.team_avg_response_time && data.team_avg_response_time > 0
                ? `${data.team_avg_response_time}m` 
                : '-';
            avgResponseTimeEl.textContent = displayText;
            console.log(`✅ Updated avgResponseTime: ${displayText}`);
        } else {
            console.error('❌ Element #avgResponseTime not found');
        }
        
    } catch (error) {
        console.error('❌ Error updating team metrics:', error);
        showNotification('Failed to update dashboard display', 'error');
    }
}

    handleCaseUpdate(payload) {
        if (window.CONFIG.DEBUG_MODE === 'true') {
            console.log('📧 Case update received:', payload);
        }
        
        // Refresh relevant dashboard sections
        this.loadTeamOverview();
        this.loadRecentCases();
        
        // Show notification for new cases
        if (payload.eventType === 'INSERT') {
            this.showNotification(`New case created: ${payload.new.case_number}`, 'info');
        }
    }

    handleAgentUpdate(payload) {
        if (window.CONFIG.DEBUG_MODE === 'true') {
            console.log('👤 Agent update received:', payload);
        }
        
        this.loadAgentPerformance();
    }

    setupAutoRefresh() {
        // Clear existing interval
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        // Set up new refresh interval
        this.refreshInterval = setInterval(() => {
            if (!this.isLoading) {
                this.loadDashboardData();
            }
        }, parseInt(window.CONFIG.REFRESH_INTERVAL));

        if (window.CONFIG.DEBUG_MODE === 'true') {
            console.log(`⏱️ Auto-refresh set to ${window.CONFIG.REFRESH_INTERVAL}ms`);
        }
    }

    setupEventListeners() {
        // Handle page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && !this.isLoading) {
                this.loadDashboardData();
            }
        });

        // Handle window focus
        window.addEventListener('focus', () => {
            if (!this.isLoading) {
                this.loadDashboardData();
            }
        });
    }

    showLoading() {
        const indicator = document.getElementById('loadingIndicator');
        if (indicator) {
            indicator.style.opacity = '1';
        }
    }

    hideLoading() {
        const indicator = document.getElementById('loadingIndicator');
        if (indicator) {
            indicator.style.opacity = '0';
        }
    }

    showError(message) {
        showNotification(message, 'error');
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        const colors = {
            'info': 'bg-blue-500',
            'success': 'bg-green-500',
            'warning': 'bg-yellow-500',
            'error': 'bg-red-500'
        };
        
        notification.className = `fixed top-4 right-4 ${colors[type]} text-white px-4 py-2 rounded shadow-lg z-50 transition-all duration-300`;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    // Cleanup method
    destroy() {
        console.log('🧹 Cleaning up app instance...');
        
        // Clear refresh interval
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        
        // Destroy all charts
        if (this.charts) {
            Object.values(this.charts).forEach(chart => {
                if (chart && chart.destroy) {
                    try {
                        chart.destroy();
                    } catch (error) {
                        console.warn('Error destroying chart:', error);
                    }
                }
            });
            this.charts = {};
        }
        
        // Unsubscribe from real-time updates
        if (this.supabase) {
            try {
                this.supabase.removeAllChannels();
            } catch (error) {
                console.warn('Error removing Supabase channels:', error);
            }
        }
        
        // Reset loading state
        this.isLoading = false;
        
        console.log('✅ App instance cleaned up');
    }
}

// Global app instance
let app = null;

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Prevent multiple instances
    if (app !== null) {
        console.warn('⚠️ App already initialized, skipping...');
        return;
    }
    
    console.log('🚀 Initializing Support Portal App...');
    app = new SupportPortalApp();
    app.init();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (app) {
        app.destroy();
        app = null;
    }
});

// Global functions for navigation
function showSection(sectionName) {
    try {
        // Hide all sections
        document.querySelectorAll('.section').forEach(section => {
            section.classList.add('hidden');
        });
        
        // Show selected section
        const targetSection = document.getElementById(`${sectionName}-section`);
        if (targetSection) {
            targetSection.classList.remove('hidden');
        } else {
            console.warn(`Section ${sectionName}-section not found`);
            return;
        }
        
        // Update navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.className = 'nav-btn text-gray-500 hover:text-gray-700 py-4 px-1 text-sm font-medium';
        });
        
        // Find and highlight active nav button
        const activeBtn = Array.from(document.querySelectorAll('.nav-btn'))
            .find(btn => btn.onclick && btn.onclick.toString().includes(sectionName));
        
        if (activeBtn) {
            activeBtn.className = 'nav-btn border-blue-500 text-blue-600 border-b-2 py-4 px-1 text-sm font-medium';
        }
        
        // Load section-specific data
        switch(sectionName) {
            case 'cases':
                if (typeof loadCasesSection === 'function') {
                    loadCasesSection();
                }
                break;
            case 'analytics':
                if (typeof loadAnalyticsSection === 'function') {
                    loadAnalyticsSection();
                }
                break;
            case 'agents':
                if (typeof loadAgentsSection === 'function') {
                    loadAgentsSection();
                }
                break;
        }
    } catch (error) {
        console.error('Error in showSection:', error);
    }
}

function refreshDashboard() {
    if (app && !app.isLoading) {
        app.loadDashboardData();
    }
}

// Prevent multiple app instances in global scope
window.createApp = function() {
    if (app !== null) {
        console.warn('⚠️ App already exists, destroying previous instance...');
        app.destroy();
    }
    app = new SupportPortalApp();
    return app;
};

// Expose app globally for debugging (only in debug mode)
document.addEventListener('DOMContentLoaded', () => {
    if (window.CONFIG && window.CONFIG.DEBUG_MODE === 'true') {
        window.app = app;
        console.log('🔧 Debug mode: App exposed globally as window.app');
    }
});
