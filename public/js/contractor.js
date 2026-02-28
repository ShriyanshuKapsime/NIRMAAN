// =============================================
// NIRMAAN — Contractor Dashboard Frontend Logic
// =============================================

const API = window.location.origin;

// Get logged-in user from localStorage
const user = JSON.parse(localStorage.getItem('nirmaan_user') || 'null');
const contractorEmail = user ? user.email : '';

let allProjects = [];
let cameraStream = null;
let capturedBlob = null;

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
    // Set avatar & name from logged-in user
    if (user && user.name) {
        document.getElementById('avatarLetter').textContent = user.name.charAt(0).toUpperCase();
        document.getElementById('navName').textContent = user.name;
    }
    fetchProjects();
});


// ======================
// FETCH & RENDER
// ======================
async function fetchProjects() {
    try {
        const url = contractorEmail
            ? `${API}/api/projects?contractorEmail=${encodeURIComponent(contractorEmail)}`
            : `${API}/api/projects`;
        const res = await fetch(url);
        allProjects = await res.json();
        renderProjects();
        updateStats();
    } catch (err) {
        console.error('Error fetching projects:', err);
    }
}

function renderProjects() {
    const ongoing = allProjects.filter(p => p.status !== 'Completed');
    const completed = allProjects.filter(p => p.status === 'Completed');

    const ongoingEl = document.getElementById('ongoingList');
    const completedEl = document.getElementById('completedList');

    // Ongoing
    if (ongoing.length === 0) {
        ongoingEl.innerHTML = emptyState('No Ongoing Projects', 'You have no active projects assigned to you right now.');
    } else {
        ongoingEl.innerHTML = ongoing.map(p => buildCard(p)).join('');
    }

    // Completed
    if (completed.length === 0) {
        completedEl.innerHTML = emptyState('No Completed Projects', 'Completed projects will appear here.');
    } else {
        completedEl.innerHTML = completed.map(p => buildCard(p, true)).join('');
    }
}

function emptyState(title, subtitle) {
    return `<div class="bg-white border border-slate-200 rounded-xl p-8 text-center">
        <svg class="w-12 h-12 mx-auto text-slate-300 mb-3" fill="none" stroke="currentColor" stroke-width="1" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/></svg>
        <h3 class="font-semibold text-slate-700 mb-1">${title}</h3>
        <p class="text-sm text-slate-400">${subtitle}</p>
    </div>`;
}

function buildCard(p, isCompleted) {
    const photoHTML = p.sitePhoto
        ? `<img src="${p.sitePhoto}" alt="Site" class="w-full h-full object-cover"/>`
        : `<div class="text-center px-4">
            <svg class="w-10 h-10 mx-auto text-slate-300 mb-2" fill="none" stroke="currentColor" stroke-width="1" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"/></svg>
            <p class="text-xs text-slate-400">No Photo</p>
           </div>`;

    const budgetStr = p.budget ? `₹${p.budget}` : 'N/A';
    const deadlineStr = p.deadline ? new Date(p.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

    const statusColors = {
        'Ongoing': { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
        'Approval Requested': { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
        'Completed': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' }
    };
    const sc = statusColors[p.status] || statusColors['Ongoing'];

    const progressColor = p.status === 'Completed' ? 'bg-emerald-500'
        : p.status === 'Approval Requested' ? 'bg-orange-500'
            : p.progress > 50 ? 'bg-blue-900' : 'bg-orange-500';

    const actionBtn = isCompleted
        ? ''
        : `<button onclick="openProgressModal('${p._id}','${p.name.replace(/'/g, "\\'")}',${p.progress})"
               class="inline-flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-semibold transition-colors">
               <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/></svg>
               Update Progress
           </button>`;

    return `
    <div class="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col md:flex-row">
        <div class="md:w-56 h-44 md:h-auto bg-slate-100 flex items-center justify-center flex-shrink-0 relative overflow-hidden">
            ${photoHTML}
        </div>
        <div class="flex-1 p-6">
            <div class="flex items-start justify-between gap-4 mb-3">
                <div>
                    <h3 class="font-bold text-base text-slate-900 mb-0.5">${p.name}</h3>
                    <p class="text-sm text-slate-400 flex items-center gap-1">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/></svg>
                        ${p.location}
                    </p>
                </div>
                <span class="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full ${sc.bg} ${sc.text} text-xs font-semibold">
                    <span class="w-1.5 h-1.5 rounded-full ${sc.dot}"></span> ${p.status}
                </span>
            </div>
            <div class="flex items-center gap-4 mb-4">
                <p class="text-sm text-slate-500">Budget: <span class="text-slate-700 font-medium">${budgetStr}</span></p>
                ${deadlineStr ? `<p class="text-sm text-slate-500">Deadline: <span class="text-slate-700 font-medium">${deadlineStr}</span></p>` : ''}
            </div>
            <div class="flex items-center gap-3 mb-4">
                <div class="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div class="h-full ${progressColor} rounded-full transition-all" style="width:${p.progress}%"></div>
                </div>
                <span class="text-xs font-semibold text-slate-500 w-10 text-right">${p.progress}%</span>
            </div>
        </div>
        <div class="flex md:flex-col items-center justify-center gap-3 p-4 md:p-6 md:border-l border-t md:border-t-0 border-slate-100">
            ${actionBtn}
            <a href="contractor-details.html?id=${p._id}" class="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors">
                View Details
                <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/></svg>
            </a>
        </div>
    </div>`;
}


// ======================
// STATS
// ======================
function updateStats() {
    const total = allProjects.length;
    const ongoing = allProjects.filter(p => p.status === 'Ongoing').length;
    const pending = allProjects.filter(p => p.status === 'Approval Requested').length;
    const completed = allProjects.filter(p => p.status === 'Completed').length;
    document.getElementById('statTotal').textContent = total;
    document.getElementById('statOngoing').textContent = ongoing;
    document.getElementById('statPending').textContent = pending;
    document.getElementById('statCompleted').textContent = completed;
}


// ======================
// TAB SWITCHING
// ======================
function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('active');
        b.className = b.className.replace('text-slate-900 border-orange-500', 'text-slate-400').replace('font-semibold', 'font-medium');
    });
    const panels = { ongoing: 'panelOngoing', completed: 'panelCompleted' };
    const tabs = { ongoing: 'tabOngoing', completed: 'tabCompleted' };
    Object.values(panels).forEach(id => document.getElementById(id).classList.add('hidden'));
    document.getElementById(panels[tab]).classList.remove('hidden');
    const btn = document.getElementById(tabs[tab]);
    btn.classList.add('active');
    btn.className = btn.className.replace('text-slate-400', 'text-slate-900 border-orange-500').replace('font-medium', 'font-semibold');
}


// ======================
// CAMERA MODAL (identical to contractor-details.js)
// ======================
async function openProgressModal(projectId, projectName, currentProgress) {
    capturedBlob = null;
    document.getElementById('modalProjectId').value = projectId;
    document.getElementById('modalProjectName').textContent = projectName;
    document.getElementById('modalCurrentPct').textContent = currentProgress + '%';
    document.getElementById('modalCurrentBar').style.width = currentProgress + '%';
    document.getElementById('newProgress').value = '';
    document.getElementById('newProgress').min = currentProgress + 1;
    document.getElementById('progressComment').value = '';
    // document.getElementById('fallbackPhoto').value = '';
    document.getElementById('gpsLocation').value = '';
    document.getElementById('capturedOverlay').classList.add('hidden');
    document.getElementById('btnRetake').classList.add('hidden');
    document.getElementById('btnSnap').classList.remove('hidden');

    // Remove any previous map link
    const oldMapLink = document.getElementById('gpsMapLink');
    if (oldMapLink) oldMapLink.remove();

    const m = document.getElementById('progressModal');
    m.classList.remove('hidden');
    m.classList.add('flex');

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
    }

    // Auto-detect GPS
    detectGPS();
}

// --- Submission & Closure Logic ---
async function submitProgress() {
    // 1. Mandatory Live Photo Check
    if (!capturedBlob) {
        showToast('Live photo is REQUIRED. Please capture a photo of the site.', 'error');
        return;
    }

    const btn = document.getElementById('submitBtn');
    btn.textContent = 'Submitting...';
    btn.disabled = true;

    // Proceed with FormData and API call...
}

function closeProgressModal() {
    // Stop camera stream to free up resources
    if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
        cameraStream = null;
    }
    const video = document.getElementById('cameraFeed');
    video.srcObject = null;

    const m = document.getElementById('progressModal');
    m.classList.add('hidden');
    m.classList.remove('flex');
}

document.getElementById('progressModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeProgressModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeProgressModal(); });


// ======================
// SNAP / RETAKE PHOTO
// ======================
function snapPhoto() {
    const video = document.getElementById('cameraFeed');
    const canvas = document.getElementById('cameraCanvas');

    if (!video.srcObject) {
        showToast('Camera not available. Please upload a photo instead.', 'error');
        return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

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


// ======================
// GPS DETECTION
// ======================
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


// ======================
// SUBMIT PROGRESS
// ======================
async function submitProgress() {
    const progress = document.getElementById('newProgress').value;
    const description = document.getElementById('progressComment').value.trim();

    if (!progress || !description) {
        showToast('Please fill in progress and description.', 'error');
        return;
    }

    const btn = document.getElementById('submitBtn');
    btn.textContent = 'Submitting...';
    btn.disabled = true;

    try {
        const formData = new FormData();
        formData.append('projectId', document.getElementById('modalProjectId').value);
        formData.append('progressClaimed', progress);
        formData.append('description', description);

        // Add GPS to description if available
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
            closeProgressModal();
            fetchProjects();
        } else {
            showToast(data.message || 'Submission failed.', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Network error. Please try again.', 'error');
    }

    btn.textContent = 'Submit for Approval';
    btn.disabled = false;
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
