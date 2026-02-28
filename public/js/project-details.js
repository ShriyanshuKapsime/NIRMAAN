// =============================================
// NIRMAAN — Project Details Frontend Logic
// =============================================

const API = window.location.origin;

// Get project ID from URL query param: ?id=...
const urlParams = new URLSearchParams(window.location.search);
const projectId = urlParams.get('id');

let projectData = null;
let allRequests = [];
let allReports = [];

// --- Init on DOM ready ---
document.addEventListener('DOMContentLoaded', async () => {
    if (!projectId) {
        document.querySelector('main').innerHTML = '<div class="text-center py-20"><h2 class="text-xl font-bold text-slate-700">No project ID specified.</h2><a href="admin.html" class="text-orange-500 hover:underline mt-2 inline-block">← Back to Dashboard</a></div>';
        return;
    }
    await loadProject();
    await Promise.all([loadRequests(), loadReports()]);
    await calculateDynamicRating();
});


// ======================
// LOAD PROJECT SUMMARY
// ======================
async function loadProject() {
    try {
        const res = await fetch(`${API}/api/projects/${projectId}`, {
            headers: { 'Cache-Control': 'no-cache' }
        });
        if (!res.ok) throw new Error('Project not found');
        projectData = await res.json();
        renderProjectSummary(projectData);
    } catch (err) {
        console.error(err);
    }
}

function renderProjectSummary(p) {
    document.getElementById('projName').textContent = p.name;
    const locEl = document.getElementById('projLocation');
    locEl.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/></svg> ${p.location}`;
    document.getElementById('projPct').textContent = p.progress + '%';
    document.getElementById('projBar').style.width = p.progress + '%';
    document.getElementById('projContractor').textContent = p.contractorName;
    document.getElementById('projEmail').textContent = p.contractorEmail || '—';

    // Status badge
    const badgeEl = document.getElementById('projBadge');
    const badges = {
        'Ongoing': { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
        'Approval Requested': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
        'Completed': { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' }
    };
    const b = badges[p.status] || badges['Ongoing'];
    badgeEl.className = `inline-flex items-center gap-1 px-3 py-1 rounded-full ${b.bg} ${b.text} text-xs font-semibold`;
    badgeEl.innerHTML = `<span class="w-1.5 h-1.5 rounded-full ${b.dot}"></span> ${p.status}`;

    // Site photo
    if (p.sitePhoto) {
        const photoDiv = document.getElementById('summaryPhoto');
        photoDiv.innerHTML = `<img src="${p.sitePhoto}" alt="Site photo" class="w-full h-full object-cover"/>`;
        photoDiv.parentElement.classList.remove('flex', 'items-center', 'justify-center');
    }
}


// ======================
// TAB 1: CONTRACTOR REQUESTS
// ======================
async function loadRequests() {
    try {
        const res = await fetch(`${API}/api/projects/${projectId}/requests`, {
            headers: { 'Cache-Control': 'no-cache' }
        });
        allRequests = await res.json();
        renderRequests();
        renderHistory();
    } catch (err) {
        console.error(err);
    }
}

function renderRequests() {
    const panel = document.getElementById('panelRequests');
    const pending = allRequests.filter(r => r.status === 'Pending');

    if (pending.length === 0) {
        panel.innerHTML = `<div class="bg-white border border-slate-200 rounded-xl p-8 text-center">...</div>`;
        return;
    }

    panel.innerHTML = '<div class="flex flex-col gap-4" id="requests-list-container">' + pending.map(r => {
        const date = new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        const reqId = 'REQ-' + r._id.slice(-6).toUpperCase();

        // We no longer put the data inside the onclick. We store it in "data-" attributes.
        return `
        <div class="bg-white border border-slate-200 rounded-xl p-6 flex flex-col md:flex-row md:items-center gap-4 justify-between">
            <div class="flex-1">
                <div class="flex items-center gap-2 mb-2">
                    <span class="text-xs font-semibold bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full">Pending Review</span>
                    <span class="text-xs text-slate-400">${reqId} · ${date}</span>
                </div>
                <h3 class="font-bold text-base text-slate-900 mb-1">Progress Update: ${r.previousProgress}% → ${r.progressClaimed}%</h3>
                <p class="text-sm text-slate-500">${r.description || ''}</p>
            </div>
            <button 
                data-id="${r._id}" 
                data-from="${r.previousProgress}" 
                data-to="${r.progressClaimed}" 
                data-photo="${r.photoUrl}" 
                data-desc="${(r.description || '').replace(/"/g, '&quot;')}"
                class="review-trigger-btn px-5 py-2.5 bg-blue-900 text-white text-sm font-semibold rounded-lg hover:bg-blue-800 transition-colors flex-shrink-0">
                Review Request
            </button>
        </div>`;
    }).join('') + '</div>';

    // Call the function to attach the safe listeners
    attachSafeListeners();
}
// --- Approval Modal ---
let currentReviewId = null;

function openReviewModal(reqId, from, to, photo, desc) {
    currentReviewId = reqId;
    document.getElementById('modalReqId').textContent = 'REQ-' + reqId.slice(-6).toUpperCase();
    document.getElementById('modalFrom').textContent = from + '%';
    document.getElementById('modalTo').textContent = to + '%';

    // Photo
    const photoGrid = document.getElementById('modalPhotos');
    if (photo && photo !== 'undefined') {
        photoGrid.innerHTML = `<img src="${photo}" alt="Site photo" class="h-24 rounded-lg object-cover col-span-3"/>`;
    } else {
        photoGrid.innerHTML = '<div class="h-24 bg-slate-100 rounded-lg flex items-center justify-center col-span-3"><p class="text-xs text-slate-400">No photos uploaded</p></div>';
    }

    // Description
    // Render description — convert GPS coords to clickable map links
    // Inside openReviewModal()
    let descHtml = (desc || 'No details provided.').replace(/\n/g, '<br>');

    // FIXED REGEX AND TEMPLATE LITERAL
    descHtml = descHtml.replace(
        /GPS:\s*([-\d.]+),\s*([-\d.]+)/g,
        (match, lat, lon) => `📍 GPS: ${lat}, ${lon} <a href="https://www.google.com/maps?q=${lat},${lon}" target="_blank" class="text-xs text-blue-600 hover:underline ml-1 font-bold">[View on Map]</a>`
    );
    document.getElementById('modalDesc').innerHTML = descHtml;

    const m = document.getElementById('approvalModal');
    m.classList.remove('hidden');
    m.classList.add('flex');
}

function closeApprovalModal() {
    const m = document.getElementById('approvalModal');
    m.classList.add('hidden');
    m.classList.remove('flex');
    currentReviewId = null;
    document.getElementById('adminCommentField').value = '';
}

// Close on backdrop / escape
document.getElementById('approvalModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeApprovalModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeApprovalModal(); });

async function verifyRequest(status) {
    if (!currentReviewId) return;
    const comment = document.getElementById('adminCommentField').value.trim();

    try {
        const res = await fetch(`${API}/api/projects/requests/${currentReviewId}/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status, adminComment: comment })
        });
        const data = await res.json();
        if (res.ok) {
            showToast(`Request ${status.toLowerCase()} successfully!`, 'success');
            closeApprovalModal();
            await loadProject();
            await loadRequests();
        } else {
            showToast(data.message || 'Action failed.', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Network error.', 'error');
    }
}


// ======================
// TAB 2: CITIZEN REPORTS
// ======================
async function loadReports() {
    try {
        const res = await fetch(`${API}/api/projects/${projectId}/reports`, {
            headers: { 'Cache-Control': 'no-cache' }
        });
        allReports = await res.json();
        renderReports();
    } catch (err) {
        console.error(err);
    }
}

function renderReports() {
    const container = document.getElementById('reportsContainer');
    if (!container) return;

    if (allReports.length === 0) {
        container.innerHTML = `<div class="bg-white border border-slate-200 rounded-xl p-8 text-center">
            <svg class="w-12 h-12 mx-auto text-slate-300 mb-3" fill="none" stroke="currentColor" stroke-width="1" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/></svg>
            <h3 class="font-semibold text-slate-700 mb-1">No Citizen Reports Yet</h3>
            <p class="text-sm text-slate-400">Reports from citizens will appear here once submitted.</p>
        </div>`;
        return;
    }

    container.innerHTML = allReports.map(r => {
        const date = new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        const reqId = r.requestId ? 'REQ-' + (r.requestId._id || r.requestId).toString().slice(-6).toUpperCase() : '—';
        const stars = renderStars(r.rating, 3);
        const trueV = r.trueVotes || 0;
        const fakeV = r.fakeVotes || 0;

        // Parse GPS from comment for View on Map link
        const gpsMatch = r.comment ? r.comment.match(/GPS:\s*([\d.]+),\s*([\d.]+)/) : null;
        const mapLink = gpsMatch
            ? `<a href="https://www.google.com/maps?q=${gpsMatch[1]},${gpsMatch[2]}" target="_blank" class="text-xs text-blue-600 hover:underline font-bold ml-2">📍 View on Map</a>`
            : '';

        return `
        <div class="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <button onclick="toggleAccordion(this)" class="w-full p-6 flex items-center gap-4 text-left hover:bg-slate-50 transition-colors">
                <div class="w-14 h-14 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    ${r.photoUrl ? `<img src="${r.photoUrl}" class="w-full h-full object-cover"/>` : '<svg class="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0"/></svg>'}
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                        <span class="text-sm font-bold text-slate-900">${r.citizenAnonId}</span>
                        <span class="text-xs text-slate-400">· ${date}</span>
                        <span class="text-xs text-slate-400">· Re: ${reqId}</span>
                    </div>
                    <p class="text-sm text-slate-500 truncate">"${r.comment}"</p>
                </div>
                <div class="flex items-center gap-3 flex-shrink-0">
                    <span class="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">▲ ${trueV} True</span>
                    ${fakeV > 0 ? `<span class="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded-full">▼ ${fakeV} Fake</span>` : ''}
                    <svg class="w-4 h-4 text-slate-400 transition-transform" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg>
                </div>
            </button>
            <div class="accordion-body">
                <div class="px-6 pb-6 pt-2 border-t border-slate-100">
                    ${r.photoUrl ? `<div class="mb-4"><img src="${r.photoUrl}" class="h-32 rounded-lg object-cover"/></div>` : ''}
                    <p class="text-sm text-slate-600 mb-3">"${r.comment}"${mapLink}</p>
                    <div class="flex items-center gap-4 flex-wrap">
                        <span class="text-xs text-slate-400">Request: <span class="font-semibold text-slate-700">${reqId}</span></span>
                        <div class="flex items-center gap-1"><span class="text-xs text-slate-400">Rating:</span>${stars}<span class="text-xs font-semibold text-slate-700">${r.rating}/5</span></div>
                        <span class="text-xs text-slate-400">Votes: <span class="text-emerald-600 font-semibold">${trueV} true</span> · <span class="text-red-500 font-semibold">${fakeV} fake</span></span>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');
}


// ======================
// DYNAMIC RATING CALCULATION
// ProjectRating = Σ(ReporterCredibility × ReportStars) / TotalReports
// ======================
async function calculateDynamicRating() {
    const starsEl = document.getElementById('starsContainer');
    const scoreEl = document.getElementById('ratingScore');
    const countEl = document.getElementById('ratingCount');

    if (!starsEl || !scoreEl) return;

    if (allReports.length === 0) {
        starsEl.innerHTML = '';
        scoreEl.textContent = 'No ratings yet';
        scoreEl.className = 'text-sm font-semibold text-slate-400';
        countEl.textContent = '';
        return;
    }

    // Fetch credibility for each unique reporter
    const credCache = {};
    const uniqueEmails = [...new Set(allReports.map(r => r.citizenAnonId).filter(e => e && e !== 'Anonymous_User'))];

    await Promise.all(uniqueEmails.map(async email => {
        try {
            const res = await fetch(`${API}/api/reports/credibility/${encodeURIComponent(email)}`);
            const data = await res.json();
            credCache[email] = data.credibilityScore;
        } catch {
            credCache[email] = 5.0; // Default
        }
    }));

    // Calculate weighted rating
    let weightedSum = 0;
    for (const r of allReports) {
        const cred = credCache[r.citizenAnonId] || 5.0;
        weightedSum += cred * (r.rating || 0);
    }
    const avgRating = Math.round((weightedSum / allReports.length) * 10) / 10;
    // Normalize to 5-point scale (credibility max is 5, stars max is 5, so max product is 25)
    const normalizedRating = Math.round((avgRating / 5) * 10) / 10;
    const displayRating = Math.min(5, Math.max(0, normalizedRating));

    // Render stars
    const fullStar = `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.065 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z"/></svg>`;
    const emptyStar = `<svg class="w-4 h-4 text-slate-200" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.065 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z"/></svg>`;
    let starsHtml = '';
    for (let i = 0; i < 5; i++) starsHtml += i < Math.round(displayRating) ? fullStar : emptyStar;
    starsEl.innerHTML = starsHtml;

    scoreEl.textContent = `${displayRating.toFixed(1)} / 5`;
    countEl.textContent = `(${allReports.length} citizen review${allReports.length !== 1 ? 's' : ''})`;
}

function renderStars(count, size) {
    const s = size || 3;
    const starSvg = `<svg class="w-${s} h-${s}" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.065 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z"/></svg>`;
    const emptyStar = `<svg class="w-${s} h-${s} text-slate-200" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.065 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z"/></svg>`;
    let html = '<div class="flex gap-0.5 text-orange-400">';
    for (let i = 0; i < 5; i++) html += i < count ? starSvg : emptyStar;
    html += '</div>';
    return html;
}


// ======================
// TAB 3: APPROVAL HISTORY
// ======================
function renderHistory() {
    const tbody = document.getElementById('historyBody');
    if (!tbody) return;

    const reviewed = allRequests.filter(r => r.status === 'Approved' || r.status === 'Rejected');

    if (reviewed.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-sm text-slate-400">No approval history yet.</td></tr>`;
        return;
    }

    tbody.innerHTML = reviewed.map(r => {
        const date = new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        const reqId = 'REQ-' + r._id.slice(-6).toUpperCase();
        const isApproved = r.status === 'Approved';
        const badgeBg = isApproved ? 'bg-emerald-50' : 'bg-red-50';
        const badgeText = isApproved ? 'text-emerald-700' : 'text-red-700';
        const badgeDot = isApproved ? 'bg-emerald-500' : 'bg-red-500';
        return `
        <tr class="border-b border-slate-50 hover:bg-slate-50 transition-colors">
            <td class="px-6 py-4 text-sm text-slate-600">${date}</td>
            <td class="px-6 py-4 text-sm font-mono font-semibold text-slate-800">${reqId}</td>
            <td class="px-6 py-4 text-sm text-slate-600">${r.previousProgress}% → ${r.progressClaimed}%</td>
            <td class="px-6 py-4"><span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full ${badgeBg} ${badgeText} text-xs font-semibold"><span class="w-1.5 h-1.5 rounded-full ${badgeDot}"></span>${r.status}</span></td>
            <td class="px-6 py-4 text-sm text-slate-500">${r.adminComment || '—'}</td>
        </tr>`;
    }).join('');
}


// ======================
// TAB SWITCHING
// ======================
function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('active');
        b.className = b.className.replace('text-slate-900 border-orange-500', 'text-slate-400').replace('font-semibold', 'font-medium');
    });
    const panels = { requests: 'panelRequests', reports: 'panelReports', history: 'panelHistory' };
    const tabs = { requests: 'tabRequests', reports: 'tabReports', history: 'tabHistory' };
    Object.values(panels).forEach(id => document.getElementById(id).classList.add('hidden'));
    document.getElementById(panels[tab]).classList.remove('hidden');
    const btn = document.getElementById(tabs[tab]);
    btn.classList.add('active');
    btn.className = btn.className.replace('text-slate-400', 'text-slate-900 border-orange-500').replace('font-medium', 'font-semibold');
}


// ======================
// ACCORDION
// ======================
function toggleAccordion(btn) {
    const body = btn.nextElementSibling;
    const chevron = btn.querySelector('svg:last-child');
    body.classList.toggle('open');
    chevron.style.transform = body.classList.contains('open') ? 'rotate(180deg)' : '';
}


// ======================
// TOAST
// ======================
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
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
}
function attachSafeListeners() {
    const container = document.getElementById('requests-list-container');
    if (!container) return;

    // This catches the click SAFELY without using the broken onclick attribute
    container.addEventListener('click', (e) => {
        const btn = e.target.closest('.review-trigger-btn');
        if (btn) {
            const id = btn.getAttribute('data-id');
            const from = btn.getAttribute('data-from');
            const to = btn.getAttribute('data-to');
            const photo = btn.getAttribute('data-photo');
            const desc = btn.getAttribute('data-desc');

            // Now we call your existing openReviewModal function
            openReviewModal(id, from, to, photo, desc);
        }
    });
}