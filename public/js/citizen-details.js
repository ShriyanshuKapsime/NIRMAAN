// =============================================
// NIRMAAN — Citizen Details Frontend Logic
// Camera enforcement, voting, counter-reports
// =============================================

const API = window.location.origin;
const projectId = new URLSearchParams(window.location.search).get('id');
const user = JSON.parse(localStorage.getItem('nirmaan_user') || 'null');
const citizenEmail = user ? user.email : 'Anonymous_User';

let allReports = [];
let allRequests = [];
let selectedRating = 0;

// Camera state
let cameraStream = null;
let capturedBlob = null;
let counterCameraStream = null;
let counterCapturedBlob = null;


// ======================
// INIT — Parallel fetch
// ======================
document.addEventListener('DOMContentLoaded', async () => {
    if (!projectId) {
        document.getElementById('projectName').textContent = 'No project specified.';
        return;
    }
    // Fetch all three data sources in parallel
    await Promise.all([loadProject(), loadRequests(), loadReports()]);
    renderCommunityFeed();
    renderVerificationFeed();
});


// ======================
// LOAD PROJECT
// ======================
async function loadProject() {
    try {
        const res = await fetch(`${API}/api/projects/${projectId}`);
        const p = await res.json();

        document.getElementById('projectName').textContent = p.name;
        document.getElementById('locationText').textContent = p.location;
        document.getElementById('progressBar').style.width = p.progress + '%';
        document.getElementById('progressPct').textContent = p.progress + '%';
        document.getElementById('contractorName').textContent = p.contractorName;
        document.getElementById('budgetText').textContent = p.budget
            ? `₹${!isNaN(Number(p.budget)) ? Number(p.budget).toLocaleString('en-IN') : p.budget}`
            : '—';

        const statusColors = { 'Ongoing': 'text-slate-600', 'Approval Requested': 'text-orange-600', 'Completed': 'text-emerald-600' };
        const badge = document.getElementById('statusBadge');
        badge.textContent = p.status;
        badge.className = `font-semibold ${statusColors[p.status] || 'text-slate-600'}`;

        // Banner photo
        const photoEl = document.getElementById('bannerPhoto');
        if (p.sitePhoto) {
            photoEl.innerHTML = `<img src="${p.sitePhoto}" alt="${p.name}" class="w-full h-full object-cover"/>`;
        }

        document.title = `${p.name} — NIRMAAN Citizen Portal`;

        // Fetch contractor rating
        try {
            const rRes = await fetch(`${API}/api/projects/ratings/all`);
            const ratingsMap = await rRes.json();
            const r = ratingsMap[p._id];
            document.getElementById('contractorRating').textContent = r ? `${r.avg}/5 (${r.count} reviews)` : 'No ratings yet';
        } catch { }
    } catch (err) {
        console.error('Error loading project:', err);
    }
}


// ======================
// LOAD REQUESTS
// ======================
async function loadRequests() {
    try {
        const res = await fetch(`${API}/api/projects/${projectId}/requests`);
        allRequests = await res.json();
        populateRequestDropdowns();
    } catch (err) {
        console.error('Error loading requests:', err);
    }
}

function populateRequestDropdowns() {
    const selects = [document.getElementById('modalRequestId')];
    selects.forEach(sel => {
        if (!sel) return;
        if (allRequests.length === 0) {
            sel.innerHTML = '<option value="">No contractor requests found</option>';
            return;
        }
        sel.innerHTML = '<option value="">Select a request to report on...</option>' +
            allRequests.map(r => {
                const reqId = 'REQ-' + r._id.slice(-6).toUpperCase();
                return `<option value="${r._id}">${reqId} — ${r.previousProgress}% → ${r.progressClaimed}% (${r.status})</option>`;
            }).join('');
    });
}


// ======================
// LOAD CITIZEN REPORTS
// ======================
async function loadReports() {
    try {
        const res = await fetch(`${API}/api/projects/${projectId}/reports`);
        allReports = await res.json();
    } catch (err) {
        console.error('Error loading reports:', err);
    }
}


// ================================================
// COMMUNITY FEED — All citizen reports with voting
// ================================================
function renderCommunityFeed() {
    const container = document.getElementById('communityList');
    const visible = allReports.filter(r => !r.flagged);

    if (visible.length === 0) {
        container.innerHTML = `<div class="bg-white border border-slate-200 rounded-xl p-8 text-center">
            <svg class="w-12 h-12 mx-auto text-slate-300 mb-3" fill="none" stroke="currentColor" stroke-width="1" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155"/></svg>
            <h3 class="font-semibold text-slate-700 mb-1">No Reports Yet</h3>
            <p class="text-sm text-slate-400">Be the first to submit an on-ground report.</p>
        </div>`;
        return;
    }

    container.innerHTML = visible.map(r => {
        const date = new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        const anonLabel = r.citizenAnonId && r.citizenAnonId !== 'Anonymous_User'
            ? `Resident ${r.citizenAnonId.split('@')[0]}`
            : 'Anonymous Citizen';

        const stars = renderStarIcons(r.rating || 0);
        const photoHtml = r.photoUrl
            ? `<img src="${r.photoUrl}" alt="Report photo" class="w-24 h-24 rounded-lg object-cover flex-shrink-0"/>`
            : '';

        // Calculated score: (TrueVotes / (TrueVotes + FakeVotes)) * 5
        const trueV = r.trueVotes || 0;
        const fakeV = r.fakeVotes || 0;
        const totalV = trueV + fakeV;
        const calcScore = totalV > 0 ? Math.round(((trueV / totalV) * 5) * 10) / 10 : 0;
        const scoreStars = renderStarIcons(Math.round(calcScore));
        const scoreLabel = totalV > 0 ? `⭐ ${calcScore} / 5` : 'No votes yet';
        const scoreColor = calcScore >= 3.5 ? 'text-emerald-600' : calcScore >= 2 ? 'text-orange-500' : calcScore > 0 ? 'text-red-500' : 'text-slate-400';

        // Community Verified badge for 50+ true votes
        const verifiedBadge = trueV >= 50
            ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd"/></svg>
                Community Verified
               </span>`
            : '';

        // Request ID reference
        const reqRef = r.requestId ? `REQ-${(r.requestId._id || r.requestId).toString().slice(-6).toUpperCase()}` : '';

        // Check if current user has already voted on this report
        const voters = r.voters || [];
        const existingVote = voters.find(v => v.userId === citizenEmail);
        const trueDisabled = existingVote ? 'opacity-50 cursor-not-allowed' : '';
        const fakeDisabled = existingVote ? 'opacity-50 cursor-not-allowed' : '';
        const trueActive = existingVote && existingVote.voteType === 'true' ? 'bg-emerald-100 border-emerald-500 ring-2 ring-emerald-300' : '';
        const fakeActive = existingVote && existingVote.voteType === 'fake' ? 'bg-red-100 border-red-500 ring-2 ring-red-300' : '';
        const votedLabel = existingVote ? `<span class="text-xs text-slate-400 italic">You voted: ${existingVote.voteType === 'true' ? '▲ True' : '▼ Fake'}</span>` : '';

        // Parse GPS from comment (format: "📍 GPS: lat, lon")
        const gpsMatch = r.comment ? r.comment.match(/GPS:\s*([\d.]+),\s*([\d.]+)/) : null;
        const lat = gpsMatch ? gpsMatch[1] : null;
        const lon = gpsMatch ? gpsMatch[2] : null;
        const mapLinkHtml = lat && lon
            ? `<a href="https://www.google.com/maps?q=${lat},${lon}" target="_blank" class="text-blue-600 hover:underline ml-2 text-[10px] font-bold inline-flex items-center gap-1">📍 View on Map</a>`
            : '';

        return `
        <div class="bg-white border border-slate-200 rounded-xl p-5 report-card" data-report-id="${r._id}">
            <div class="flex gap-4">
                ${photoHtml}
                <div class="flex-1">
                    <div class="flex items-center justify-between mb-2 flex-wrap gap-2">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="text-sm font-semibold text-slate-900">${anonLabel}</span>
                            <span class="credibility-badge text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500" data-citizen-email="${r.citizenAnonId || ''}">⭐ —</span>
                            <span class="text-xs text-slate-400">· ${date}</span>
                            ${reqRef ? `<span class="text-xs text-blue-600 font-mono">${reqRef}</span>` : ''}
                            ${verifiedBadge}
                        </div>
                        <div class="flex items-center gap-1">${stars}</div>
                    </div>
                    <p class="text-sm text-slate-600 mb-1">${r.comment}${mapLinkHtml}</p>

                    <!-- CALCULATED SCORE -->
                    <div class="flex items-center gap-2 mb-3">
                        <div class="flex items-center gap-0.5">${scoreStars}</div>
                        <span class="text-sm font-bold ${scoreColor}">${scoreLabel}</span>
                        <span class="text-xs text-slate-400">(${trueV} true · ${fakeV} fake)</span>
                    </div>

                    <!-- LARGE VOTING BUTTONS -->
                    <div class="flex items-center gap-3 flex-wrap">
                        <button data-vote="true" data-id="${r._id}" ${existingVote ? 'disabled' : ''}
                            class="vote-btn inline-flex items-center gap-2 px-5 py-2 border-2 border-emerald-200 text-emerald-700 rounded-xl text-sm font-bold hover:bg-emerald-50 transition-all ${trueDisabled} ${trueActive}">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18"/></svg>
                            ▲ True
                            <span class="true-count text-emerald-600 font-bold">${trueV}</span>
                        </button>
                        <button data-vote="fake" data-id="${r._id}" ${existingVote ? 'disabled' : ''}
                            class="vote-btn inline-flex items-center gap-2 px-5 py-2 border-2 border-red-200 text-red-600 rounded-xl text-sm font-bold hover:bg-red-50 transition-all ${fakeDisabled} ${fakeActive}">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3"/></svg>
                            ▼ Fake
                            <span class="fake-count text-red-500 font-bold">${fakeV}</span>
                        </button>
                        ${votedLabel}
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');

    // Attach vote listeners (only on non-disabled buttons)
    container.querySelectorAll('.vote-btn:not([disabled])').forEach(btn => {
        btn.addEventListener('click', function () {
            const voteType = this.getAttribute('data-vote');
            const reportId = this.getAttribute('data-id');
            voteReport(reportId, voteType, this);
        });
    });

    // Load credibility badges
    loadCredibilityBadges();
}


// ================================================
// VERIFICATION FEED — Contractor claims + counter-report
// ================================================
function renderVerificationFeed() {
    const container = document.getElementById('verificationList');

    if (allRequests.length === 0) {
        container.innerHTML = `<div class="bg-white border border-slate-200 rounded-xl p-8 text-center">
            <svg class="w-12 h-12 mx-auto text-slate-300 mb-3" fill="none" stroke="currentColor" stroke-width="1" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"/></svg>
            <h3 class="font-semibold text-slate-700 mb-1">No Contractor Claims</h3>
            <p class="text-sm text-slate-400">There are no contractor progress claims to verify yet.</p>
        </div>`;
        return;
    }

    container.innerHTML = allRequests.map(r => {
        const reqId = 'REQ-' + r._id.slice(-6).toUpperCase();
        const date = new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

        const statusBg = r.status === 'Approved' ? 'bg-emerald-50 text-emerald-700' : r.status === 'Rejected' ? 'bg-red-50 text-red-700' : 'bg-orange-50 text-orange-700';
        const statusDot = r.status === 'Approved' ? 'bg-emerald-500' : r.status === 'Rejected' ? 'bg-red-500' : 'bg-orange-500';

        const photoHtml = r.photoUrl
            ? `<img src="${r.photoUrl}" alt="Contractor proof" class="w-full rounded-lg object-cover max-h-40 mb-3"/>`
            : '<p class="text-xs text-slate-400 mb-3">No photo uploaded by contractor.</p>';

        // GPS parse from description
        const gpsMatch = r.description ? r.description.match(/GPS:\s*([\d.]+),\s*([\d.]+)/) : null;
        const mapLink = gpsMatch
            ? `<a href="https://www.google.com/maps?q=${gpsMatch[1]},${gpsMatch[2]}" target="_blank" class="text-xs text-blue-600 hover:underline">📍 View on Map</a>` : '';

        // Count counter-reports linked to this request
        const counterCount = allReports.filter(rep => {
            const repReqId = rep.requestId?._id || rep.requestId;
            return repReqId === r._id;
        }).length;

        return `
        <div class="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <button class="verification-toggle w-full p-5 flex items-center gap-4 text-left hover:bg-slate-50 transition-colors">
                <div class="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    ${r.photoUrl ? `<img src="${r.photoUrl}" class="w-full h-full object-cover"/>` : '<svg class="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909"/></svg>'}
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1 flex-wrap">
                        <span class="text-sm font-bold text-slate-900 font-mono">${reqId}</span>
                        <span class="text-xs text-slate-400">· ${date}</span>
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${statusBg}">
                            <span class="w-1.5 h-1.5 rounded-full ${statusDot}"></span> ${r.status}
                        </span>
                    </div>
                    <p class="text-sm text-slate-500">${r.previousProgress}% → ${r.progressClaimed}% claimed</p>
                </div>
                <div class="flex items-center gap-3 flex-shrink-0">
                    ${counterCount > 0 ? `<span class="text-xs text-red-600 font-bold">${counterCount} counter-reports</span>` : ''}
                    <svg class="w-4 h-4 text-slate-400 transition-transform" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg>
                </div>
            </button>
            <div class="accordion-body">
                <div class="px-5 pb-5 pt-2 border-t border-slate-100">
                    ${photoHtml}
                    <p class="text-sm text-slate-600 mb-2">${r.description || 'No description provided.'}</p>
                    ${mapLink}
                    ${r.adminComment ? `<p class="text-xs text-slate-500 mt-2">Admin: <em class="text-slate-700">${r.adminComment}</em></p>` : ''}
                    ${r.status === 'Pending' ? `
                    <div class="mt-4">
                        <button class="counter-report-btn inline-flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-bold hover:bg-red-100 transition-all"
                            data-req-id="${r._id}" data-req-label="${reqId}">
                            🚩 Report this Claim as Fake
                        </button>
                    </div>` : ''}
                </div>
            </div>
        </div>`;
    }).join('');

    // Attach accordion toggles
    container.querySelectorAll('.verification-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const body = btn.nextElementSibling;
            const chevron = btn.querySelector('svg:last-child');
            body.classList.toggle('open');
            chevron.style.transform = body.classList.contains('open') ? 'rotate(180deg)' : '';
        });
    });

    // Attach counter-report buttons
    container.querySelectorAll('.counter-report-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const reqId = btn.getAttribute('data-req-id');
            const reqLabel = btn.getAttribute('data-req-label');
            openCounterModal(reqId, reqLabel);
        });
    });
}


// ======================
// CREDIBILITY BADGES
// ======================
async function loadCredibilityBadges() {
    const badges = document.querySelectorAll('.credibility-badge');
    const emailsToFetch = new Set();
    badges.forEach(b => {
        const email = b.getAttribute('data-citizen-email');
        if (email && email !== 'Anonymous_User' && email !== '') emailsToFetch.add(email);
    });

    for (const email of emailsToFetch) {
        try {
            const res = await fetch(`${API}/api/reports/credibility/${encodeURIComponent(email)}`);
            const data = await res.json();
            const score = data.credibilityScore;

            document.querySelectorAll(`.credibility-badge[data-citizen-email="${email}"]`).forEach(badge => {
                badge.textContent = `⭐ ${score.toFixed(1)}`;

                if (score < 2.0) {
                    badge.classList.remove('bg-slate-100', 'text-slate-500');
                    badge.classList.add('bg-red-100', 'text-red-700');
                    const card = badge.closest('.report-card');
                    if (card && !card.querySelector('.low-cred-warning')) {
                        const warning = document.createElement('div');
                        warning.className = 'low-cred-warning mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2';
                        warning.innerHTML = `<svg class="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 15.75h.007v.008H12v-.008z"/></svg>
                            <span class="text-xs font-semibold text-red-600">⚠ Low Credibility — This reporter's score is below 2.0. Reports may be unreliable.</span>`;
                        card.querySelector('.flex-1').appendChild(warning);
                    }
                } else if (score >= 4.0) {
                    badge.classList.remove('bg-slate-100', 'text-slate-500');
                    badge.classList.add('bg-emerald-50', 'text-emerald-700');
                }
            });
        } catch (err) {
            console.error('Error fetching credibility for', email, err);
        }
    }
}


// ======================
// VOTING
// ======================
async function voteReport(reportId, voteType, btnEl) {
    try {
        btnEl.disabled = true;
        btnEl.style.opacity = '0.5';

        const res = await fetch(`${API}/api/reports/${reportId}/vote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: citizenEmail, voteType })
        });
        const data = await res.json();

        if (res.ok) {
            const card = btnEl.closest('.report-card');
            const report = data.report;

            // Update counts
            const trueEl = card.querySelector('.true-count');
            const fakeEl = card.querySelector('.fake-count');
            if (trueEl) trueEl.textContent = report.trueVotes;
            if (fakeEl) fakeEl.textContent = report.fakeVotes;

            // Dim BOTH buttons permanently (single vote enforced)
            card.querySelectorAll('.vote-btn').forEach(b => {
                b.disabled = true;
                b.classList.add('opacity-50', 'cursor-not-allowed');
            });
            // Highlight the voted button
            if (voteType === 'true') {
                btnEl.classList.add('bg-emerald-100', 'border-emerald-500', 'ring-2', 'ring-emerald-300');
            } else {
                btnEl.classList.add('bg-red-100', 'border-red-500', 'ring-2', 'ring-red-300');
            }

            // Update the calculated score display
            const calcScore = data.reportScore;
            const scoreStars = renderStarIcons(Math.round(calcScore));
            const scoreColor = calcScore >= 3.5 ? 'text-emerald-600' : calcScore >= 2 ? 'text-orange-500' : calcScore > 0 ? 'text-red-500' : 'text-slate-400';
            const scoreRow = card.querySelector('.flex.items-center.gap-2.mb-3');
            if (scoreRow) {
                scoreRow.innerHTML = `
                    <div class="flex items-center gap-0.5">${scoreStars}</div>
                    <span class="text-sm font-bold ${scoreColor}">⭐ ${calcScore} / 5</span>
                    <span class="text-xs text-slate-400">(${report.trueVotes} true · ${report.fakeVotes} fake)</span>`;
            }

            // Check if report is now flagged
            if (report.flagged) {
                card.style.opacity = '0.3';
                card.innerHTML = `<div class="p-4 text-center text-sm text-red-500 font-semibold">⚠ This report has been flagged as unreliable and is now Under Review.</div>`;
            }

            // Community Verified badge at 50+ true votes
            if (report.trueVotes >= 50 && !card.querySelector('.community-verified')) {
                const headerRow = card.querySelector('.flex.items-center.justify-between');
                if (headerRow) {
                    const badge = document.createElement('span');
                    badge.className = 'community-verified inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold';
                    badge.innerHTML = '<svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd"/></svg> Community Verified';
                    headerRow.querySelector('.flex.items-center.gap-2').appendChild(badge);
                }
            }

            showToast(`Vote recorded (${voteType === 'true' ? '▲ True' : '▼ Fake'})`, 'success');
            loadCredibilityBadges();
        } else if (res.status === 409) {
            showToast(data.message || 'You have already verified this report.', 'error');
            // Dim buttons since already voted
            const card = btnEl.closest('.report-card');
            card.querySelectorAll('.vote-btn').forEach(b => {
                b.disabled = true;
                b.classList.add('opacity-50', 'cursor-not-allowed');
            });
        } else {
            showToast(data.message || 'Vote failed.', 'error');
        }
    } catch (err) {
        showToast('Network error.', 'error');
    }
}


// =============================================
// REPORT GROUND REALITY — CAMERA MODAL
// =============================================
async function openReportModal() {
    capturedBlob = null;
    selectedRating = 0;
    document.getElementById('modalComment').value = '';
    document.getElementById('gpsLocation').value = '';
    document.getElementById('gpsMapLink').innerHTML = '';
    document.getElementById('capturedOverlay').classList.add('hidden');
    document.getElementById('btnRetake').classList.add('hidden');
    document.getElementById('btnSnap').classList.remove('hidden');
    document.querySelectorAll('.rating-star').forEach(b => {
        b.classList.remove('bg-orange-100', 'text-orange-500', 'border-orange-300');
        b.classList.add('text-slate-300');
    });

    const modal = document.getElementById('reportModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    const video = document.getElementById('citizenCamFeed');
    const canvas = document.getElementById('citizenCamCanvas');
    video.classList.remove('hidden');
    canvas.classList.add('hidden');

    // Start camera
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false
        });
        video.srcObject = cameraStream;
    } catch (err) {
        console.warn('Camera not available:', err.message);
        showToast('Camera not available. Please use a mobile device.', 'error');
    }

    detectGPS();
}

function closeReportModal() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
        cameraStream = null;
    }
    document.getElementById('citizenCamFeed').srcObject = null;
    const modal = document.getElementById('reportModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

document.getElementById('reportModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeReportModal(); });


// SNAP / RETAKE
function snapPhoto() {
    const video = document.getElementById('citizenCamFeed');
    const canvas = document.getElementById('citizenCamCanvas');

    if (!video.srcObject) {
        showToast('Camera not available. Live photo required.', 'error');
        return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);

    video.classList.add('hidden');
    canvas.classList.remove('hidden');
    document.getElementById('capturedOverlay').classList.remove('hidden');
    document.getElementById('btnSnap').classList.add('hidden');
    document.getElementById('btnRetake').classList.remove('hidden');

    canvas.toBlob(blob => { capturedBlob = blob; }, 'image/jpeg', 0.85);

    if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
        cameraStream = null;
    }
}

async function retakePhoto() {
    capturedBlob = null;
    document.getElementById('capturedOverlay').classList.add('hidden');
    document.getElementById('btnRetake').classList.add('hidden');
    document.getElementById('btnSnap').classList.remove('hidden');

    const video = document.getElementById('citizenCamFeed');
    const canvas = document.getElementById('citizenCamCanvas');
    video.classList.remove('hidden');
    canvas.classList.add('hidden');

    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false
        });
        video.srcObject = cameraStream;
    } catch (err) {
        showToast('Could not restart camera.', 'error');
    }
}


// GPS DETECTION
function detectGPS() {
    const el = document.getElementById('gpsLocation');
    const mapEl = document.getElementById('gpsMapLink');
    el.value = 'Detecting...';
    if (!navigator.geolocation) { el.value = 'Not available'; return; }
    navigator.geolocation.getCurrentPosition(
        pos => {
            const lat = pos.coords.latitude.toFixed(6);
            const lon = pos.coords.longitude.toFixed(6);
            el.value = `${lat}, ${lon}`;
            mapEl.innerHTML = `<a href="https://www.google.com/maps?q=${lat},${lon}" target="_blank" class="text-blue-600 hover:underline">📍 View on Map</a>`;
        },
        () => { el.value = 'Location unavailable'; },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}


// SUBMIT REPORT
async function submitReport() {
    const requestId = document.getElementById('modalRequestId').value;
    const comment = document.getElementById('modalComment').value.trim();
    const gps = document.getElementById('gpsLocation').value;

    if (!capturedBlob) { showToast('Please capture a live photo first.', 'error'); return; }
    if (!requestId) { showToast('Please select a contractor request.', 'error'); return; }
    if (!comment) { showToast('Please describe your observation.', 'error'); return; }
    if (selectedRating === 0) { showToast('Please provide a rating.', 'error'); return; }

    const btn = document.getElementById('submitReportBtn');
    btn.textContent = 'Submitting...';
    btn.disabled = true;

    try {
        const fullComment = gps && gps !== 'Detecting...' && gps !== 'Location unavailable'
            ? `${comment}\n📍 GPS: ${gps}`
            : comment;

        const formData = new FormData();
        formData.append('requestId', requestId);
        formData.append('citizenAnonId', citizenEmail);
        formData.append('comment', fullComment);
        formData.append('rating', selectedRating);
        formData.append('photo', capturedBlob, 'citizen-report.jpg');

        const res = await fetch(`${API}/api/reports`, { method: 'POST', body: formData });
        const data = await res.json();

        if (res.ok) {
            showToast('Ground report submitted! Thank you.', 'success');
            closeReportModal();
            await loadReports();
            renderCommunityFeed();
        } else {
            showToast(data.message || 'Submission failed.', 'error');
        }
    } catch (err) {
        showToast('Network error.', 'error');
    }

    btn.textContent = 'Submit Ground Report';
    btn.disabled = false;
}

function setRating(r) {
    selectedRating = r;
    document.querySelectorAll('.rating-star').forEach((btn, i) => {
        if (i < r) {
            btn.classList.add('bg-orange-100', 'text-orange-500', 'border-orange-300');
            btn.classList.remove('text-slate-300');
        } else {
            btn.classList.remove('bg-orange-100', 'text-orange-500', 'border-orange-300');
            btn.classList.add('text-slate-300');
        }
    });
}


// =============================================
// COUNTER-REPORT CAMERA MODAL
// =============================================
async function openCounterModal(requestId, reqLabel) {
    counterCapturedBlob = null;
    document.getElementById('counterRequestId').value = requestId;
    document.getElementById('counterReqLabel').textContent = reqLabel;
    document.getElementById('counterComment').value = '';
    document.getElementById('counterGps').value = '';
    document.getElementById('counterGpsMapLink').innerHTML = '';
    document.getElementById('counterCapturedOverlay').classList.add('hidden');
    document.getElementById('counterBtnRetake').classList.add('hidden');
    document.getElementById('counterBtnSnap').classList.remove('hidden');

    const modal = document.getElementById('counterModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    const video = document.getElementById('counterCamFeed');
    const canvas = document.getElementById('counterCamCanvas');
    video.classList.remove('hidden');
    canvas.classList.add('hidden');

    try {
        counterCameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false
        });
        video.srcObject = counterCameraStream;
    } catch (err) {
        showToast('Camera not available.', 'error');
    }

    detectCounterGPS();
}

function closeCounterModal() {
    if (counterCameraStream) {
        counterCameraStream.getTracks().forEach(t => t.stop());
        counterCameraStream = null;
    }
    document.getElementById('counterCamFeed').srcObject = null;
    const modal = document.getElementById('counterModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

document.getElementById('counterModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeCounterModal(); });

function counterSnapPhoto() {
    const video = document.getElementById('counterCamFeed');
    const canvas = document.getElementById('counterCamCanvas');
    if (!video.srcObject) { showToast('Camera not available.', 'error'); return; }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);

    video.classList.add('hidden');
    canvas.classList.remove('hidden');
    document.getElementById('counterCapturedOverlay').classList.remove('hidden');
    document.getElementById('counterBtnSnap').classList.add('hidden');
    document.getElementById('counterBtnRetake').classList.remove('hidden');

    canvas.toBlob(blob => { counterCapturedBlob = blob; }, 'image/jpeg', 0.85);

    if (counterCameraStream) {
        counterCameraStream.getTracks().forEach(t => t.stop());
        counterCameraStream = null;
    }
}

async function counterRetakePhoto() {
    counterCapturedBlob = null;
    document.getElementById('counterCapturedOverlay').classList.add('hidden');
    document.getElementById('counterBtnRetake').classList.add('hidden');
    document.getElementById('counterBtnSnap').classList.remove('hidden');

    const video = document.getElementById('counterCamFeed');
    const canvas = document.getElementById('counterCamCanvas');
    video.classList.remove('hidden');
    canvas.classList.add('hidden');

    try {
        counterCameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false
        });
        video.srcObject = counterCameraStream;
    } catch (err) {
        showToast('Could not restart camera.', 'error');
    }
}

function detectCounterGPS() {
    const el = document.getElementById('counterGps');
    const mapEl = document.getElementById('counterGpsMapLink');
    el.value = 'Detecting...';
    if (!navigator.geolocation) { el.value = 'Not available'; return; }
    navigator.geolocation.getCurrentPosition(
        pos => {
            const lat = pos.coords.latitude.toFixed(6);
            const lon = pos.coords.longitude.toFixed(6);
            el.value = `${lat}, ${lon}`;
            mapEl.innerHTML = `<a href="https://www.google.com/maps?q=${lat},${lon}" target="_blank" class="text-blue-600 hover:underline">📍 View on Map</a>`;
        },
        () => { el.value = 'Location unavailable'; },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

async function submitCounterReport() {
    const requestId = document.getElementById('counterRequestId').value;
    const comment = document.getElementById('counterComment').value.trim();
    const gps = document.getElementById('counterGps').value;

    if (!counterCapturedBlob) { showToast('Please capture a live proof photo.', 'error'); return; }
    if (!comment) { showToast('Please describe why this claim is fake.', 'error'); return; }

    const btn = document.getElementById('submitCounterBtn');
    btn.textContent = 'Submitting...';
    btn.disabled = true;

    try {
        const fullComment = gps && gps !== 'Detecting...' && gps !== 'Location unavailable'
            ? `🚩 COUNTER-REPORT: ${comment}\n📍 GPS: ${gps}`
            : `🚩 COUNTER-REPORT: ${comment}`;

        const formData = new FormData();
        formData.append('requestId', requestId);
        formData.append('citizenAnonId', citizenEmail);
        formData.append('comment', fullComment);
        formData.append('rating', 1); // Counter-reports default to 1-star
        formData.append('photo', counterCapturedBlob, 'counter-report.jpg');

        const res = await fetch(`${API}/api/reports`, { method: 'POST', body: formData });
        const data = await res.json();

        if (res.ok) {
            showToast('Counter-report submitted! The community will review.', 'success');
            closeCounterModal();
            await loadReports();
            renderCommunityFeed();
            renderVerificationFeed();
        } else {
            showToast(data.message || 'Submission failed.', 'error');
        }
    } catch (err) {
        showToast('Network error.', 'error');
    }

    btn.textContent = '🚩 Submit Counter-Report';
    btn.disabled = false;
}


// ======================
// TAB SWITCHING
// ======================
function switchTab(tab) {
    const tabs = { community: 'tabCommunity', verification: 'tabVerification' };
    const panels = { community: 'panelCommunity', verification: 'panelVerification' };
    document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('active');
        b.className = b.className.replace('text-slate-900 border-blue-900', 'text-slate-400').replace('font-semibold', 'font-medium');
    });
    Object.values(panels).forEach(id => document.getElementById(id).classList.add('hidden'));
    document.getElementById(panels[tab]).classList.remove('hidden');
    const btn = document.getElementById(tabs[tab]);
    btn.classList.add('active');
    btn.className = btn.className.replace('text-slate-400', 'text-slate-900 border-blue-900').replace('font-medium', 'font-semibold');
}


// ======================
// STAR ICONS
// ======================
function renderStarIcons(avg) {
    const full = `<svg class="w-3.5 h-3.5 text-orange-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.065 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z"/></svg>`;
    const empty = `<svg class="w-3.5 h-3.5 text-slate-200" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.065 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z"/></svg>`;
    const r = Math.round(avg);
    let html = '';
    for (let i = 0; i < 5; i++) html += i < r ? full : empty;
    return html;
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
    const bg = type === 'success' ? 'bg-emerald-600' : 'bg-red-600';
    toast.className = `${bg} text-white px-5 py-3 rounded-lg shadow-lg text-sm font-medium`;
    toast.style.animation = 'toastIn 0.4s ease, toastOut 0.4s ease 2.6s forwards';
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
}
