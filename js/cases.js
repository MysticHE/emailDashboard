/**
 * Case Management Functions
 * Handles case listing, filtering, and case detail modal
 */

/**
 * Load and display cases section
 */
async function loadCasesSection() {
    try {
        await Promise.all([
            loadCasesTable(),
            populateAgentFilter()
        ]);
    } catch (error) {
        console.error('Error loading cases section:', error);
        showNotification('Failed to load cases section', 'error');
    }
}

/**
 * Load cases table with current filters
 */
async function loadCasesTable(filters = {}) {
    if (!app || !app.supabase) {
        console.error('App not initialized');
        return;
    }

    try {
        let query = app.supabase
            .from('cases')
            .select(`
                *,
                agents(name, email),
                email_threads(subject),
                providers(name)
            `);

        // Apply filters
        if (filters.status) {
            query = query.eq('status', filters.status);
        }
        if (filters.priority) {
            query = query.eq('priority', filters.priority);
        }
        if (filters.agent_id) {
            query = query.eq('agent_id', filters.agent_id);
        }

        const { data: cases, error } = await query
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw error;

        renderCasesTable(cases);

    } catch (error) {
        console.error('Error loading cases table:', error);
        document.getElementById('casesTableBody').innerHTML = `
            <tr>
                <td colspan="8" class="px-6 py-4 text-center text-red-500">
                    Error loading cases: ${error.message}
                </td>
            </tr>
        `;
    }
}

/**
 * Render cases in table
 */
function renderCasesTable(cases) {
    const tbody = document.getElementById('casesTableBody');
    
    if (!cases || cases.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="px-6 py-8 text-center text-gray-500">
                    <i class="fas fa-inbox text-4xl mb-4 block text-gray-300"></i>
                    <p class="text-lg font-medium">No cases found</p>
                    <p class="text-sm">Cases will appear here when emails are processed by the n8n workflow.</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = '';
    
    cases.forEach(case_item => {
        const row = createDetailedCaseRow(case_item);
        tbody.appendChild(row);
    });
}

/**
 * Create detailed case row for cases table
 */
function createDetailedCaseRow(case_item) {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50 cursor-pointer transition-colors';
    
    const priorityConfig = {
        'vip': { bg: 'bg-purple-100', text: 'text-purple-800', icon: '👑' },
        'urgent': { bg: 'bg-red-100', text: 'text-red-800', icon: '🚨' },
        'normal': { bg: 'bg-blue-100', text: 'text-blue-800', icon: '📧' },
        'low': { bg: 'bg-gray-100', text: 'text-gray-800', icon: '📝' }
    };
    
    const statusConfig = {
        'new': { bg: 'bg-green-100', text: 'text-green-800' },
        'assigned': { bg: 'bg-blue-100', text: 'text-blue-800' },
        'in_progress': { bg: 'bg-yellow-100', text: 'text-yellow-800' },
        'pending_customer': { bg: 'bg-orange-100', text: 'text-orange-800' },
        'resolved': { bg: 'bg-gray-100', text: 'text-gray-800' },
        'closed': { bg: 'bg-gray-100', text: 'text-gray-600' }
    };
    
    const priority = priorityConfig[case_item.priority] || priorityConfig['normal'];
    const status = statusConfig[case_item.status] || statusConfig['new'];
    
    const tat = calculateTAT(case_item.created_at, case_item.resolved_at);
    const isOverdue = isCaseOverdue(case_item);
    const subject = case_item.email_threads?.subject || 'No subject';
    
    tr.innerHTML = `
        <td class="px-6 py-4 whitespace-nowrap">
            <div class="flex items-center">
                <span class="text-sm font-medium text-gray-900">${case_item.case_number}</span>
                ${isOverdue ? '<span class="ml-2 text-red-500 text-xs" title="Overdue">⚠️</span>' : ''}
            </div>
        </td>
        <td class="px-6 py-4">
            <div class="text-sm text-gray-900 max-w-xs">
                <p class="truncate font-medium">${truncateText(subject, 40)}</p>
                ${case_item.providers?.name ? `<p class="text-xs text-gray-500">${case_item.providers.name}</p>` : ''}
            </div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${priority.bg} ${priority.text}">
                ${priority.icon} ${capitalize(case_item.priority)}
            </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.text}">
                ${formatStatus(case_item.status)}
            </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
            ${case_item.agents?.name || '<span class="text-gray-400 italic">Unassigned</span>'}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            ${formatDate(case_item.created_at)}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}">
            ${tat}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
            <div class="flex space-x-2">
                <button 
                    onclick="event.stopPropagation(); openCaseModal('${case_item.id}')" 
                    class="text-blue-600 hover:text-blue-900 transition-colors"
                    title="View Details"
                >
                    <i class="fas fa-eye"></i>
                </button>
                <button 
                    onclick="event.stopPropagation(); quickUpdateStatus('${case_item.id}', '${case_item.status}')" 
                    class="text-green-600 hover:text-green-900 transition-colors"
                    title="Quick Update"
                >
                    <i class="fas fa-edit"></i>
                </button>
            </div>
        </td>
    `;
    
    // Add click handler for row
    tr.onclick = () => openCaseModal(case_item.id);
    
    return tr;
}

/**
 * Check if case is overdue based on SLA
 */
function isCaseOverdue(case_item) {
    if (['resolved', 'closed'].includes(case_item.status)) {
        return false;
    }
    
    const created = new Date(case_item.created_at);
    const now = new Date();
    const hoursOpen = (now - created) / (1000 * 60 * 60);
    
    // SLA hours based on priority
    const slaHours = {
        'vip': 4,
        'urgent': 8,
        'normal': 24,
        'low': 48
    };
    
    const maxHours = slaHours[case_item.priority] || 24;
    return hoursOpen > maxHours;
}

/**
 * Populate agent filter dropdown
 */
async function populateAgentFilter() {
    if (!app || !app.supabase) return;
    
    try {
        const { data: agents, error } = await app.supabase
            .from('agents')
            .select('id, name')
            .order('name');
            
        if (error) throw error;
        
        const select = document.getElementById('agentFilter');
        const currentValue = select.value;
        
        // Clear existing options except "All Agents"
        select.innerHTML = '<option value="">All Agents</option>';
        
        agents.forEach(agent => {
            const option = document.createElement('option');
            option.value = agent.id;
            option.textContent = agent.name;
            select.appendChild(option);
        });
        
        // Restore previous selection
        select.value = currentValue;
        
    } catch (error) {
        console.error('Error loading agents for filter:', error);
    }
}

/**
 * Apply case filters
 */
function filterCases() {
    const filters = {
        status: document.getElementById('statusFilter').value,
        priority: document.getElementById('priorityFilter').value,
        agent_id: document.getElementById('agentFilter').value
    };
    
    // Remove empty filters
    Object.keys(filters).forEach(key => {
        if (!filters[key]) delete filters[key];
    });
    
    loadCasesTable(filters);
}

/**
 * Open case detail modal
 */
async function openCaseModal(caseId) {
    if (!app || !app.supabase || !caseId) {
        console.error('Cannot open case modal: app not initialized or missing case ID');
        return;
    }

    try {
        // Show loading state
        document.getElementById('caseModal').classList.remove('hidden');
        document.getElementById('modalCaseNumber').textContent = 'Loading...';
        document.getElementById('modalContent').innerHTML = `
            <div class="flex items-center justify-center py-8">
                <i class="fas fa-spinner fa-spin text-2xl text-gray-400"></i>
                <span class="ml-2 text-gray-500">Loading case details...</span>
            </div>
        `;

        // Get complete case details
        const { data: caseData, error: caseError } = await app.supabase
            .from('cases')
            .select(`
                *,
                agents(name, email),
                email_threads(subject, participants),
                providers(name)
            `)
            .eq('id', caseId)
            .single();
            
        if (caseError) throw caseError;
        
        // Get all emails in this thread
        const { data: emails, error: emailError } = await app.supabase
            .from('emails')
            .select('*')
            .eq('case_id', caseId)
            .order('sent_at', { ascending: true });
            
        if (emailError) throw emailError;
        
        // Get follow-ups
        const { data: followUps, error: followUpError } = await app.supabase
            .from('follow_ups')
            .select('*')
            .eq('case_id', caseId)
            .order('scheduled_for', { ascending: true });
            
        if (followUpError) console.warn('Could not load follow-ups:', followUpError);
        
        // Render modal content
        renderCaseModal(caseData, emails, followUps || []);
        
    } catch (error) {
        console.error('Error loading case details:', error);
        document.getElementById('modalContent').innerHTML = `
            <div class="text-center py-8">
                <i class="fas fa-exclamation-triangle text-2xl text-red-400 mb-2"></i>
                <p class="text-red-600">Failed to load case details</p>
                <p class="text-sm text-gray-500">${error.message}</p>
            </div>
        `;
    }
}

/**
 * Render case modal content
 */
function renderCaseModal(caseData, emails, followUps) {
    document.getElementById('modalCaseNumber').textContent = caseData.case_number;
    
    const modalContent = document.getElementById('modalContent');
    modalContent.innerHTML = `
        <div class="space-y-6">
            <!-- Case Info -->
            <div class="bg-gray-50 p-4 rounded-lg">
                <h4 class="font-medium text-gray-900 mb-3">Case Information</h4>
                <div class="grid grid-cols-2 gap-4 text-sm">
                    <div><span class="font-medium text-gray-700">Status:</span> 
                        <span class="ml-1 px-2 py-1 rounded text-xs ${getStatusColor(caseData.status)}">${formatStatus(caseData.status)}</span>
                    </div>
                    <div><span class="font-medium text-gray-700">Priority:</span> 
                        <span class="ml-1 px-2 py-1 rounded text-xs ${getPriorityColor(caseData.priority)}">${capitalize(caseData.priority)}</span>
                    </div>
                    <div><span class="font-medium text-gray-700">Category:</span> ${caseData.category || 'Not categorized'}</div>
                    <div><span class="font-medium text-gray-700">Agent:</span> ${caseData.agents?.name || 'Unassigned'}</div>
                    <div><span class="font-medium text-gray-700">Created:</span> ${formatDate(caseData.created_at, 'long')}</div>
                    <div><span class="font-medium text-gray-700">Provider:</span> ${caseData.providers?.name || 'Unknown'}</div>
                    ${caseData.resolved_at ? `
                        <div><span class="font-medium text-gray-700">Resolved:</span> ${formatDate(caseData.resolved_at, 'long')}</div>
                        <div><span class="font-medium text-gray-700">Resolution Time:</span> ${calculateTAT(caseData.created_at, caseData.resolved_at)}</div>
                    ` : ''}
                </div>
                
                <!-- Metadata (if exists) -->
                ${caseData.metadata ? renderMetadata(caseData.metadata) : ''}
            </div>
            
            <!-- Email Thread -->
            <div>
                <h4 class="font-medium text-gray-900 mb-3">
                    Email Conversation 
                    <span class="text-sm text-gray-500">(${emails.length} message${emails.length !== 1 ? 's' : ''})</span>
                </h4>
                <div class="space-y-3 max-h-96 overflow-y-auto border rounded-lg p-4 bg-gray-50">
                    ${emails.length > 0 ? emails.map(email => renderEmailMessage(email)).join('') : '<p class="text-gray-500">No emails found</p>'}
                </div>
            </div>
            
            <!-- Follow-ups -->
            ${followUps.length > 0 ? `
                <div>
                    <h4 class="font-medium text-gray-900 mb-3">Scheduled Follow-ups</h4>
                    <div class="space-y-2">
                        ${followUps.map(followUp => renderFollowUp(followUp)).join('')}
                    </div>
                </div>
            ` : ''}
            
            <!-- Case Actions -->
            <div class="flex flex-wrap gap-3 pt-4 border-t">
                ${renderCaseActions(caseData)}
            </div>
        </div>
    `;
}

/**
 * Render email message in modal
 */
function renderEmailMessage(email) {
    const isFromSupport = email.from_email.includes('@' + (window.location.hostname || 'company.com'));
    
    return `
        <div class="border rounded-lg p-3 ${isFromSupport ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}">
            <div class="flex justify-between items-start text-sm text-gray-500 mb-2">
                <div>
                    <span class="font-medium ${isFromSupport ? 'text-blue-700' : 'text-gray-700'}">
                        ${isFromSupport ? '👤 Support Agent' : '📧 Customer'}: ${email.from_email}
                    </span>
                    ${email.to_emails ? `
                        <div class="text-xs text-gray-400 mt-1">
                            To: ${Array.isArray(email.to_emails) ? email.to_emails.join(', ') : email.to_emails}
                        </div>
                    ` : ''}
                </div>
                <span class="text-xs">${formatDate(email.sent_at)}</span>
            </div>
            
            ${email.subject ? `
                <div class="text-sm text-gray-700 mb-2">
                    <strong>Subject:</strong> ${email.subject}
                </div>
            ` : ''}
            
            <div class="text-sm text-gray-800 whitespace-pre-wrap bg-white p-3 rounded border">
                ${email.body_plain || 'No content available'}
            </div>
            
            ${email.intent || email.sentiment ? `
                <div class="mt-2 flex flex-wrap gap-1">
                    ${email.intent ? `<span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">${email.intent}</span>` : ''}
                    ${email.sentiment ? `<span class="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">${email.sentiment}</span>` : ''}
                    ${email.urgency_score ? `<span class="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">Urgency: ${email.urgency_score}/10</span>` : ''}
                </div>
            ` : ''}
        </div>
    `;
}

/**
 * Render follow-up information
 */
function renderFollowUp(followUp) {
    const statusColors = {
        'pending': 'bg-yellow-100 text-yellow-800',
        'sent': 'bg-green-100 text-green-800',
        'cancelled': 'bg-gray-100 text-gray-800'
    };
    
    return `
        <div class="flex justify-between items-center p-3 bg-orange-50 rounded border">
            <div>
                <span class="text-sm font-medium">Stage ${followUp.stage} - ${capitalize(followUp.type)}</span>
                ${followUp.template_used ? `<span class="text-xs text-gray-500 ml-2">(${followUp.template_used})</span>` : ''}
            </div>
            <div class="text-right">
                <div class="text-sm text-gray-600">${formatDate(followUp.scheduled_for)}</div>
                <span class="px-2 py-1 text-xs rounded ${statusColors[followUp.status] || 'bg-gray-100 text-gray-800'}">${followUp.status}</span>
            </div>
        </div>
    `;
}

/**
 * Render case metadata
 */
function renderMetadata(metadata) {
    if (typeof metadata === 'string') {
        metadata = safeJsonParse(metadata, {});
    }
    
    if (!metadata || typeof metadata !== 'object') return '';
    
    const items = [];
    
    if (metadata.urgency_score) {
        items.push(`<span class="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Urgency: ${metadata.urgency_score}/10</span>`);
    }
    
    if (metadata.is_vip_domain) {
        items.push(`<span class="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">VIP Domain</span>`);
    }
    
    if (metadata.is_senior_mgmt) {
        items.push(`<span class="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">Senior Management</span>`);
    }
    
    if (items.length === 0) return '';
    
    return `
        <div class="mt-3 pt-3 border-t">
            <span class="text-xs font-medium text-gray-700">Metadata:</span>
            <div class="mt-1 flex flex-wrap gap-1">
                ${items.join('')}
            </div>
        </div>
    `;
}

/**
 * Render case action buttons
 */
function renderCaseActions(caseData) {
    const actions = [];
    
    if (caseData.status === 'new') {
        actions.push(`
            <button onclick="updateCaseStatus('${caseData.id}', 'in_progress')" 
                    class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">
                <i class="fas fa-play mr-1"></i>Start Working
            </button>
        `);
    }
    
    if (['new', 'assigned', 'in_progress'].includes(caseData.status)) {
        actions.push(`
            <button onclick="updateCaseStatus('${caseData.id}', 'resolved')" 
                    class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors">
                <i class="fas fa-check mr-1"></i>Mark Resolved
            </button>
        `);
    }
    
    if (caseData.status !== 'resolved') {
        actions.push(`
            <button onclick="escalateCase('${caseData.id}')" 
                    class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors">
                <i class="fas fa-arrow-up mr-1"></i>Escalate
            </button>
        `);
    }
    
    actions.push(`
        <button onclick="copyToClipboard('${caseData.case_number}').then(success => success && showNotification('Case number copied!', 'success'))" 
                class="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors">
            <i class="fas fa-copy mr-1"></i>Copy Case #
        </button>
    `);
    
    return actions.join('');
}

/**
 * Get status color classes
 */
function getStatusColor(status) {
    const colors = {
        'new': 'bg-green-100 text-green-800',
        'assigned': 'bg-blue-100 text-blue-800',
        'in_progress': 'bg-yellow-100 text-yellow-800',
        'pending_customer': 'bg-orange-100 text-orange-800',
        'resolved': 'bg-gray-100 text-gray-800',
        'closed': 'bg-gray-100 text-gray-600'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
}

/**
 * Get priority color classes
 */
function getPriorityColor(priority) {
    const colors = {
        'vip': 'bg-purple-100 text-purple-800',
        'urgent': 'bg-red-100 text-red-800',
        'normal': 'bg-blue-100 text-blue-800',
        'low': 'bg-gray-100 text-gray-800'
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
}

/**
 * Close case modal
 */
function closeCaseModal() {
    document.getElementById('caseModal').classList.add('hidden');
}

/**
 * Update case status
 */
async function updateCaseStatus(caseId, newStatus) {
    if (!app || !app.supabase) {
        showNotification('App not initialized', 'error');
        return;
    }

    try {
        const updates = { status: newStatus };
        
        if (newStatus === 'resolved') {
            updates.resolved_at = new Date().toISOString();
        } else if (newStatus === 'in_progress') {
            updates.first_response_at = new Date().toISOString();
        }
        
        const { error } = await app.supabase
            .from('cases')
            .update(updates)
            .eq('id', caseId);
            
        if (error) throw error;
        
        // Close modal and refresh data
        closeCaseModal();
        loadCasesTable();
        if (app.loadDashboardData) {
            app.loadDashboardData();
        }
        
        showNotification(`Case status updated to ${formatStatus(newStatus)}`, 'success');
        
    } catch (error) {
        console.error('Error updating case status:', error);
        showNotification('Failed to update case status', 'error');
    }
}

/**
 * Quick status update from table
 */
async function quickUpdateStatus(caseId, currentStatus) {
    const nextStatus = {
        'new': 'assigned',
        'assigned': 'in_progress',
        'in_progress': 'resolved',
        'pending_customer': 'in_progress',
        'resolved': 'closed'
    };
    
    const next = nextStatus[currentStatus];
    if (next) {
        await updateCaseStatus(caseId, next);
    } else {
        showNotification('No quick update available for this status', 'info');
    }
}

/**
 * Escalate case
 */
async function escalateCase(caseId) {
    if (!confirm('Are you sure you want to escalate this case? This will notify management.')) {
        return;
    }
    
    try {
        // Update case priority to urgent if not already VIP
        const { data: caseData, error: getError } = await app.supabase
            .from('cases')
            .select('priority')
            .eq('id', caseId)
            .single();
            
        if (getError) throw getError;
        
        const updates = {
            status: 'escalated',
            priority: caseData.priority === 'vip' ? 'vip' : 'urgent'
        };
        
        const { error } = await app.supabase
            .from('cases')
            .update(updates)
            .eq('id', caseId);
            
        if (error) throw error;
        
        closeCaseModal();
        loadCasesTable();
        showNotification('Case escalated successfully', 'success');
        
    } catch (error) {
        console.error('Error escalating case:', error);
        showNotification('Failed to escalate case', 'error');
    }
}
