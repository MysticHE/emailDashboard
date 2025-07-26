/**
 * Analytics Functions - FIXED VERSION
 * Handles analytics section with charts and reporting
 * Fixed infinite loop issue and added proper guards
 */

// Global flag to prevent multiple simultaneous loading
let analyticsLoading = false;

/**
 * Load analytics section - WITH GUARDS AGAINST INFINITE LOOPS
 */
async function loadAnalyticsSection() {
    // Prevent multiple simultaneous calls
    if (analyticsLoading) {
        console.log('Analytics already loading, skipping...');
        return;
    }
    
    analyticsLoading = true;
    
    try {
        console.log('🔄 Loading analytics section...');
        
        // Clear any existing charts first
        destroyAllCharts();
        
        // Load charts one by one with delays to prevent conflicts
        await createTATTrendsChart();
        await new Promise(resolve => setTimeout(resolve, 100));
        
        await createVolumeChart();
        await new Promise(resolve => setTimeout(resolve, 100));
        
        await createPriorityDistributionChart();
        await new Promise(resolve => setTimeout(resolve, 100));
        
        await createAgentPerformanceChart();
        
        console.log('✅ Analytics section loaded successfully');
        
    } catch (error) {
        console.error('Error loading analytics section:', error);
        showNotification('Failed to load analytics data', 'error');
    } finally {
        analyticsLoading = false;
    }
}

/**
 * Create TAT trends chart - WITH GUARDS
 */
async function createTATTrendsChart() {
    if (!app || !app.supabase) return;
    
    // Check if chart is already being created
    if (app.charts.tatTrends && app.charts.tatTrends.data) {
        console.log('TAT trends chart already exists, skipping...');
        return;
    }

    try {
        console.log('Creating TAT trends chart...');
        
        // Get last 30 days of data
        const endDate = new Date();
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 29);

        const { data: cases, error } = await app.supabase
            .from('cases')
            .select('created_at, resolved_at, response_time_minutes, resolution_time_minutes, priority')
            .gte('created_at', startDate.toISOString())
            .order('created_at', { ascending: true });

        if (error) throw error;

        // Process data by day
        const dailyData = {};
        
        for (let i = 0; i < 30; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];
            
            dailyData[dateStr] = {
                date: date,
                response_times: [],
                resolution_times: [],
                count: 0
            };
        }

        // Aggregate case data
        cases.forEach(case_item => {
            const dateStr = case_item.created_at.split('T')[0];
            if (dailyData[dateStr]) {
                dailyData[dateStr].count++;
                
                if (case_item.response_time_minutes) {
                    dailyData[dateStr].response_times.push(case_item.response_time_minutes);
                }
                if (case_item.resolution_time_minutes) {
                    dailyData[dateStr].resolution_times.push(case_item.resolution_time_minutes);
                }
            }
        });

        // Calculate averages
        const labels = [];
        const avgResponseTimes = [];
        const avgResolutionTimes = [];

        Object.values(dailyData).forEach(day => {
            labels.push(day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            
            const avgResponse = day.response_times.length > 0 
                ? day.response_times.reduce((sum, time) => sum + time, 0) / day.response_times.length
                : null;
            
            const avgResolution = day.resolution_times.length > 0
                ? day.resolution_times.reduce((sum, time) => sum + time, 0) / day.resolution_times.length
                : null;
            
            avgResponseTimes.push(avgResponse);
            avgResolutionTimes.push(avgResolution);
        });

        // Get canvas and ensure it exists
        const canvas = document.getElementById('tatChart');
        if (!canvas) {
            console.error('TAT chart canvas not found');
            return;
        }
        
        const ctx = canvas.getContext('2d');
        
        // Destroy existing chart
        if (app.charts.tatTrends) {
            app.charts.tatTrends.destroy();
            app.charts.tatTrends = null;
        }

        // Create new chart
        app.charts.tatTrends = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Avg Response Time (minutes)',
                    data: avgResponseTimes,
                    borderColor: 'rgb(239, 68, 68)',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.1,
                    spanGaps: true
                }, {
                    label: 'Avg Resolution Time (minutes)',
                    data: avgResolutionTimes,
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.1,
                    spanGaps: true
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
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += Math.round(context.parsed.y) + ' minutes';
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Minutes'
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

        console.log('✅ TAT trends chart created');

    } catch (error) {
        console.error('Error creating TAT trends chart:', error);
        showChartError('tatChart', 'Failed to load TAT trends');
    }
}

/**
 * Create case volume chart - WITH GUARDS
 */
async function createVolumeChart() {
    if (!app || !app.supabase) return;
    
    // Check if chart already exists
    if (app.charts.volume && app.charts.volume.data) {
        console.log('Volume chart already exists, skipping...');
        return;
    }

    try {
        console.log('Creating volume chart...');
        
        // Get last 30 days of data
        const endDate = new Date();
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 29);

        const { data: cases, error } = await app.supabase
            .from('cases')
            .select('created_at, resolved_at, status')
            .gte('created_at', startDate.toISOString())
            .order('created_at', { ascending: true });

        if (error) throw error;

        // Process data by day
        const dailyData = {};
        
        for (let i = 0; i < 30; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];
            
            dailyData[dateStr] = {
                date: date,
                created: 0,
                resolved: 0
            };
        }

        // Count cases by day
        cases.forEach(case_item => {
            // Count created cases
            const createdDateStr = case_item.created_at.split('T')[0];
            if (dailyData[createdDateStr]) {
                dailyData[createdDateStr].created++;
            }

            // Count resolved cases
            if (case_item.resolved_at) {
                const resolvedDateStr = case_item.resolved_at.split('T')[0];
                if (dailyData[resolvedDateStr]) {
                    dailyData[resolvedDateStr].resolved++;
                }
            }
        });

        // Prepare chart data
        const labels = [];
        const createdData = [];
        const resolvedData = [];

        Object.values(dailyData).forEach(day => {
            labels.push(day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            createdData.push(day.created);
            resolvedData.push(day.resolved);
        });

        // Get canvas
        const canvas = document.getElementById('volumeChart');
        if (!canvas) {
            console.error('Volume chart canvas not found');
            return;
        }
        
        const ctx = canvas.getContext('2d');
        
        // Destroy existing chart
        if (app.charts.volume) {
            app.charts.volume.destroy();
            app.charts.volume = null;
        }

        app.charts.volume = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Cases Created',
                    data: createdData,
                    backgroundColor: 'rgba(59, 130, 246, 0.8)',
                    borderColor: 'rgba(59, 130, 246, 1)',
                    borderWidth: 1
                }, {
                    label: 'Cases Resolved',
                    data: resolvedData,
                    backgroundColor: 'rgba(34, 197, 94, 0.8)',
                    borderColor: 'rgba(34, 197, 94, 1)',
                    borderWidth: 1
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

        console.log('✅ Volume chart created');

    } catch (error) {
        console.error('Error creating volume chart:', error);
        showChartError('volumeChart', 'Failed to load case volume data');
    }
}

/**
 * Create priority distribution chart - WITH GUARDS
 */
async function createPriorityDistributionChart() {
    if (!app || !app.supabase) return;
    
    // Check if chart already exists
    if (app.charts.priority && app.charts.priority.data) {
        console.log('Priority chart already exists, skipping...');
        return;
    }

    try {
        console.log('Creating priority distribution chart...');
        
        const { data: cases, error } = await app.supabase
            .from('cases')
            .select('priority, status')
            .neq('status', 'closed');

        if (error) throw error;

        // Count by priority
        const priorityCounts = {
            'vip': 0,
            'urgent': 0,
            'normal': 0,
            'low': 0
        };

        cases.forEach(case_item => {
            if (priorityCounts.hasOwnProperty(case_item.priority)) {
                priorityCounts[case_item.priority]++;
            }
        });

        // Prepare chart data
        const labels = Object.keys(priorityCounts).map(p => capitalize(p));
        const data = Object.values(priorityCounts);
        const backgroundColors = [
            'rgba(147, 51, 234, 0.8)', // VIP - Purple
            'rgba(239, 68, 68, 0.8)',  // Urgent - Red
            'rgba(59, 130, 246, 0.8)', // Normal - Blue
            'rgba(107, 114, 128, 0.8)' // Low - Gray
        ];

        // Get canvas
        const canvas = document.getElementById('priorityChart');
        if (!canvas) {
            console.error('Priority chart canvas not found');
            return;
        }
        
        const ctx = canvas.getContext('2d');
        
        // Destroy existing chart
        if (app.charts.priority) {
            app.charts.priority.destroy();
            app.charts.priority = null;
        }

        app.charts.priority = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: backgroundColors,
                    borderColor: backgroundColors.map(color => color.replace('0.8', '1')),
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((sum, value) => sum + value, 0);
                                const percentage = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : 0;
                                return `${context.label}: ${context.parsed} (${percentage}%)`;
                            }
                        }
                    }
                },
                cutout: '50%'
            }
        });

        console.log('✅ Priority distribution chart created');

    } catch (error) {
        console.error('Error creating priority distribution chart:', error);
        showChartError('priorityChart', 'Failed to load priority distribution');
    }
}

/**
 * Create agent performance chart - WITH GUARDS
 */
async function createAgentPerformanceChart() {
    if (!app || !app.supabase) return;
    
    // Check if chart already exists
    if (app.charts.agentPerformance && app.charts.agentPerformance.data) {
        console.log('Agent performance chart already exists, skipping...');
        return;
    }

    try {
        console.log('Creating agent performance chart...');
        
        // Get agents and their cases
        const { data: agents, error: agentsError } = await app.supabase
            .from('agents')
            .select('id, name')
            .neq('status', 'offline');

        if (agentsError) throw agentsError;

        if (!agents || agents.length === 0) {
            showChartError('agentChart', 'No active agents found');
            return;
        }

        const { data: cases, error: casesError } = await app.supabase
            .from('cases')
            .select('agent_id, status, response_time_minutes, resolution_time_minutes')
            .not('agent_id', 'is', null);

        if (casesError) throw casesError;

        // Calculate performance metrics for each agent
        const agentMetrics = agents.map(agent => {
            const agentCases = cases.filter(c => c.agent_id === agent.id);
            const resolvedCases = agentCases.filter(c => c.status === 'resolved');
            
            const totalCases = agentCases.length;
            const totalResolved = resolvedCases.length;
            const resolutionRate = totalCases > 0 ? (totalResolved / totalCases) * 100 : 0;
            
            const responseTimes = agentCases
                .filter(c => c.response_time_minutes)
                .map(c => c.response_time_minutes);
            
            const avgResponseTime = responseTimes.length > 0
                ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
                : 0;

            return {
                name: agent.name,
                totalCases,
                totalResolved,
                resolutionRate,
                avgResponseTime
            };
        });

        // Get canvas
        const canvas = document.getElementById('agentChart');
        if (!canvas) {
            console.error('Agent chart canvas not found');
            return;
        }
        
        const ctx = canvas.getContext('2d');
        
        // Destroy existing chart
        if (app.charts.agentPerformance) {
            app.charts.agentPerformance.destroy();
            app.charts.agentPerformance = null;
        }

        app.charts.agentPerformance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: agentMetrics.map(a => a.name),
                datasets: [{
                    label: 'Resolution Rate (%)',
                    data: agentMetrics.map(a => a.resolutionRate),
                    backgroundColor: 'rgba(34, 197, 94, 0.8)',
                    borderColor: 'rgba(34, 197, 94, 1)',
                    borderWidth: 1,
                    yAxisID: 'y'
                }, {
                    label: 'Avg Response Time (minutes)',
                    data: agentMetrics.map(a => a.avgResponseTime),
                    backgroundColor: 'rgba(239, 68, 68, 0.8)',
                    borderColor: 'rgba(239, 68, 68, 1)',
                    borderWidth: 1,
                    yAxisID: 'y1'
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
                        callbacks: {
                            afterBody: function(context) {
                                if (context.length > 0) {
                                    const agentIndex = context[0].dataIndex;
                                    const agent = agentMetrics[agentIndex];
                                    return [
                                        `Total Cases: ${agent.totalCases}`,
                                        `Resolved: ${agent.totalResolved}`
                                    ];
                                }
                                return [];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: 'Resolution Rate (%)'
                        },
                        grid: {
                            color: 'rgba(34, 197, 94, 0.2)'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Avg Response Time (min)'
                        },
                        grid: {
                            drawOnChartArea: false,
                            color: 'rgba(239, 68, 68, 0.2)'
                        }
                    }
                }
            }
        });

        console.log('✅ Agent performance chart created');

    } catch (error) {
        console.error('Error creating agent performance chart:', error);
        showChartError('agentChart', 'Failed to load agent performance data');
    }
}

/**
 * Load agents section
 */
async function loadAgentsSection() {
    if (!app || !app.supabase) return;

    try {
        const { data: agents, error } = await app.supabase
            .from('agents')
            .select('*')
            .order('name');

        if (error) throw error;

        const container = document.getElementById('agentCards');
        
        if (!agents || agents.length === 0) {
            container.innerHTML = `
                <div class="col-span-3 text-center py-8">
                    <i class="fas fa-users text-4xl text-gray-300 mb-4"></i>
                    <p class="text-gray-500">No agents found</p>
                </div>
            `;
            return;
        }

        // Get case counts for each agent
        const { data: cases, error: casesError } = await app.supabase
            .from('cases')
            .select('agent_id, status, created_at, resolved_at, response_time_minutes');

        if (casesError) {
            console.warn('Could not load case data for agents:', casesError);
        }

        container.innerHTML = '';

        agents.forEach(agent => {
            const agentCases = cases ? cases.filter(c => c.agent_id === agent.id) : [];
            const agentCard = createAgentDetailCard(agent, agentCases);
            container.appendChild(agentCard);
        });

    } catch (error) {
        console.error('Error loading agents section:', error);
        document.getElementById('agentCards').innerHTML = `
            <div class="col-span-3 text-center py-8 text-red-500">
                <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                <p>Error loading agents</p>
            </div>
        `;
    }
}

/**
 * Create detailed agent card for agents section
 */
function createAgentDetailCard(agent, cases) {
    const div = document.createElement('div');
    div.className = 'bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow';

    // Calculate metrics
    const totalCases = cases.length;
    const resolvedCases = cases.filter(c => c.status === 'resolved').length;
    const pendingCases = cases.filter(c => !['resolved', 'closed'].includes(c.status)).length;
    
    const today = new Date().toISOString().split('T')[0];
    const todayResolved = cases.filter(c => 
        c.status === 'resolved' && c.resolved_at && c.resolved_at.startsWith(today)
    ).length;

    const responseTimes = cases
        .filter(c => c.response_time_minutes)
        .map(c => c.response_time_minutes);
    
    const avgResponseTime = responseTimes.length > 0
        ? Math.round(responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length)
        : null;

    const resolutionRate = totalCases > 0 ? Math.round((resolvedCases / totalCases) * 100) : 0;

    // Status colors
    const statusColors = {
        'available': 'bg-green-100 text-green-800',
        'busy': 'bg-yellow-100 text-yellow-800',
        'break': 'bg-orange-100 text-orange-800',
        'offline': 'bg-gray-100 text-gray-800'
    };

    const statusColor = statusColors[agent.status] || statusColors['offline'];

    div.innerHTML = `
        <div class="text-center">
            <!-- Agent Avatar -->
            <div class="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span class="text-white font-bold text-xl">${agent.name.charAt(0).toUpperCase()}</span>
            </div>
            
            <!-- Agent Info -->
            <h3 class="text-lg font-semibold text-gray-900 mb-1">${agent.name}</h3>
            <p class="text-sm text-gray-500 mb-3">${agent.email}</p>
            
            <!-- Status Badge -->
            <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusColor} mb-4">
                ${capitalize(agent.status)}
            </span>
            
            <!-- Expertise Tags -->
            ${agent.expertise_tags && Array.isArray(agent.expertise_tags) && agent.expertise_tags.length > 0 ? `
                <div class="flex flex-wrap justify-center gap-1 mb-4">
                    ${agent.expertise_tags.slice(0, 3).map(tag => 
                        `<span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">${tag}</span>`
                    ).join('')}
                    ${agent.expertise_tags.length > 3 ? `<span class="text-xs text-gray-500">+${agent.expertise_tags.length - 3} more</span>` : ''}
                </div>
            ` : ''}
            
            <!-- Special Capabilities -->
            <div class="flex justify-center space-x-2 mb-4">
                ${agent.handles_vip ? '<span class="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded font-medium">VIP</span>' : ''}
                ${agent.handles_escalations ? '<span class="px-2 py-1 bg-red-100 text-red-800 text-xs rounded font-medium">Escalations</span>' : ''}
            </div>
        </div>
        
        <!-- Performance Metrics -->
        <div class="border-t pt-4">
            <div class="grid grid-cols-2 gap-4 text-center">
                <div>
                    <p class="text-2xl font-bold text-gray-900">${totalCases}</p>
                    <p class="text-xs text-gray-500">Total Cases</p>
                </div>
                <div>
                    <p class="text-2xl font-bold text-green-600">${resolvedCases}</p>
                    <p class="text-xs text-gray-500">Resolved</p>
                </div>
                <div>
                    <p class="text-2xl font-bold text-orange-600">${pendingCases}</p>
                    <p class="text-xs text-gray-500">Pending</p>
                </div>
                <div>
                    <p class="text-2xl font-bold text-blue-600">${todayResolved}</p>
                    <p class="text-xs text-gray-500">Today</p>
                </div>
            </div>
            
            <!-- Additional Metrics -->
            <div class="mt-4 pt-4 border-t">
                <div class="flex justify-between text-sm">
                    <span class="text-gray-500">Resolution Rate:</span>
                    <span class="font-medium">${resolutionRate}%</span>
                </div>
                ${avgResponseTime ? `
                    <div class="flex justify-between text-sm mt-1">
                        <span class="text-gray-500">Avg Response:</span>
                        <span class="font-medium">${avgResponseTime}m</span>
                    </div>
                ` : ''}
                <div class="flex justify-between text-sm mt-1">
                    <span class="text-gray-500">Max Concurrent:</span>
                    <span class="font-medium">${agent.max_concurrent_cases || 10}</span>
                </div>
            </div>
        </div>
    `;

    return div;
}

/**
 * Show chart error message
 */
function showChartError(canvasId, message) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#ef4444';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('⚠️ ' + message, canvas.width / 2, canvas.height / 2);
}

/**
 * Destroy all charts (cleanup) - IMPROVED VERSION
 */
function destroyAllCharts() {
    console.log('🧹 Destroying all existing charts...');
    
    if (app && app.charts) {
        Object.keys(app.charts).forEach(chartKey => {
            if (app.charts[chartKey] && typeof app.charts[chartKey].destroy === 'function') {
                try {
                    app.charts[chartKey].destroy();
                    console.log(`✅ Destroyed chart: ${chartKey}`);
                } catch (error) {
                    console.warn(`⚠️ Error destroying chart ${chartKey}:`, error);
                }
                app.charts[chartKey] = null;
            }
        });
        app.charts = {};
    }
    
    // Also clear any orphaned Chart.js instances
    if (window.Chart && window.Chart.instances) {
        window.Chart.instances.forEach(instance => {
            try {
                instance.destroy();
            } catch (error) {
                console.warn('Error destroying Chart.js instance:', error);
            }
        });
    }
}

// Utility function (make sure it exists)
function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
