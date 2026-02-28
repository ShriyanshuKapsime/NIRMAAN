// =============================================
// NIRMAAN — Admin Dashboard Frontend Logic
// =============================================

const API_BASE = window.location.origin;

// --- Fetch and Render Projects on Page Load ---
document.addEventListener('DOMContentLoaded', () => {
    fetchProjects();
});

async function fetchProjects() {
    try {
        const res = await fetch(`${API_BASE}/api/projects`);
        const projects = await res.json();

        renderProjects(projects);
        updateStats(projects);
    } catch (err) {
        console.error('Error fetching projects:', err);
    }
}


// --- Render Project Cards into the DOM ---
function renderProjects(projects) {
    const ongoingList = document.getElementById('ongoingList');
    const completedList = document.getElementById('completedList');

    // Separate ongoing vs completed
    const ongoing = projects.filter(p => p.status !== 'Completed');
    const completed = projects.filter(p => p.status === 'Completed');

    // Render ongoing
    if (ongoing.length === 0) {
        ongoingList.innerHTML = `
            <div class="bg-white border border-slate-200 rounded-xl p-8 text-center">
                <svg class="w-12 h-12 mx-auto text-slate-300 mb-3" fill="none" stroke="currentColor" stroke-width="1" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/>
                </svg>
                <h3 class="font-semibold text-slate-700 mb-1">No Ongoing Projects</h3>
                <p class="text-sm text-slate-400">Click the "+" button to create your first project.</p>
            </div>`;
    } else {
        ongoingList.innerHTML = ongoing.map(p => buildProjectCard(p)).join('');
    }

    // Render completed
    if (completed.length === 0) {
        completedList.innerHTML = `
            <div class="bg-white border border-slate-200 rounded-xl p-8 text-center">
                <svg class="w-12 h-12 mx-auto text-slate-300 mb-3" fill="none" stroke="currentColor" stroke-width="1" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <h3 class="font-semibold text-slate-700 mb-1">No Completed Projects Yet</h3>
                <p class="text-sm text-slate-400">Completed projects will appear here.</p>
            </div>`;
    } else {
        completedList.innerHTML = completed.map(p => buildProjectCard(p)).join('');
    }
}


// --- Build a Single Project Card HTML ---
function buildProjectCard(project) {
    const badge = getStatusBadge(project.status);
    const progressColor = project.status === 'Approval Requested' ? 'bg-emerald-500'
        : project.status === 'Delayed' ? 'bg-red-500'
            : project.progress > 50 ? 'bg-blue-900'
                : 'bg-orange-500';

    const photoHTML = project.sitePhoto
        ? `<img src="${project.sitePhoto}" alt="Site photo" class="w-full h-full object-cover"/>`
        : `<div class="text-center px-4">
                <svg class="w-10 h-10 mx-auto text-slate-300 mb-2" fill="none" stroke="currentColor" stroke-width="1" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"/>
                </svg>
                <p class="text-xs text-slate-400">No Photo</p>
           </div>`;

    const budgetDisplay = project.budget ? `₹${project.budget}` : 'N/A';

    const deadlineDate = project.deadline ? new Date(project.deadline) : null;
    const deadlineStr = deadlineDate ? deadlineDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

    return `
    <div class="project-card bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col md:flex-row">
        <div class="md:w-56 h-44 md:h-auto bg-slate-100 flex items-center justify-center flex-shrink-0 relative overflow-hidden">
            ${photoHTML}
        </div>
        <div class="flex-1 p-6">
            <div class="flex items-start justify-between gap-4 mb-3">
                <div>
                    <h3 class="font-bold text-base text-slate-900 mb-0.5">${project.name}</h3>
                    <p class="text-sm text-slate-400 flex items-center gap-1">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/></svg>
                        ${project.location}
                    </p>
                </div>
                ${badge}
            </div>
            <p class="text-sm text-slate-500 mb-1">Contractor: <span class="text-slate-700 font-medium">${project.contractorName}</span></p>
            <div class="flex items-center gap-4 mb-4">
                <p class="text-sm text-slate-500">Budget: <span class="text-slate-700 font-medium">${budgetDisplay}</span></p>
                ${deadlineStr ? `<p class="text-sm text-slate-500">Deadline: <span class="text-slate-700 font-medium">${deadlineStr}</span></p>` : ''}
            </div>
            <div class="flex items-center gap-3">
                <div class="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div class="progress-fill h-full ${progressColor} rounded-full" style="width: ${project.progress}%"></div>
                </div>
                <span class="text-xs font-semibold text-slate-500 w-10 text-right">${project.progress}%</span>
            </div>
        </div>
        <div class="flex md:flex-col items-center justify-center gap-3 p-4 md:p-6 md:border-l border-t md:border-t-0 border-slate-100">
            <a href="project-details.html?id=${project._id}" class="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all">
                View More
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/></svg>
            </a>
        </div>
    </div>`;
}


// --- Status Badge Generator ---
function getStatusBadge(status) {
    const badges = {
        'Approval Requested': {
            bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500'
        },
        'Ongoing': {
            bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400'
        },
        'Delayed': {
            bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500'
        },
        'Completed': {
            bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500'
        }
    };

    const b = badges[status] || badges['Ongoing'];

    return `<span class="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full ${b.bg} ${b.text} text-xs font-semibold">
                <span class="w-1.5 h-1.5 rounded-full ${b.dot}"></span>
                ${status}
            </span>`;
}


// --- Update Stat Cards ---
function updateStats(projects) {
    const total = projects.length;
    const inProgress = projects.filter(p => p.status === 'Ongoing' || p.status === 'Delayed').length;
    const approvals = projects.filter(p => p.status === 'Approval Requested').length;
    const completed = projects.filter(p => p.status === 'Completed').length;

    const statEls = document.querySelectorAll('.grid.grid-cols-2 .text-2xl.font-bold');
    if (statEls.length >= 4) {
        statEls[0].textContent = total;
        statEls[1].textContent = inProgress;
        statEls[2].textContent = approvals;
        statEls[3].textContent = completed;
    }
}


// --- Handle Form Submission (Create Project) ---
async function handleCreateProject(e) {
    e.preventDefault();

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Creating...';
    submitBtn.disabled = true;

    try {
        const formData = new FormData();
        formData.append('name', document.getElementById('workName').value.trim());
        formData.append('location', document.getElementById('workLocation').value.trim());
        formData.append('contractorName', document.getElementById('workContractor').value.trim());
        formData.append('contractorEmail', document.getElementById('workContractorEmail').value.trim());
        formData.append('budget', document.getElementById('workBudget').value.trim());
        formData.append('deadline', document.getElementById('workDeadline').value);

        const fileInput = document.getElementById('fileInput');
        if (fileInput.files.length > 0) {
            formData.append('sitePhoto', fileInput.files[0]);
        }

        const res = await fetch(`${API_BASE}/api/projects`, {
            method: 'POST',
            body: formData
            // Note: Do NOT set Content-Type header — browser sets multipart boundary automatically
        });

        const data = await res.json();

        if (res.ok) {
            showToast('Project created successfully!', 'success');
            closeAddModal();
            fetchProjects(); // Refresh the list
        } else {
            showToast(data.message || 'Failed to create project.', 'error');
        }
    } catch (err) {
        console.error('Error creating project:', err);
        showToast('Network error. Please try again.', 'error');
    }

    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
}


// --- Toast Notification ---
function showToast(msg, type) {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'fixed top-6 right-6 z-[60] flex flex-col gap-3';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-emerald-600' : 'bg-red-600';
    toast.className = `${bgColor} text-white px-5 py-3 rounded-lg shadow-lg text-sm font-medium`;
    toast.style.animation = 'toastIn 0.4s ease, toastOut 0.4s ease 2.6s forwards';
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
}
