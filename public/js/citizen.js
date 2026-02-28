// =============================================
// NIRMAAN — Citizen Portal Frontend Logic
// =============================================

const API = window.location.origin;

let allProjects = [];
let ratingsMap = {};    // { projectId: { avg, count } }
let currentFilter = 'all';

// ======================
// INIT
// ======================
document.addEventListener('DOMContentLoaded', async () => {
    detectLocation();
    await Promise.all([fetchProjects(), fetchRatings()]);
    renderCards();
    updateStats();

    // Live search
    document.getElementById('searchInput').addEventListener('input', () => renderCards());
});


// ======================
// FETCH PROJECTS
// ======================
async function fetchProjects() {
    try {
        const res = await fetch(`${API}/api/projects`);
        allProjects = await res.json();
    } catch (err) {
        console.error('Error fetching projects:', err);
    }
}

// ======================
// FETCH RATINGS
// ======================
async function fetchRatings() {
    try {
        const res = await fetch(`${API}/api/projects/ratings/all`);
        ratingsMap = await res.json();
    } catch (err) {
        console.error('Error fetching ratings:', err);
    }
}


// ======================
// LOCATION DETECTION
// ======================
function detectLocation() {
    const el = document.getElementById('userLocation');
    if (!navigator.geolocation) {
        el.textContent = 'Location unavailable';
        return;
    }
    navigator.geolocation.getCurrentPosition(
        async pos => {
            const lat = pos.coords.latitude.toFixed(4);
            const lon = pos.coords.longitude.toFixed(4);
            // Try reverse geocoding via free Nominatim API
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`);
                const data = await res.json();
                const area = data.address.city || data.address.town || data.address.village || data.address.county || data.address.state || '';
                const state = data.address.state || '';
                el.textContent = area ? `${area}, ${state}` : `${lat}, ${lon}`;
            } catch {
                el.textContent = `${lat}, ${lon}`;
            }
        },
        () => { el.textContent = 'Location unavailable'; },
        { enableHighAccuracy: false, timeout: 8000 }
    );
}


// ======================
// FILTER & SEARCH
// ======================
function setFilter(filter) {
    currentFilter = filter;
    // Update button styles
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    const id = filter === 'all' ? 'filterAll' : filter === 'Ongoing' ? 'filterOngoing' : 'filterCompleted';
    document.getElementById(id).classList.add('active');
    renderCards();
}

function getFilteredProjects() {
    const query = document.getElementById('searchInput').value.toLowerCase().trim();
    let list = allProjects;

    // Status filter
    if (currentFilter !== 'all') {
        if (currentFilter === 'Ongoing') {
            list = list.filter(p => p.status !== 'Completed');
        } else {
            list = list.filter(p => p.status === currentFilter);
        }
    }

    // Search filter
    if (query) {
        list = list.filter(p =>
            p.name.toLowerCase().includes(query) ||
            p.location.toLowerCase().includes(query) ||
            (p.contractorName && p.contractorName.toLowerCase().includes(query))
        );
    }

    // Sort
    const sort = document.getElementById('sortSelect').value;
    if (sort === 'progress') {
        list = [...list].sort((a, b) => b.progress - a.progress);
    } else if (sort === 'rating') {
        list = [...list].sort((a, b) => {
            const ra = ratingsMap[a._id] ? ratingsMap[a._id].avg : 0;
            const rb = ratingsMap[b._id] ? ratingsMap[b._id].avg : 0;
            return rb - ra;
        });
    } else {
        list = [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    return list;
}


// ======================
// RENDER CARDS
// ======================
function renderCards() {
    const container = document.getElementById('projectList');
    const filtered = getFilteredProjects();

    document.getElementById('resultCount').textContent = filtered.length;

    if (filtered.length === 0) {
        container.innerHTML = `<div class="bg-white border border-slate-200 rounded-xl p-10 text-center">
            <svg class="w-14 h-14 mx-auto text-slate-200 mb-4" fill="none" stroke="currentColor" stroke-width="1" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/></svg>
            <h3 class="font-semibold text-slate-700 mb-1">No Projects Found</h3>
            <p class="text-sm text-slate-400">Try adjusting your search or filters.</p>
        </div>`;
        return;
    }

    container.innerHTML = filtered.map((p, i) => {
        const rating = ratingsMap[p._id] || { avg: 0, count: 0 };
        const starsHtml = renderStars(rating.avg);
        const delay = Math.min(i * 60, 400);

        const photoHTML = p.sitePhoto
            ? `<img src="${p.sitePhoto}" alt="${p.name}" class="w-full h-full object-cover"/>`
            : `<div class="text-center px-4">
                <svg class="w-10 h-10 mx-auto text-slate-300 mb-2" fill="none" stroke="currentColor" stroke-width="1" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"/></svg>
                <p class="text-xs text-slate-400">No Photo</p>
               </div>`;

        // Status badge
        const isCompleted = p.status === 'Completed';
        const badgeBg = isCompleted ? 'bg-emerald-50' : p.status === 'Approval Requested' ? 'bg-orange-50' : 'bg-slate-100';
        const badgeText = isCompleted ? 'text-emerald-700' : p.status === 'Approval Requested' ? 'text-orange-700' : 'text-slate-600';
        const badgeDot = isCompleted ? 'bg-emerald-500' : p.status === 'Approval Requested' ? 'bg-orange-500' : 'bg-slate-400';
        const progressColor = isCompleted ? 'bg-emerald-500' : 'bg-blue-900';

        const budgetStr = p.budget ? `₹${!isNaN(Number(p.budget)) ? Number(p.budget).toLocaleString('en-IN') : p.budget}` : '—';

        return `
        <div class="card-animate bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col md:flex-row hover:shadow-md transition-shadow" style="animation-delay:${delay}ms">
            <div class="md:w-60 h-48 md:h-auto bg-slate-100 flex items-center justify-center flex-shrink-0 relative overflow-hidden">
                ${photoHTML}
                ${isCompleted ? '<div class="absolute top-3 left-3 bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">✓ Verified Complete</div>' : ''}
            </div>
            <div class="flex-1 p-6">
                <div class="flex items-start justify-between gap-3 mb-3">
                    <div>
                        <h3 class="font-bold text-base text-slate-900 mb-0.5">${p.name}</h3>
                        <p class="text-sm text-slate-400 flex items-center gap-1">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/></svg>
                            ${p.location}
                        </p>
                    </div>
                    <span class="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full ${badgeBg} ${badgeText} text-xs font-semibold">
                        <span class="w-1.5 h-1.5 rounded-full ${badgeDot}"></span> ${p.status}
                    </span>
                </div>

                <!-- Progress Bar -->
                <div class="flex items-center gap-3 mb-4">
                    <div class="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div class="h-full ${progressColor} rounded-full transition-all" style="width:${p.progress}%"></div>
                    </div>
                    <span class="text-xs font-bold text-slate-600 w-10 text-right">${p.progress}%</span>
                </div>

                <!-- Contractor & Rating Row -->
                <div class="flex flex-wrap items-center gap-4 mb-4">
                    <div class="flex items-center gap-2">
                        <div class="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center">
                            <svg class="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0"/></svg>
                        </div>
                        <div>
                            <p class="text-xs text-slate-400">Contractor</p>
                            <p class="text-xs font-semibold text-slate-700">${p.contractorName}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        ${starsHtml}
                        <span class="text-xs font-bold text-slate-700">${rating.avg > 0 ? rating.avg + '/5' : 'No ratings'}</span>
                        ${rating.count > 0 ? `<span class="text-xs text-slate-400">(${rating.count})</span>` : ''}
                    </div>
                    <span class="text-xs text-slate-400 ml-auto">Budget: <span class="font-semibold text-slate-600">${budgetStr}</span></span>
                </div>
            </div>

            <!-- ACTION COLUMN -->
            <div class="flex md:flex-col items-center justify-center gap-3 p-4 md:p-6 md:border-l border-t md:border-t-0 border-slate-100 flex-shrink-0">
                <a href="citizen-details.html?id=${p._id}"
                    class="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-900 hover:bg-blue-800 text-white rounded-lg text-sm font-semibold transition-colors">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    View Details & Report
                </a>
            </div>
        </div>`;
    }).join('');
}


// ======================
// STAR RENDERING
// ======================
function renderStars(avg) {
    const fullStar = `<svg class="w-3.5 h-3.5 text-orange-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.065 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z"/></svg>`;
    const emptyStar = `<svg class="w-3.5 h-3.5 text-slate-200" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.065 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z"/></svg>`;

    const rounded = Math.round(avg);
    let html = '<div class="flex gap-0.5">';
    for (let i = 0; i < 5; i++) html += i < rounded ? fullStar : emptyStar;
    html += '</div>';
    return html;
}


// ======================
// STATS
// ======================
async function updateStats() {
    const total = allProjects.length;
    const ongoing = allProjects.filter(p => p.status !== 'Completed').length;

    document.getElementById('statTotal').textContent = total;
    document.getElementById('statOngoing').textContent = ongoing;

    // Fetch user credibility score
    const user = JSON.parse(localStorage.getItem('nirmaan_user') || 'null');
    if (user && user.email) {
        try {
            const res = await fetch(`${API}/api/reports/credibility/${encodeURIComponent(user.email)}`);
            const data = await res.json();
            document.getElementById('statCredibility').textContent = data.credibilityScore.toFixed(1);
        } catch (err) {
            console.error('Error fetching credibility:', err);
        }
    }
}
