/**
 * Dashboard Functions
 * Handles dashboard-specific functionality including charts and agent performance
 */

// Extend the SupportPortalApp class with dashboard methods
SupportPortalApp.prototype.loadAgentPerformance = async function() {
    try {
        // SIMPLIFIED: Always use manual calculation (no view issues)
        const agents = await this.calculateAgentPerformanceManually();
        
        const agentList = document.getElementById('agentList');
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
        document.getElementById('agentList').innerHTML = 
            '<p class="text-red-500 text-center">Error loading agent data</p>';
    }
};

SupportPortalApp.prototype.calculateAgentPerformanceManually = async function() {
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
            
            // FIXED: Count both resolved and closed cases for "resolved today"
            const todayCases = agentCases.filter(c => {
                const resolvedToday = (c.status === 'resolved' || c.status === 'closed') && 
                                    c.resolved_at && c.resolved_at.startsWith(today);
                return resolvedToday;
            });
            
             // Counts everything except resolved/closed
            const pendingCases = agentCases.filter(c => 
    !['resolved', 'closed'].includes(c.status)
);
            
            const unattendedCases = agentCases.filter(c => 
                c.status === 'new' && 
                new Date(c.created_at) > new Date(Date.now() - 2 * 60 * 60 * 1000)
            );
            
            const responseTimes = todayCases
                .filter(c => c.response_time_minutes)
                .map(c => c.response_time_minutes);
            
            const avgResponseTime = responseTimes.length > 0 
                ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
                : null;
            
            return {
                ...agent,
                resolved_today: todayCases.length,
                pending_cases: pendingCases.length,
                unattended_emails: unattendedCases.length,
                avg_response_time_today: avgResponseTime
            };
        });
        
    } catch (error) {
        console.error('Error calculating agent performance manually:', error);
        return [];
    }
};

SupportPortalApp.prototype.createAgentCard = function(agent) {
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
                    <span class="text-xs text-gray-500 mr-2">Today:</span>
                    <span class="text-sm font-medium">${agent.resolved_today || 0} resolved</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-xs text-gray-500 mr-2">Pending:</span>
                    <span class="text-sm font-medium">${agent.pending_cases || 0}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-xs text-gray-500 mr-2">Avg TAT:</span>
                    <span class="text-sm font-medium">${
                        agent.avg_response_time_today 
                            ? Math.round(agent.avg_response_time_today) + 'm' 
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
};

SupportPortalApp.prototype.calculateAgentEfficiency = function(agent) {
    if (agent.status === 'offline') {
        return { label: '', class: '' };
    }
    
    const resolvedToday = agent.resolved_today || 0;
    const avgResponseTime = agent.avg_response_time_today || 0;
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
};

SupportPortalApp.prototype.loadRecentCases = async function() {
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
        document.getElementById('recentCasesBody').innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-4 text-center text-red-500">
                    Error loading cases. Please check your database connection.
                </td>
            </tr>
        `;
    }
};

SupportPortalApp.prototype.createCaseRow = function(case_item) {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50 cursor-pointer transition-colors';
    tr.onclick = () => openCaseModal(case_item.id);
    
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
            <button class="text-blue-600 hover:text-blue-900 transition-colors" onclick="event.stopPropagation(); openCaseModal('${case_item.id}')">
                <i class="fas fa-eye mr-1"></i>View
            </button>
        </td>
    `;
    
    return tr;
};

SupportPortalApp.prototype.isCaseOverdue = function(case_item) {
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
};

SupportPortalApp.prototype.updateDashboardCharts = async function() {
    try {
        await this.createCasesTimelineChart();
    } catch (error) {
        console.error('Error updating dashboard charts:', error);
    }
};

SupportPortalApp.prototype.createCasesTimelineChart = async function() {
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
        const ctx = document.getElementById('casesChart').getContext('2d');
        
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
        const ctx = document.getElementById('casesChart').getContext('2d');
        ctx.fillStyle = '#f3f4f6';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.fillStyle = '#6b7280';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Chart data loading...', ctx.canvas.width / 2, ctx.canvas.height / 2);
    }
};
