// =============================================
// NIRMAAN — Contractor Details Frontend Logic
// =============================================

const API = window.location.origin;
const urlParams = new URLSearchParams(window.location.search);
const projectId = urlParams.get('id');

let projectData = null;
let allRequests = [];
let allReports = [];
let cameraStream = null;
let capturedBlob = null;

// --- User info ---
const user = JSON.parse(localStorage.getItem('nirmaan_user') || 'null');
if (user && user.name) {
    document.getElementById('avatarLetter').textContent = user.name.charAt(0).toUpperCase();
}


// ===============
// INIT
// ===============
document.addEventListener('DOMContentLoaded', async () => {
    if (!projectId) {
        document.querySelector('main').innerHTML = '<div class="text-center py-20"><h2 class="text-xl font-bold text-slate-700">No project ID specified.</h2><a href="contractor.html" class="text-orange-500 hover:underline mt-2 inline-block">← Back to Dashboard</a></div>';
        return;
    }
    await loadProject();
    await Promise.all([loadRequests(), loadReports()]);
});


// ===============
// LOAD PROJECT
// ===============
async function loadProject() {
    try {
        const res = await fetch(`${API}/api/projects/${projectId}`);
        if (!res.ok) throw new Error('Not found');
        projectData = await res.json();
        renderSummary(projectData);
    } catch (err) {
        console.error(err);
    }
}

function renderSummary(p) {
    document.getElementById('projName').textContent = p.name;
    document.getElementById('projLocation').innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/></svg> ${p.location}`;
    document.getElementById('projPct').textContent = p.progress + '%';
    document.getElementById('projBar').style.width = p.progress + '%';
    document.getElementById('projBudget').textContent = p.budget ? `₹${p.budget}` : '—';
    document.getElementById('projDeadline').textContent = p.deadline ? new Date(p.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
    document.getElementById('projEmail').textContent = p.contractorEmail || '—';

    // Badge
    const badges = {
        'Ongoing': { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
        'Approval Requested': { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
        'Completed': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' }
    };
    const b = badges[p.status] || badges['Ongoing'];
    document.getElementById('projBadge').className = `flex-shrink-0 inline-flex items-center gap-1 px-3 py-1 rounded-full ${b.bg} ${b.text} text-xs font-semibold`;
    document.getElementById('projBadge').innerHTML = `<span class="w-1.5 h-1.5 rounded-full ${b.dot}"></span> ${p.status}`;

    // Photo
    if (p.sitePhoto) {
        const wrap = document.getElementById('headerPhotoWrap');
        wrap.innerHTML = `<img src="${p.sitePhoto}" alt="Site photo" class="w-full h-full object-cover"/>`;
        wrap.classList.remove('flex', 'items-center', 'justify-center');
    }
}


// ===============
// REQUESTS (History + Pending)
// ===============
async function loadRequests() {
    try {
        const res = await fetch(`${API}/api/projects/${projectId}/requests`);
        allRequests = await res.json();
        renderHistory();
    } catch (err) {
        console.error(err);
    }
}

function renderHistory() {
    const tbody = document.getElementById('historyBody');
    if (allRequests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-sm text-slate-400">No requests submitted yet.</td></tr>';
        return;
    }

    tbody.innerHTML = allRequests.map(r => {
        const date = new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        const reqId = 'REQ-' + r._id.slice(-6).toUpperCase();

        let badgeBg, badgeText, badgeDot;
        if (r.status === 'Approved') {
            badgeBg = 'bg-emerald-50'; badgeText = 'text-emerald-700'; badgeDot = 'bg-emerald-500';
        } else if (r.status === 'Rejected') {
            badgeBg = 'bg-red-50'; badgeText = 'text-red-700'; badgeDot = 'bg-red-500';
        } else {
            badgeBg = 'bg-orange-50'; badgeText = 'text-orange-700'; badgeDot = 'bg-orange-500';
        }

        return `
        <tr class="border-b border-slate-50 hover:bg-slate-50 transition-colors">
            <td class="px-6 py-4 text-sm text-slate-600">${date}</td>
            <td class="px-6 py-4 text-sm font-mono font-semibold text-slate-800">${reqId}</td>
            <td class="px-6 py-4 text-sm text-slate-600">${r.previousProgress}% → ${r.progressClaimed}%</td>
            <td class="px-6 py-4"><span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full ${badgeBg} ${badgeText} text-xs font-semibold"><span class="w-1.5 h-1.5 rounded-full ${badgeDot}"></span>${r.status}</span></td>
            <td class="px-6 py-4 text-sm text-slate-500">${r.adminComment || (r.status === 'Pending' ? '<span class="italic text-slate-300">Awaiting review</span>' : '—')}</td>
        </tr>`;
    }).join('');
}


// ===============
// CITIZEN REVIEWS
// ===============
async function loadReports() {
    try {
        const res = await fetch(`${API}/api/projects/${projectId}/reports`);
        allReports = await res.json();
        renderReviews();
    } catch (err) {
        console.error(err);
    }
}

function renderReviews() {
    const container = document.getElementById('reviewsContainer');

    if (allReports.length === 0) {
        container.innerHTML = `<div class="bg-white border border-slate-200 rounded-xl p-8 text-center">
            <svg class="w-12 h-12 mx-auto text-slate-300 mb-3" fill="none" stroke="currentColor" stroke-width="1" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/></svg>
            <h3 class="font-semibold text-slate-700 mb-1">No Citizen Reviews Yet</h3>
            <p class="text-sm text-slate-400">Reviews from citizens will appear here once submitted.</p>
        </div>`;
        return;
    }

    container.innerHTML = allReports.map(r => {
        const date = new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        const reqId = r.requestId ? 'REQ-' + (r.requestId._id || r.requestId).toString().slice(-6).toUpperCase() : '—';
        const stars = renderStars(r.rating);
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
                    <span class="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">▲ ${r.upvotes} Upvotes</span>
                    <svg class="w-4 h-4 text-slate-400 transition-transform" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg>
                </div>
            </button>
            <div class="accordion-body">
                <div class="px-6 pb-6 pt-2 border-t border-slate-100">
                    ${r.photoUrl ? `<div class="mb-4"><img src="${r.photoUrl}" class="h-32 rounded-lg object-cover"/></div>` : ''}
                    <p class="text-sm text-slate-600 mb-3">"${r.comment}"</p>
                    <div class="flex items-center gap-4">
                        <span class="text-xs text-slate-400">Request: <span class="font-semibold text-slate-700">${reqId}</span></span>
                        <div class="flex items-center gap-1"><span class="text-xs text-slate-400">Rating:</span>${stars}<span class="text-xs font-semibold text-slate-700">${r.rating}/5</span></div>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');
}

function renderStars(count) {
    const star = `<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.065 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z"/></svg>`;
    const empty = `<svg class="w-3 h-3 text-slate-200" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.065 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z"/></svg>`;
    let html = '<div class="flex gap-0.5 text-orange-400">';
    for (let i = 0; i < 5; i++) html += i < count ? star : empty;
    html += '</div>';
    return html;
}


// ===============
// TAB SWITCHING
// ===============
function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('active');
        b.className = b.className.replace('text-slate-900 border-orange-500', 'text-slate-400').replace('font-semibold', 'font-medium');
    });
    const panels = { submit: 'panelSubmit', history: 'panelHistory', reviews: 'panelReviews' };
    const tabs = { submit: 'tabSubmit', history: 'tabHistory', reviews: 'tabReviews' };
    Object.values(panels).forEach(id => document.getElementById(id).classList.add('hidden'));
    document.getElementById(panels[tab]).classList.remove('hidden');
    const btn = document.getElementById(tabs[tab]);
    btn.classList.add('active');
    btn.className = btn.className.replace('text-slate-400', 'text-slate-900 border-orange-500').replace('font-medium', 'font-semibold');
}

function toggleAccordion(btn) {
    const body = btn.nextElementSibling;
    const chevron = btn.querySelector('svg:last-child');
    body.classList.toggle('open');
    chevron.style.transform = body.classList.contains('open') ? 'rotate(180deg)' : '';
}


// ===============
// CAMERA MODAL
// ===============
async function openCameraModal() {
    capturedBlob = null;
    document.getElementById('camProgress').value = '';
    document.getElementById('camDescription').value = '';
    document.getElementById('gpsLocation').value = '';
    // document.getElementById('fallbackPhoto').value = '';
    document.getElementById('capturedOverlay').classList.add('hidden');
    document.getElementById('btnRetake').classList.add('hidden');
    document.getElementById('btnSnap').classList.remove('hidden');

    const modal = document.getElementById('cameraModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    // Show video, hide canvas
    const video = document.getElementById('cameraFeed');
    const canvas = document.getElementById('cameraCanvas');
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
        // Camera not available — fallback upload is always visible
    }

    // Auto-detect GPS
    detectGPS();
}

function closeCameraModal() {
    // Stop camera stream
    if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
        cameraStream = null;
    }
    const video = document.getElementById('cameraFeed');
    video.srcObject = null;

    const modal = document.getElementById('cameraModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

document.getElementById('cameraModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeCameraModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeCameraModal(); });


// ===============
// SNAP PHOTO
// ===============
function snapPhoto() {
    const video = document.getElementById('cameraFeed');
    const canvas = document.getElementById('cameraCanvas');

    // If no video stream active, ignore
    if (!video.srcObject) {
        showToast('Camera not available. Please upload a photo instead.', 'error');
        return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    // Show captured canvas, hide video
    video.classList.add('hidden');
    canvas.classList.remove('hidden');
    document.getElementById('capturedOverlay').classList.remove('hidden');
    document.getElementById('btnSnap').classList.add('hidden');
    document.getElementById('btnRetake').classList.remove('hidden');

    // Convert to blob
    canvas.toBlob(blob => {
        capturedBlob = blob;
    }, 'image/jpeg', 0.85);

    // Stop stream to save resources
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

    const video = document.getElementById('cameraFeed');
    const canvas = document.getElementById('cameraCanvas');
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


// ===============
// GPS DETECTION
// ===============
function detectGPS() {
    const el = document.getElementById('gpsLocation');
    if (!navigator.geolocation) {
        el.value = 'Geolocation not supported';
        return;
    }
    el.value = 'Detecting...';
    navigator.geolocation.getCurrentPosition(
        pos => {
            const lat = pos.coords.latitude.toFixed(6);
            const lon = pos.coords.longitude.toFixed(6);
            el.value = `${lat}, ${lon}`;
            // Add map link next to GPS field
            let mapLink = document.getElementById('gpsMapLink');
            if (!mapLink) {
                mapLink = document.createElement('a');
                mapLink.id = 'gpsMapLink';
                mapLink.target = '_blank';
                mapLink.className = 'text-xs text-blue-600 hover:underline mt-1 inline-block';
                el.parentElement.parentElement.appendChild(mapLink);
            }
            mapLink.href = `https://www.google.com/maps?q=${lat},${lon}`;
            mapLink.textContent = '📍 View on Google Maps';
        },
        err => {
            console.warn('GPS error:', err.message);
            el.value = 'Location unavailable';
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}


// ===============
// SUBMIT UPDATE
// ===============
async function submitCameraUpdate() {
    const progress = document.getElementById('camProgress').value;
    const description = document.getElementById('camDescription').value.trim();

    if (!progress || !description) {
        showToast('Please fill in progress and description.', 'error');
        return;
    }

    const btn = document.getElementById('camSubmitBtn');
    btn.textContent = 'Submitting...';
    btn.disabled = true;

    try {
        const formData = new FormData();
        formData.append('projectId', projectId);
        formData.append('progressClaimed', progress);
        formData.append('description', description);

        // Add location to description if available
        const gps = document.getElementById('gpsLocation').value;
        if (gps && !gps.includes('unavailable') && !gps.includes('Detecting') && !gps.includes('not supported')) {
            const [lat, lon] = gps.split(',').map(s => s.trim());
            formData.set('description', `${description}\n📍 GPS: ${gps} | Map: https://www.google.com/maps?q=${lat},${lon}`);
        }

        // Attach photo: camera blob takes priority, fallback file second
        if (capturedBlob) {
            formData.append('proofPhoto', capturedBlob, 'site-capture.jpg');
        } else {
            const fallback = document.getElementById('fallbackPhoto');
            if (fallback.files.length > 0) {
                formData.append('proofPhoto', fallback.files[0]);
            }
        }

        const res = await fetch(`${API}/api/requests`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if (res.ok) {
            const reqId = 'REQ-' + data.request._id.slice(-6).toUpperCase();
            showToast(`Progress submitted! ID: ${reqId}`, 'success');
            closeCameraModal();
            await loadProject();
            await loadRequests();
        } else {
            showToast(data.message || 'Submission failed.', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Network error.', 'error');
    }

    btn.textContent = 'Submit for Approval';
    btn.disabled = false;
}


// ===============
// TOAST
// ===============
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
