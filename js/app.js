/**
 * Employee Support Portal - Main Application
 * Initializes the application and manages global state
 * FIXED VERSION - Resolves dashboard data loading issues
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
    console.log('🔄 === LOADING TEAM OVERVIEW (FORCED MANUAL) ===');
    
    try {
        // ALWAYS use manual calculation - bypass database view completely
        await this.calculateTeamOverviewManually();
    } catch (error) {
        console.error('❌ Error in loadTeamOverview:', error);
        // Even if error, try manual calculation
        await this.calculateTeamOverviewManually();
    }
}

    async calculateTeamOverviewManually() {
    console.log('🔄 === STARTING MANUAL CALCULATION ===');
    
    try {
        // Get ALL cases with specific fields
        const { data: cases, error } = await this.supabase
            .from('cases')
            .select('id, case_number, status, priority, response_time_minutes, created_at, resolved_at');
            
        if (error) {
            console.error('❌ Supabase query error:', error);
            throw error;
        }
        
        console.log(`📊 Retrieved ${cases ? cases.length : 0} cases from database`);
        
        if (!cases || cases.length === 0) {
            console.warn('⚠️ No cases found in database');
            this.forceUpdateDashboard({
                total_cases: 0,
                total_resolved: 0,
                total_pending: 0,
                pending_breakdown: {vip: 0, urgent: 0, normal: 0, low: 0},
                team_avg_response_time: 0
            });
            return;
        }
        
        // Log sample for debugging
        console.log('📝 First case sample:', cases[0]);
        
        // === STEP 1: Calculate total and resolved ===
        const totalCases = cases.length;
        const RESOLVED_STATUSES = ['resolved', 'closed'];
        
        const resolvedCases = cases.filter(c => {
            if (!c.status) return false;
            const status = c.status.toLowerCase().trim();
            const isResolved = RESOLVED_STATUSES.includes(status);
            if (isResolved) {
                console.log(`✅ Resolved: ${c.case_number} (${c.status})`);
            }
            return isResolved;
        });
        
        const totalResolved = resolvedCases.length;
        
        console.log(`📊 TOTALS: ${totalResolved} resolved out of ${totalCases} total`);
        
        // === STEP 2: Calculate pending cases ===
        const pendingCases = cases.filter(c => {
            if (!c.status) return true; // treat null status as pending
            const status = c.status.toLowerCase().trim();
            const isPending = !RESOLVED_STATUSES.includes(status);
            if (isPending) {
                console.log(`⏳ Pending: ${c.case_number} (${c.status}, priority: ${c.priority})`);
            }
            return isPending;
        });
        
        console.log(`📊 PENDING: ${pendingCases.length} cases`);
        
        // === STEP 3: Breakdown pending by priority ===
        const pendingBreakdown = {
            vip: 0,
            urgent: 0,
            normal: 0,
            low: 0
        };
        
        pendingCases.forEach(c => {
            if (c.priority) {
                const priority = c.priority.toLowerCase().trim();
                if (pendingBreakdown.hasOwnProperty(priority)) {
                    pendingBreakdown[priority]++;
                    console.log(`📊 Pending ${priority}: ${c.case_number}`);
                } else {
                    console.warn(`⚠️ Unknown priority: ${c.priority} for case ${c.case_number}`);
                }
            } else {
                console.warn(`⚠️ Case ${c.case_number} has no priority`);
            }
        });
        
        console.log('📊 PENDING BREAKDOWN:', pendingBreakdown);
        
        // === STEP 4: Calculate average response time ===
        const validResponseTimes = cases
            .filter(c => c.response_time_minutes && typeof c.response_time_minutes === 'number' && c.response_time_minutes > 0)
            .map(c => c.response_time_minutes);
        
        let avgResponseTime = 0;
        if (validResponseTimes.length > 0) {
            avgResponseTime = Math.round(validResponseTimes.reduce((sum, time) => sum + time, 0) / validResponseTimes.length);
        }
        
        console.log(`⏱️ Response time: ${avgResponseTime}m (from ${validResponseTimes.length} cases)`);
        
        // === STEP 5: Prepare final metrics ===
        const metrics = {
            total_cases: totalCases,
            total_resolved: totalResolved,
            total_pending: pendingCases.length,
            pending_breakdown: pendingBreakdown,
            team_avg_response_time: avgResponseTime
        };
        
        console.log('📋 FINAL CALCULATED METRICS:', metrics);
        
        // === STEP 6: Force update dashboard ===
        this.forceUpdateDashboard(metrics);
        this.checkPriorityAlerts(metrics);
        
    } catch (error) {
        console.error('❌ Error in manual calculation:', error);
        showNotification('Failed to calculate dashboard metrics', 'error');
        
        // Show error state
        this.forceUpdateDashboard({
            total_cases: 0,
            total_resolved: 0,
            total_pending: 0,
            pending_breakdown: {vip: 0, urgent: 0, normal: 0, low: 0},
            team_avg_response_time: 0
        });
    }
}
    forceUpdateDashboard(data) {
    console.log('🔧 === FORCE UPDATING DASHBOARD ===');
    console.log('📊 Data to display:', data);
    
    try {
        // DIRECT DOM manipulation - bypass any format conversion issues
        
        // Total Resolved
        const totalResolvedEl = document.getElementById('totalResolved');
        if (totalResolvedEl) {
            const display = `${data.total_resolved || 0}/${data.total_cases || 0}`;
            totalResolvedEl.textContent = display;
            console.log(`✅ FORCED Total Resolved: ${display}`);
        } else {
            console.error('❌ #totalResolved element not found');
        }
        
        // Pending Cases Count
        const pendingCasesEl = document.getElementById('pendingCases');
        if (pendingCasesEl) {
            const count = (data.total_pending || 0).toString();
            pendingCasesEl.textContent = count;
            console.log(`✅ FORCED Pending Cases: ${count}`);
        } else {
            console.error('❌ #pendingCases element not found');
        }
        
        // Pending Breakdown Text
        const pendingBreakdownEl = document.getElementById('pendingBreakdown');
        if (pendingBreakdownEl) {
            const breakdown = data.pending_breakdown || {vip: 0, urgent: 0, normal: 0, low: 0};
            const parts = [];
            
            // Build breakdown text
            if (breakdown.vip > 0) parts.push(`${breakdown.vip} vip`);
            if (breakdown.urgent > 0) parts.push(`${breakdown.urgent} urgent`);
            if (breakdown.normal > 0) parts.push(`${breakdown.normal} normal`);
            if (breakdown.low > 0) parts.push(`${breakdown.low} low`);
            
            const text = parts.length > 0 ? parts.join(', ') : 'No pending cases';
            pendingBreakdownEl.textContent = text;
            console.log(`✅ FORCED Pending Breakdown: "${text}"`);
        } else {
            console.error('❌ #pendingBreakdown element not found');
        }
        
        // Average Response Time
        const avgResponseTimeEl = document.getElementById('avgResponseTime');
        if (avgResponseTimeEl) {
            const display = data.team_avg_response_time && data.team_avg_response_time > 0 
                ? `${data.team_avg_response_time}m` 
                : '-';
            avgResponseTimeEl.textContent = display;
            console.log(`✅ FORCED Avg Response Time: ${display}`);
        } else {
            console.error('❌ #avgResponseTime element not found');
        }
        
        console.log('✅ === DASHBOARD FORCE UPDATE COMPLETE ===');
        
    } catch (error) {
        console.error('❌ Error in force update:', error);
    }
}

    updateTeamMetrics(data) {
        console.log('🔄 updateTeamMetrics called, redirecting to forceUpdateDashboard');
        this.forceUpdateDashboard(data);
    }

    checkPriorityAlerts(data) {
        const alertElement = document.getElementById('priorityAlert');
        const textElement = document.getElementById('priorityAlertText');
        
        if (!alertElement || !textElement) return;
        
        const breakdown = data.pending_breakdown || {vip: 0, urgent: 0, normal: 0, low: 0};
        
        if (breakdown.vip > 0 || breakdown.urgent > 0) {
            let alertText = '';
            if (breakdown.vip > 0) {
                alertText += `${breakdown.vip} VIP case(s) pending. `;
            }
            if (breakdown.urgent > 0) {
                alertText += `${breakdown.urgent} urgent case(s) requiring attention.`;
            }
            
            textElement.textContent = alertText;
            alertElement.classList.remove('hidden');
        } else {
            alertElement.classList.add('hidden');
        }
    }

    async loadAgentPerformance() {
        try {
            // SIMPLIFIED: Always use manual calculation (no view issues)
            const agents = await this.calculateAgentPerformanceManually();
            
            const agentList = document.getElementById('agentList');
            if (!agentList) return;
            
            agentList.innerHTML = '';
            
            if (!agents || agents.length === 0) {
                agentList.innerHTML = '<p class="text-gray-500 text-center">No agents found</p>';
                return;
            }
            
            agents.forEach(agent => {
                const agentCard = this.createAgentCard(agent);
                agentList.appendChild(agentCard);
            });
            
        } catch (error) {
            console.error('Error loading agent performance:', error);
            const agentList = document.getElementById('agentList');
            if (agentList) {
                agentList.innerHTML = '<p class="text-red-500 text-center">Error loading agent data</p>';
            }
        }
    }

    async calculateAgentPerformanceManually() {
        try {
            const { data: agents, error: agentsError } = await this.supabase
                .from('agents')
                .select('*');
                
            if (agentsError) throw agentsError;
            
            const { data: cases, error: casesError } = await this.supabase
                .from('cases')
                .select('*');
                
            if (casesError) throw casesError;
            
            const today = new Date().toISOString().split('T')[0];
            
            return agents.map(agent => {
                const agentCases = cases.filter(c => c.agent_id === agent.id);
                
                // Today's resolved (keep this)
                const todayResolved = agentCases.filter(c => {
                    const resolvedToday = (c.status === 'resolved' || c.status === 'closed') && 
                                        c.resolved_at && c.resolved_at.startsWith(today);
                    return resolvedToday;
                });
                
                // Add these calculations
                const totalResolvedCases = agentCases.filter(c => 
                    ['resolved', 'closed'].includes(c.status)
                );
                
                const totalCases = agentCases.length;
                
                // Keep these
                const pendingCases = agentCases.filter(c => 
                    !['resolved', 'closed'].includes(c.status)
                );
                
                const unattendedCases = agentCases.filter(c => 
                    c.status === 'new' && 
                    new Date(c.created_at) > new Date(Date.now() - 2 * 60 * 60 * 1000)
                );
                
                // Use all-time response time average
                const allResponseTimes = agentCases
                    .filter(c => c.response_time_minutes && c.response_time_minutes > 0)
                    .map(c => c.response_time_minutes);
                
                const avgResponseTime = allResponseTimes.length > 0 
                    ? allResponseTimes.reduce((sum, time) => sum + time, 0) / allResponseTimes.length
                    : null;
                
                return {
                    ...agent,
                    resolved_today: todayResolved.length,
                    total_resolved: totalResolvedCases.length,
                    total_cases: totalCases,
                    pending_cases: pendingCases.length,
                    unattended_emails: unattendedCases.length,
                    avg_response_time: avgResponseTime
                };
            });
            
        } catch (error) {
            console.error('Error calculating agent performance manually:', error);
            return [];
        }
    }

    createAgentCard(agent) {
    const div = document.createElement('div');
    div.className = 'flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors';
    
    const statusColors = {
        'available': 'text-green-600 bg-green-100',
        'busy': 'text-yellow-600 bg-yellow-100',
        'break': 'text-orange-600 bg-orange-100',
        'offline': 'text-gray-600 bg-gray-100'
    };
    
    const statusColor = statusColors[agent.status] || statusColors['offline'];
    const efficiency = this.calculateAgentEfficiency(agent);
    
    // FIXED: Remove the duplicate wrapper div and classes from innerHTML
    div.innerHTML = `
        <div class="flex items-center">
            <div class="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center mr-3">
                <span class="text-white font-semibold text-sm">${agent.name.charAt(0).toUpperCase()}</span>
            </div>
            <div>
                <p class="font-medium text-gray-900">${agent.name}</p>
                <div class="flex items-center space-x-2">
                    <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusColor}">
                        ${agent.status}
                    </span>
                    ${efficiency.class ? `
                        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${efficiency.class}">
                            ${efficiency.label}
                        </span>
                    ` : ''}
                </div>
            </div>
        </div>
        <div class="text-right">
            <div class="flex flex-col space-y-1">
                <div class="flex justify-between items-center">
                    <span class="text-xs text-gray-500 mr-2">Resolved:</span>
                    <span class="text-sm font-medium">${agent.total_resolved || 0}/${agent.total_cases || 0}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-xs text-gray-500 mr-2">Pending:</span>
                    <span class="text-sm font-medium">${agent.pending_cases || 0}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-xs text-gray-500 mr-2">Avg Response Time:</span>
                    <span class="text-sm font-medium">${
                        agent.avg_response_time 
                            ? Math.round(agent.avg_response_time) + 'm' 
                            : '-'
                    }</span>
                </div>
                ${agent.unattended_emails > 0 ? `
                    <div class="flex justify-between items-center">
                        <span class="text-xs text-red-500 mr-2">Unattended:</span>
                        <span class="text-sm font-medium text-red-600">${agent.unattended_emails}</span>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
    
    return div;
}

    calculateAgentEfficiency(agent) {
        if (agent.status === 'offline') {
            return { label: '', class: '' };
        }
        
        const resolvedToday = agent.resolved_today || 0;
        const avgResponseTime = agent.avg_response_time || 0;
        const pendingCases = agent.pending_cases || 0;
        
        // Simple efficiency calculation
        if (resolvedToday >= 5 && avgResponseTime <= 60 && pendingCases <= 3) {
            return { label: 'High Performer', class: 'text-green-600 bg-green-100' };
        } else if (resolvedToday >= 3 || (avgResponseTime <= 120 && pendingCases <= 5)) {
            return { label: 'Good', class: 'text-blue-600 bg-blue-100' };
        } else if (pendingCases > 8 || avgResponseTime > 180) {
            return { label: 'Needs Support', class: 'text-red-600 bg-red-100' };
        }
        
        return { label: '', class: '' };
    }

    async loadRecentCases() {
        try {
            const { data: cases, error } = await this.supabase
                .from('cases')
                .select(`
                    *,
                    agents(name),
                    email_threads(subject)
                `)
                .order('created_at', { ascending: false })
                .limit(10);
            
            if (error) throw error;
            
            const tbody = document.getElementById('recentCasesBody');
            if (!tbody) return;
            
            tbody.innerHTML = '';
            
            if (!cases || cases.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" class="px-6 py-4 text-center text-gray-500">
                            No cases found. Cases will appear here when emails are processed by the n8n workflow.
                        </td>
                    </tr>
                `;
                return;
            }
            
            cases.forEach(case_item => {
                const row = this.createCaseRow(case_item);
                tbody.appendChild(row);
            });
            
        } catch (error) {
            console.error('Error loading recent cases:', error);
            const tbody = document.getElementById('recentCasesBody');
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" class="px-6 py-4 text-center text-red-500">
                            Error loading cases. Please check your database connection.
                        </td>
                    </tr>
                `;
            }
        }
    }

    createCaseRow(case_item) {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 cursor-pointer transition-colors';
        tr.onclick = () => {
            if (typeof openCaseModal === 'function') {
                openCaseModal(case_item.id);
            }
        };
        
        const priorityConfig = {
            'vip': { bg: 'bg-purple-100', text: 'text-purple-800', icon: '👑' },
            'urgent': { bg: 'bg-red-100', text: 'text-red-800', icon: '🚨' },
            'normal': { bg: 'bg-blue-100', text: 'text-blue-800', icon: '📧' },
            'low': { bg: 'bg-gray-100', text: 'text-gray-800', icon: '📝' }
        };
        
        const statusConfig = {
            'new': { bg: 'bg-green-100', text: 'text-green-800', icon: '🆕' },
            'assigned': { bg: 'bg-blue-100', text: 'text-blue-800', icon: '👤' },
            'in_progress': { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: '⚡' },
            'pending_customer': { bg: 'bg-orange-100', text: 'text-orange-800', icon: '⏳' },
            'resolved': { bg: 'bg-gray-100', text: 'text-gray-800', icon: '✅' },
            'closed': { bg: 'bg-gray-100', text: 'text-gray-600', icon: '🔒' }
        };
        
        const priority = priorityConfig[case_item.priority] || priorityConfig['normal'];
        const status = statusConfig[case_item.status] || statusConfig['new'];
        
        const tat = calculateTAT(case_item.created_at, case_item.resolved_at);
        const isOverdue = this.isCaseOverdue(case_item);
        
        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                    <span class="text-sm font-medium text-gray-900">${case_item.case_number}</span>
                    ${isOverdue ? '<span class="ml-2 text-red-500">⚠️</span>' : ''}
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${priority.bg} ${priority.text}">
                    ${priority.icon} ${case_item.priority}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${case_item.agents?.name || 'Unassigned'}
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.text}">
                    ${status.icon} ${case_item.status.replace('_', ' ')}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}">
                ${tat}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button class="text-blue-600 hover:text-blue-900 transition-colors" onclick="event.stopPropagation(); ${typeof openCaseModal === 'function' ? `openCaseModal('${case_item.id}')` : 'console.log(\'openCaseModal not found\')'}"">
                    <i class="fas fa-eye mr-1"></i>View
                </button>
            </td>
        `;
        
        return tr;
    }

    isCaseOverdue(case_item) {
        if (case_item.status === 'resolved' || case_item.status === 'closed') {
            return false;
        }
        
        const created = new Date(case_item.created_at);
        const now = new Date();
        const hoursOpen = (now - created) / (1000 * 60 * 60);
        
        // Define SLA based on priority
        const slaHours = {
            'vip': 4,
            'urgent': 8, 
            'normal': 24,
            'low': 48
        };
        
        const maxHours = slaHours[case_item.priority] || 24;
        return hoursOpen > maxHours;
    }

    async updateDashboardCharts() {
        try {
            await this.createCasesTimelineChart();
        } catch (error) {
            console.error('Error updating dashboard charts:', error);
        }
    }

    async createCasesTimelineChart() {
        try {
            // Get last 7 days of case data
            const endDate = new Date();
            const startDate = new Date(endDate);
            startDate.setDate(startDate.getDate() - 6);
            
            const { data: cases, error } = await this.supabase
                .from('cases')
                .select('created_at, resolved_at, status')
                .gte('created_at', startDate.toISOString())
                .order('created_at', { ascending: true });
                
            if (error) throw error;
            
            // Process data for chart
            const days = [];
            const createdData = [];
            const resolvedData = [];
            
            for (let i = 0; i < 7; i++) {
                const date = new Date(startDate);
                date.setDate(date.getDate() + i);
                const dateStr = date.toISOString().split('T')[0];
                
                days.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
                
                const created = cases.filter(c => c.created_at.startsWith(dateStr)).length;
                const resolved = cases.filter(c => 
                    c.resolved_at && c.resolved_at.startsWith(dateStr)
                ).length;
                
                createdData.push(created);
                resolvedData.push(resolved);
            }
            
            // Create chart
            const chartElement = document.getElementById('casesChart');
            if (!chartElement) return;
            
            const ctx = chartElement.getContext('2d');
            
            // Destroy existing chart if it exists
            if (this.charts.casesTimeline) {
                this.charts.casesTimeline.destroy();
            }
            
            this.charts.casesTimeline = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: days,
                    datasets: [{
                        label: 'Cases Created',
                        data: createdData,
                        borderColor: 'rgb(59, 130, 246)',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.1,
                        fill: true
                    }, {
                        label: 'Cases Resolved',
                        data: resolvedData,
                        borderColor: 'rgb(34, 197, 94)',
                        backgroundColor: 'rgba(34, 197, 94, 0.1)',
                        tension: 0.1,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        intersect: false,
                        mode: 'index'
                    },
                    plugins: {
                        legend: {
                            position: 'bottom'
                        },
                        tooltip: {
                            titleFont: {
                                size: 14
                            },
                            bodyFont: {
                                size: 13
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                stepSize: 1
                            },
                            grid: {
                                color: 'rgba(0, 0, 0, 0.1)'
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            }
                        }
                    }
                }
            });
            
        } catch (error) {
            console.error('Error creating cases timeline chart:', error);
            
            // Show placeholder if chart fails
            const chartElement = document.getElementById('casesChart');
            if (chartElement) {
                const ctx = chartElement.getContext('2d');
                ctx.fillStyle = '#f3f4f6';
                ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
                ctx.fillStyle = '#6b7280';
                ctx.font = '16px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('Chart data loading...', ctx.canvas.width / 2, ctx.canvas.height / 2);
            }
        }
    }

    setupRealTimeUpdates() {
        try {
            // Subscribe to case updates
            this.supabase
                .channel('cases-changes')
                .on('postgres_changes', { 
                    event: '*', 
                    schema: 'public', 
                    table: 'cases' 
                }, (payload) => {
                    this.handleCaseUpdate(payload);
                })
                .subscribe();

            // Subscribe to agent updates
            this.supabase
                .channel('agents-changes')
                .on('postgres_changes', { 
                    event: '*', 
                    schema: 'public', 
                    table: 'agents' 
                }, (payload) => {
                    this.handleAgentUpdate(payload);
                })
                .subscribe();

            if (window.CONFIG.DEBUG_MODE === 'true') {
                console.log('🔄 Real-time subscriptions established');
            }
        } catch (error) {
            console.error('Error setting up real-time updates:', error);
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

    // ADD this new debugging method to your SupportPortalApp class
    async debugDashboardData() {
        console.log('🔍 === DASHBOARD DEBUG SESSION ===');
        
        try {
            // Test Supabase connection
            console.log('🔗 Testing Supabase connection...');
            const { data: testQuery, error: testError } = await this.supabase
                .from('cases')
                .select('count')
                .limit(1);
            
            if (testError) {
                console.error('❌ Supabase connection failed:', testError);
                return;
            }
            
            console.log('✅ Supabase connection successful');
            
            // Get detailed case data
            const { data: cases, error } = await this.supabase
                .from('cases')
                .select('id, status, priority, response_time_minutes, created_at, resolved_at');
                
            if (error) {
                console.error('❌ Failed to fetch cases:', error);
                return;
            }
            
            console.log(`📊 Found ${cases.length} cases in database`);
            
            if (cases.length > 0) {
                // Status analysis
                const statusCounts = {};
                cases.forEach(c => {
                    statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
                });
                console.log('📈 Status breakdown:', statusCounts);
                
                // Priority analysis
                const priorityCounts = {};
                cases.forEach(c => {
                    priorityCounts[c.priority] = (priorityCounts[c.priority] || 0) + 1;
                });
                console.log('⚡ Priority breakdown:', priorityCounts);
                
                // Response time analysis
                const withResponseTime = cases.filter(c => c.response_time_minutes);
                console.log(`⏱️ Cases with response time: ${withResponseTime.length}/${cases.length}`);
                
                if (withResponseTime.length > 0) {
                    const responseTimes = withResponseTime.map(c => c.response_time_minutes);
                    const avgTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
                    console.log(`⏱️ Average response time: ${Math.round(avgTime)} minutes`);
                }
            }
            
            // Test DOM elements
            console.log('🎯 Testing DOM elements...');
            const elements = ['totalResolved', 'pendingCases', 'pendingBreakdown', 'avgResponseTime'];
            elements.forEach(id => {
                const el = document.getElementById(id);
                console.log(`${el ? '✅' : '❌'} Element #${id}: ${el ? 'found' : 'NOT FOUND'}`);
            });
            
        } catch (error) {
            console.error('❌ Debug session failed:', error);
        }
        
        console.log('🔍 === DEBUG SESSION COMPLETE ===');
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
