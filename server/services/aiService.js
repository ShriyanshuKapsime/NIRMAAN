/**
 * NIRMAAN AI helpers — improve citizen report wording and simplify technical text.
 *
 * Provider order: Groq (GROQ_API_KEY) → OpenAI (OPENAI_API_KEY) → local mock (offline / no key).
 * Groq uses the OpenAI-compatible Chat Completions API.
 */

const MAX_INPUT_CHARS = 12000;
/** Cap formatted context so prompts stay within practical limits */
const MAX_CONTEXT_CHARS = 56000;
const MAX_CLAIM_DESC_CHARS = 12000;
const MAX_ADMIN_COMMENT_CHARS = 4000;
const MAX_GROUND_EXCERPT_CHARS = 1200;

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

/** Strip model output to plain text (no markdown fences). */
function normalizeModelOutput(raw) {
    if (!raw || typeof raw !== 'string') return '';
    let s = raw.trim();
    const fence = /^```(?:\w*)?\s*([\s\S]*?)```$/m;
    const m = s.match(fence);
    if (m) s = m[1].trim();
    return s;
}

/**
 * Groq Chat Completions (OpenAI-compatible). Env: GROQ_API_KEY, optional GROQ_MODEL.
 * Default model is fast and good for rewriting; override if Groq deprecates it.
 */
async function groqComplete(systemPrompt, userContent, maxTokens = 1024) {
    const key = process.env.GROQ_API_KEY;
    if (!key) return null;

    const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
    const res = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model,
            temperature: 0.35,
            max_tokens: maxTokens,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userContent },
            ],
        }),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Groq error ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    return normalizeModelOutput(text || '');
}

/**
 * Optional: OpenAI Chat Completions. Set OPENAI_API_KEY and optionally OPENAI_MODEL (default gpt-4o-mini).
 */
async function openaiComplete(systemPrompt, userContent, maxTokens = 1024) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) return null;

    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model,
            temperature: 0.35,
            max_tokens: maxTokens,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userContent },
            ],
        }),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OpenAI error ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    return normalizeModelOutput(text || '');
}

/** Try Groq first, then OpenAI. Returns null if neither key is configured. */
async function llmComplete(systemPrompt, userContent, options = {}) {
    const maxTokens = options.maxTokens ?? 1024;
    if (process.env.GROQ_API_KEY) {
        const g = await groqComplete(systemPrompt, userContent, maxTokens);
        if (g) return g;
    }
    if (process.env.OPENAI_API_KEY) {
        const o = await openaiComplete(systemPrompt, userContent, maxTokens);
        if (o) return o;
    }
    return null;
}

function truncCtx(s, maxLen) {
    if (s == null) return '';
    const t = String(s);
    if (t.length <= maxLen) return t;
    return `${t.slice(0, maxLen)}\n[…truncated]`;
}

/**
 * Turn structured portal JSON from the citizen UI into a large plain-text context block for the LLM.
 */
function buildImproveWritingContextBlock(ctx) {
    if (!ctx || typeof ctx !== 'object' || Array.isArray(ctx)) return '';

    const sections = [];
    const p = ctx.project;
    if (p && typeof p === 'object') {
        sections.push('=== PROJECT (NIRMAAN public record) ===');
        sections.push(`Project name: ${p.name ?? '—'}`);
        sections.push(`Location: ${p.location ?? '—'}`);
        sections.push(`Listed contractor: ${p.contractorName ?? '—'}`);
        if (p.budgetDisplay != null && String(p.budgetDisplay).trim()) {
            sections.push(`Budget (as shown on portal): ${p.budgetDisplay}`);
        } else if (p.budgetRaw != null && String(p.budgetRaw).trim()) {
            sections.push(`Budget: ${p.budgetRaw}`);
        }
        sections.push(`Project status: ${p.projectStatus ?? p.status ?? '—'}`);
        sections.push(`Overall progress on record (%): ${p.officialProgressPercent ?? p.progress ?? '—'}`);
        if (p.deadlineISO) sections.push(`Deadline on record: ${p.deadlineISO}`);
        if (p.sitePhotoUrl) sections.push(`Official site photo URL: ${p.sitePhotoUrl}`);
        if (p.contractorRatingOnPortal) {
            const cr = p.contractorRatingOnPortal;
            sections.push(
                `Contractor rating on portal: ${typeof cr === 'object' && cr !== null ? (cr.label || JSON.stringify(cr)) : cr}`,
            );
        }
        sections.push(`Internal project id: ${p.projectId ?? '—'}`);
    }

    const sel = ctx.selectedClaim;
    sections.push('');
    sections.push('=== CONTRACTOR CLAIM SELECTED IN THE REPORT FORM ===');
    sections.push(
        '(The citizen picked this under "Link to Contractor Request". The observation should relate to this claim when rewriting.)',
    );
    if (sel && typeof sel === 'object') {
        sections.push(`Request reference: ${sel.requestRef ?? '—'}`);
        sections.push(`Progress on this claim: ${sel.previousProgressPercent ?? '—'}% → ${sel.claimedProgressPercent ?? '—'}%`);
        sections.push(`Claim status: ${sel.status ?? '—'}`);
        sections.push(`Contractor name on claim: ${sel.contractorName ?? '—'}`);
        sections.push(`Claim submitted at: ${sel.submittedAt ?? '—'}`);
        if (sel.lastUpdated) sections.push(`Claim last updated: ${sel.lastUpdated}`);
        if (sel.photoUrl) sections.push(`Contractor proof image URL: ${sel.photoUrl}`);
        sections.push('--- Full contractor description for this claim ---');
        sections.push(truncCtx(sel.description, MAX_CLAIM_DESC_CHARS) || '(empty)');
        if (sel.adminComment && String(sel.adminComment).trim()) {
            sections.push('--- Admin / reviewer comment on this claim ---');
            sections.push(truncCtx(sel.adminComment, MAX_ADMIN_COMMENT_CHARS));
        }
    } else {
        sections.push(
            '(No claim was selected in the dropdown. Use ALL CLAIMS below plus the citizen draft; do not assume a specific request id.)',
        );
    }

    if (Array.isArray(ctx.allClaims) && ctx.allClaims.length) {
        sections.push('');
        sections.push(
            `=== ALL CONTRACTOR PROGRESS CLAIMS ON THIS PROJECT (${ctx.allClaims.length} entries; full text for each) ===`,
        );
        const selId = sel && sel.requestId != null ? String(sel.requestId) : null;
        for (let i = 0; i < ctx.allClaims.length; i++) {
            const c = ctx.allClaims[i];
            if (!c || typeof c !== 'object') continue;
            const rid = c.requestId != null ? String(c.requestId) : '';
            const mark = selId && rid === selId ? ' **(matches form selection)**' : '';
            sections.push(
                `--- Claim ${i + 1}${mark}: ${c.requestRef || '?'} | ${c.previousProgressPercent ?? '?'}% → ${c.claimedProgressPercent ?? '?'}% | ${c.status || '?'} | submitted ${c.submittedAt || '?'} ---`,
            );
            sections.push(truncCtx(c.description, MAX_CLAIM_DESC_CHARS) || '(no description)');
            if (c.adminComment && String(c.adminComment).trim()) {
                sections.push(`Admin: ${truncCtx(c.adminComment, 1200)}`);
            }
            sections.push('');
        }
    }

    if (Array.isArray(ctx.groundReportsSample) && ctx.groundReportsSample.length) {
        sections.push('=== OTHER CITIZEN GROUND REPORTS (recent excerpts; context only — do not copy wording) ===');
        for (const g of ctx.groundReportsSample) {
            if (!g || typeof g !== 'object') continue;
            sections.push(
                `· ${g.date || '?'} | linked request: ${g.linkedRequestRef || 'none'} | ${truncCtx(g.observationExcerpt, MAX_GROUND_EXCERPT_CHARS)}`,
            );
        }
    }

    if (typeof ctx.portalNote === 'string' && ctx.portalNote.trim()) {
        sections.push('');
        sections.push('=== PORTAL NOTE ===');
        sections.push(ctx.portalNote.trim());
    }

    let out = sections.join('\n');
    if (out.length > MAX_CONTEXT_CHARS) {
        out = `${out.slice(0, MAX_CONTEXT_CHARS)}\n\n[Overall context truncated by server.]`;
    }
    return out;
}

/**
 * Mock: formal citizen-report style when no API key (deterministic, demo-friendly).
 */
function mockImproveWriting(text) {
    let s = text.trim().replace(/\s+/g, ' ');
    if (!s) return '';

    // Targeted phrase upgrades (order matters for common citizen phrasing)
    const rules = [
        [/\broad work is very slow\b/gi, 'Road construction progress appears significantly delayed'],
        [/\bvery slow\b/gi, 'significantly delayed'],
        [/\broad work\b/gi, 'road construction'],
        [/\bmany places are broken\b/gi, 'multiple sections remain damaged'],
        [/\bnobody working properly\b/gi, 'on-site work activity seems insufficient'],
        [/\bain'?t\b/gi, 'is not'],
        [/\bcan'?t\b/gi, 'cannot'],
        [/\bwon'?t\b/gi, 'will not'],
        [/\bdon'?t\b/gi, 'do not'],
        [/\bhasn'?t\b/gi, 'has not'],
        [/\bkinda\b/gi, 'somewhat'],
        [/\bpretty bad\b/gi, 'seriously deficient'],
        [/\bstuff\b/gi, 'materials'],
    ];

    for (const [re, rep] of rules) {
        s = s.replace(re, rep);
    }

    s = s.charAt(0).toUpperCase() + s.slice(1);
    if (!/[.!?]$/.test(s)) s += '.';

    // If input was long, keep paragraph breaks roughly: split on newlines from original
    return s;
}

/**
 * Mock: plain-language paraphrase for contractor/technical lines.
 */
function mockSimplifyTechnical(text) {
    let s = text.trim().replace(/\s+/g, ' ');
    if (!s) return '';

    const fullPhrase =
        /^drainage reinforcement and asphalt compaction completed for phase-?2 corridor\.?$/i;
    if (fullPhrase.test(s)) {
        return 'The drainage system work and road strengthening for Phase 2 have been completed.';
    }

    const rules = [
        [/\bdrainage reinforcement\b/gi, 'work to strengthen the drainage system'],
        [/\basphalt compaction\b/gi, 'pressing and smoothing the road surface'],
        [/\bphase-?2\s+corridor\b/gi, 'Phase 2 section of the road'],
        [/\bcorridor\b/gi, 'section of the road'],
        [/\breinforcement\b/gi, 'strengthening'],
        [/\bcompaction\b/gi, 'pressing the surface firm'],
        [/\basphalt\b/gi, 'road surface material'],
        [/\bcompleted\b/gi, 'has been finished'],
        [/\bverified\b/gi, 'checked and confirmed'],
        [/\bimplemented\b/gi, 'put in place'],
    ];

    for (const [re, rep] of rules) {
        s = s.replace(re, rep);
    }

    s = s.charAt(0).toUpperCase() + s.slice(1);
    if (!/[.!?]$/.test(s)) s += '.';
    return s;
}

async function improveWriting(text, context) {
    const input = String(text || '').slice(0, MAX_INPUT_CHARS);
    if (!input.trim()) {
        throw new Error('Empty text');
    }

    const contextBlock = buildImproveWritingContextBlock(context);

    const system = `You rewrite on-ground citizen observations for NIRMAAN, a public-works transparency portal.
The reader is the contractor, site supervision, and/or public administration reviewing a specific project—not HR or generic compliance.

You are often given a large CONTEXT block: current project details, the contractor claim the citizen selected in the form (if any), every contractor progress claim on that project with full descriptions and admin comments, and excerpts of other citizen reports. USE IT to ground the rewrite: project name, location, contractor, progress percentages, claim status, and what the contractor already stated in the linked claim. The observation should read as a citizen response to accountability for THIS project and (when selected) THIS claim.

Do not contradict data in the CONTEXT. Do not invent contractor claims, admin decisions, or site facts that are not in the CONTEXT or in the citizen's draft.

Output ONLY the rewritten observation. No title, preamble, quotation marks, or "Here is" wrapper.

Voice and audience:
- Write as a citizen reporting what they saw at the worksite, directed at those accountable: the contractor, contractor's team/crew, site management, and/or the administration/agency overseeing the project.
- Prefer concrete subjects: "the contractor", "the contractor's personnel on site", "workers present at the site", "site supervision", "the administration", "the department", or "authorities"—whichever matches what the citizen described and the CONTEXT.
- If the citizen refers vaguely to "they" or "people", resolve it using CONTEXT (who is responsible on site) plus the draft; do not invent names or entities not implied.

Banned vague corporate phrasing (never use):
- "individuals in question", "the parties involved", "stakeholders", "relevant persons", or similar.

Depth and style (critical):
- Do NOT produce a thin rewrite that only swaps active/passive voice or replaces a handful of words. The output must read like a serious field observation, not a grammar tweak.
- If the draft is short (about one sentence or a fragment), expand it into roughly **3–6 sentences** of clear, professional prose—unless the citizen already wrote a long paragraph, in which case polish in place without unnecessary padding.
- Use a logical structure when it fits: (1) state the concern or observation plainly; (2) briefly relate it to contractor accountability and, when CONTEXT allows, to what was **claimed** on the portal (progress, compliance, or statements in the linked claim—cite only what appears in CONTEXT or the draft); (3) note why it matters in a general way (safety, quality, public interest, timely delivery) **without** inventing specific incidents; (4) where appropriate, close with a neutral request for review or verification by site supervision or administration—without alleging legal outcomes.
- Prefer precise, formal wording ("does not appear to align with", "raises concern regarding", "on-site conditions suggest") over blunt or vague one-liners, while **never** asserting as proven fact what the citizen only alleged.

Tone: formal, clear, neutral, suitable for public records. Fix grammar and spelling; keep every important detail from the citizen draft (numbers, dates, locations, materials, safety issues).

Preserve all factual claims from the citizen draft—do not invent specific violations, equipment, injuries, or events not stated. You may add **professional framing and structure** only.

Keep paragraph breaks where the citizen draft used line breaks (same number of newline-separated blocks). If the draft is a single short line, output a **single paragraph** of multiple sentences (do not add extra blank paragraphs).`;

    const instructions =
        'Rewrite the CITIZEN DRAFT at the end into a **detailed, professional** observation for the contractor, on-site supervision, and public administration. ' +
        'Ground it in this project and, when CONTEXT includes a selected claim, relate the observation to that claim and portal-recorded progress where relevant. ' +
        'Expand thin drafts into several well-formed sentences as instructed in the system message—do not only change voice or swap synonyms. ' +
        'Output ONLY the improved text. Do not use "individuals in question".';

    let userPayload;
    if (contextBlock.trim()) {
        userPayload =
            `${instructions}\n\n======== BEGIN CONTEXT (portal data) ========\n${contextBlock}\n======== END CONTEXT ========\n\n` +
            `======== CITIZEN DRAFT (rewrite only this; preserve meaning and facts) ========\n${input}\n======== END DRAFT ========`;
    } else {
        userPayload =
            `${instructions}\n\n(No portal context was sent; rely only on the draft.)\n\n---\n\n${input}`;
    }

    const out = await llmComplete(system, userPayload, { maxTokens: 3072 });
    if (out) return out;

    // Preserve newlines from user in mock path
    const parts = input.split(/\r?\n/);
    if (parts.length > 1) {
        return parts.map((p) => mockImproveWriting(p)).join('\n');
    }
    return mockImproveWriting(input);
}

async function simplifyTechnical(text) {
    const input = String(text || '').slice(0, MAX_INPUT_CHARS);
    if (!input.trim()) {
        throw new Error('Empty text');
    }

    const system = `You explain construction/project updates in simple language for residents.
Rules:
- Output ONLY the simplified explanation, no preamble.
- Short, friendly, non-technical. No jargon unless unavoidable; if used, define it briefly.
- Preserve meaning: do not change dates, percentages, phase names, or commitments.
- If the input is already simple, make it slightly clearer without adding facts.`;

    const out = await llmComplete(system, input);
    if (out) return out;

    return mockSimplifyTechnical(input);
}

// =====================================================================
// MULTI-AGENT ADJUDICATION PIPELINE — Deterministic Heuristic v2
//
// STAGE 1: Agent A (Location) + Agent B (Scope/Sentiment) → concurrent
//          Both return strict JSON classifications.
// STAGE 2: Deterministic Node.js math → Divergence Score (0.0–1.0)
// STAGE 3: Agent C (Executive) → sequential, receives pre-calculated score
// =====================================================================

/**
 * Safely parse LLM output as JSON.
 * Strips markdown fences, finds JSON object boundaries, returns parsed object or null.
 */
function safeParseLLMJson(raw) {
    if (!raw || typeof raw !== 'string') return null;
    try {
        let s = raw.trim();
        // Strip markdown code fences: ```json ... ``` or ``` ... ```
        const fenceMatch = s.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (fenceMatch) s = fenceMatch[1].trim();
        // Find outermost JSON object boundaries
        const braceStart = s.indexOf('{');
        const braceEnd = s.lastIndexOf('}');
        if (braceStart !== -1 && braceEnd > braceStart) {
            s = s.slice(braceStart, braceEnd + 1);
        }
        return JSON.parse(s);
    } catch {
        return null;
    }
}

/**
 * Agent A — Location Verifier (1st LLM Call)
 * Compares contractor GPS vs citizen GPS. Returns strict JSON classification.
 *
 * Output: { locationSummary: string, locationStatus: "match"|"minor_anomaly"|"major_mismatch" }
 */
async function agentA_LocationVerifier(request, reports) {
    const systemPrompt = `You are Agent A — a GPS Location Verifier for a public infrastructure transparency platform called NIRMAAN.

Your task:
1. Extract any GPS coordinates (latitude, longitude) from the contractor's description text. Look for patterns like "GPS: lat, lon" or "📍 GPS: lat, lon".
2. Extract any GPS coordinates from the citizen report comments.
3. Compare the coordinates. Determine if they generally match (within ~1-2 km for the same site), have a minor anomaly (2-10 km difference or partial data), or a major mismatch (>10 km or clearly different sites suggesting location spoofing).
4. If no GPS data is found in either source, classify as "match" (no evidence of spoofing) and state that clearly in the summary.

You MUST output ONLY valid JSON in this EXACT format (no markdown fences, no text before or after):
{
  "locationSummary": "3-5 sentence summary of location analysis",
  "locationStatus": "match"
}

The locationStatus field MUST be exactly one of: "match", "minor_anomaly", or "major_mismatch".`;

    const citizenGPS = reports.map((r, i) => {
        const gpsMatch = (r.comment || '').match(/GPS:\s*([-\d.]+),\s*([-\d.]+)/);
        const coords = gpsMatch ? `GPS: ${gpsMatch[1]}, ${gpsMatch[2]}` : 'No GPS tag';
        return `Report ${i + 1} (${r.citizenAnonId || 'Anonymous'}): ${coords} — "${truncCtx(r.comment, 300)}"`;
    }).join('\n');

    const userPrompt = `=== CONTRACTOR DESCRIPTION ===
${truncCtx(request.description, 2000) || '(No description provided)'}

=== CITIZEN REPORTS (${reports.length} total) ===
${citizenGPS || '(No citizen reports)'}

Analyze the GPS coordinates and output your JSON classification.`;

    const raw = await llmComplete(systemPrompt, userPrompt, { maxTokens: 512 });
    const parsed = safeParseLLMJson(raw);

    if (parsed && parsed.locationSummary) {
        const validStatuses = ['match', 'minor_anomaly', 'major_mismatch'];
        return {
            locationSummary: String(parsed.locationSummary),
            locationStatus: validStatuses.includes(parsed.locationStatus)
                ? parsed.locationStatus
                : 'minor_anomaly'
        };
    }

    // Fallback: LLM unavailable or bad JSON
    return {
        locationSummary: raw || 'Agent A: No LLM provider available. Location verification skipped.',
        locationStatus: 'minor_anomaly'
    };
}

/**
 * Agent B — Scope & Sentiment Analyzer (2nd LLM Call)
 * Evaluates claimed progress plausibility and classifies citizen sentiment.
 *
 * Output: { scopeAndSentiment: string, overallSentiment: "Positive"|"Mixed"|"Negative" }
 */
async function agentB_ScopeSentiment(project, request, reports) {
    const systemPrompt = `You are Agent B — a Scope & Sentiment Analyzer for a public infrastructure transparency platform called NIRMAAN.

Your task:
1. Evaluate if the contractor's claimed progress increment makes sense given the project scope (budget, deadline, type of work).
2. Summarize the community consensus based on citizen report text comments, their ratings (1-5), and their trust votes (trueVotes = community believes report is genuine, fakeVotes = community suspects report is fabricated).
3. Based on the overall tone of citizen reports, classify the sentiment.
4. Flag any red flags: massive progress jumps, overwhelmingly negative citizen sentiment, high fake-vote counts.

You MUST output ONLY valid JSON in this EXACT format (no markdown fences, no text before or after):
{
  "scopeAndSentiment": "4-6 sentence summary of scope alignment and community sentiment",
  "overallSentiment": "Mixed"
}

The overallSentiment field MUST be exactly one of: "Positive", "Mixed", or "Negative".`;

    const reportsSummary = reports.map((r, i) => {
        return `Report ${i + 1}: Rating=${r.rating}/5 | TrueVotes=${r.trueVotes || 0} | FakeVotes=${r.fakeVotes || 0} | "${truncCtx(r.comment, 250)}"`;
    }).join('\n');

    const deadlineStr = project.deadline
        ? new Date(project.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        : 'Not specified';

    const userPrompt = `=== PROJECT SCOPE ===
Project: ${project.name}
Location: ${project.location}
Budget: ${project.budget || 'Not specified'}
Deadline: ${deadlineStr}
Current Official Progress: ${project.progress}%

=== CONTRACTOR CLAIM ===
Previous Progress: ${request.previousProgress}% → Claimed Progress: ${request.progressClaimed}%
Contractor: ${request.contractorName}
Description: ${truncCtx(request.description, 1500) || '(No description)'}

=== CITIZEN REPORTS (${reports.length} total) ===
${reportsSummary || '(No citizen reports submitted)'}

Analyze the scope alignment and community sentiment, then output your JSON classification.`;

    const raw = await llmComplete(systemPrompt, userPrompt, { maxTokens: 512 });
    const parsed = safeParseLLMJson(raw);

    if (parsed && parsed.scopeAndSentiment) {
        const validSentiments = ['Positive', 'Mixed', 'Negative'];
        return {
            scopeAndSentiment: String(parsed.scopeAndSentiment),
            overallSentiment: validSentiments.includes(parsed.overallSentiment)
                ? parsed.overallSentiment
                : 'Mixed'
        };
    }

    // Fallback: LLM unavailable or bad JSON
    return {
        scopeAndSentiment: raw || 'Agent B: No LLM provider available. Scope and sentiment analysis skipped.',
        overallSentiment: 'Mixed'
    };
}

/**
 * STAGE 2 — Deterministic Divergence Score (pure Node.js math, no LLM).
 *
 * Formula: D = clamp(L + S + W, 0.0, 1.0)
 *   L = Location Penalty     (0.0 / 0.2 / 0.4)
 *   S = Sentiment Penalty    (0.0 / 0.15 / 0.4)
 *   W = Community Validation  (−0.2 … +0.2)
 *
 * @param {string} locationStatus   — "match" | "minor_anomaly" | "major_mismatch"
 * @param {string} overallSentiment — "Positive" | "Mixed" | "Negative"
 * @param {Array}  reports          — Mongoose Report docs with trueVotes, fakeVotes
 * @returns {number} Divergence score formatted to 2 decimal places
 */
function calculateDivergenceScore(locationStatus, overallSentiment, reports) {
    // --- Location Penalty (L) ---
    const locationPenalties = { major_mismatch: 0.4, minor_anomaly: 0.2, match: 0.0 };
    const L = locationPenalties[locationStatus] ?? 0.2;

    // --- Sentiment Penalty (S) ---
    const sentimentPenalties = { Negative: 0.4, Mixed: 0.15, Positive: 0.0 };
    const S = sentimentPenalties[overallSentiment] ?? 0.15;

    // --- Community Validation Weight (W) ---
    let totalWeight = 0;
    const safeReports = Array.isArray(reports) ? reports : [];

    for (const report of safeReports) {
        const trueVotes = Number(report.trueVotes) || 0;
        const fakeVotes = Number(report.fakeVotes) || 0;
        const totalVotes = trueVotes + fakeVotes;
        const netCredibility = (trueVotes - fakeVotes) / (totalVotes + 1);

        // Negative sentiment + credible reports → increase divergence
        // Positive sentiment + credible reports → decrease divergence
        if (overallSentiment === 'Negative') {
            totalWeight += netCredibility;
        } else if (overallSentiment === 'Positive') {
            totalWeight -= netCredibility;
        }
        // "Mixed" → netCredibility contributes 0 (no adjustment)
    }

    // Normalize by report count and scale to ±0.2
    const rawW = (totalWeight / (safeReports.length || 1)) * 0.2;
    const W = Math.max(-0.2, Math.min(0.2, rawW));

    // --- Final Score ---
    const D = Math.max(0.0, Math.min(1.0, L + S + W));
    return parseFloat(D.toFixed(2));
}

/**
 * Agent C — Executive Adjudicator (3rd LLM Call)
 * Receives pre-calculated divergence score from Stage 2.
 * Synthesizes Agent A + B summaries into a final executive summary.
 * Does NOT invent or modify the score.
 *
 * Output: { executiveSummary: string, recommendation: "Approve"|"Reject"|"Manual Inspection Required" }
 */
async function agentC_ExecutiveAdjudicator(agentA, agentB, divergenceScore) {
    const systemPrompt = `You are Agent C — the Executive Adjudicator for a public infrastructure transparency platform called NIRMAAN.

You receive:
- Agent A's location verification analysis.
- Agent B's scope and sentiment analysis.
- A pre-calculated Divergence Score (0.0–1.0), computed deterministically by the backend.

Your task:
1. Synthesize both agents' findings into a coherent 2-3 sentence executive summary.
2. Do NOT invent, modify, or recalculate the Divergence Score. Reference the provided score as-is.
3. Based on the evidence and score, provide a recommendation:
   - "Approve" if score ≤ 0.3 and no major red flags.
   - "Manual Inspection Required" if score is 0.3–0.6 or findings are inconclusive.
   - "Reject" if score > 0.6 or there is clear evidence of fraud/mismatch.

You MUST output ONLY valid JSON in this EXACT format (no markdown fences, no text before or after):
{
  "executiveSummary": "Final 2-3 sentence conclusion synthesizing all findings.",
  "recommendation": "Approve"
}

The recommendation field MUST be exactly one of: "Approve", "Reject", or "Manual Inspection Required".`;

    const userPrompt = `=== AGENT A OUTPUT (Location Verification) ===
Location Status: ${agentA.locationStatus}
Summary: ${agentA.locationSummary}

=== AGENT B OUTPUT (Scope & Sentiment) ===
Overall Sentiment: ${agentB.overallSentiment}
Summary: ${agentB.scopeAndSentiment}

=== PRE-CALCULATED DIVERGENCE SCORE ===
Score: ${divergenceScore} (0.0 = fully aligned, 1.0 = complete fraud)

Synthesize these findings and output your JSON verdict.`;

    const raw = await llmComplete(systemPrompt, userPrompt, { maxTokens: 512 });
    const parsed = safeParseLLMJson(raw);

    if (parsed && parsed.executiveSummary) {
        const validRecs = ['Approve', 'Reject', 'Manual Inspection Required'];
        return {
            executiveSummary: String(parsed.executiveSummary),
            recommendation: validRecs.includes(parsed.recommendation)
                ? parsed.recommendation
                : 'Manual Inspection Required'
        };
    }

    // Fallback: LLM unavailable or bad JSON — derive recommendation from score
    let fallbackRec = 'Manual Inspection Required';
    if (divergenceScore <= 0.3) fallbackRec = 'Approve';
    else if (divergenceScore > 0.6) fallbackRec = 'Reject';

    return {
        executiveSummary: raw
            ? `Agent C could not produce structured output. Raw: ${raw.slice(0, 300)}`
            : 'No LLM provider available. Recommendation is based solely on the deterministic divergence score.',
        recommendation: fallbackRec
    };
}

/**
 * Main orchestration — 3-stage pipeline with deterministic scoring.
 *
 * STAGE 1: Agent A + Agent B → concurrent LLM classification (Promise.all)
 * STAGE 2: Deterministic Node.js math → Divergence Score
 * STAGE 3: Agent C → sequential LLM synthesis (receives pre-calculated score)
 *
 * @param {Object} project  — Mongoose Project document
 * @param {Object} request  — Mongoose Request document
 * @param {Array}  reports  — Array of Mongoose Report documents
 * @returns {Object} Final adjudication result
 */
async function textOnlyAdjudication(project, request, reports) {
    const safeReports = Array.isArray(reports) ? reports : [];

    // ─── STAGE 1: Concurrent classification (2 LLM calls) ───
    const [agentA, agentB] = await Promise.all([
        agentA_LocationVerifier(request, safeReports),
        agentB_ScopeSentiment(project, request, safeReports)
    ]);

    console.log(`[Multi-Agent] Agent A (Location) complete ✓  → status: ${agentA.locationStatus}`);
    console.log(`[Multi-Agent] Agent B (Scope/Sentiment) complete ✓  → sentiment: ${agentB.overallSentiment}`);

    // ─── STAGE 2: Deterministic divergence score (Node.js math, no LLM) ───
    const D = calculateDivergenceScore(agentA.locationStatus, agentB.overallSentiment, safeReports);

    console.log(`[Multi-Agent] Stage 2 (Deterministic Score) complete ✓  → D = ${D}`);

    // ─── STAGE 3: Executive synthesis (1 LLM call) ───
    const agentC = await agentC_ExecutiveAdjudicator(agentA, agentB, D);

    console.log(`[Multi-Agent] Agent C (Executive) complete ✓  → recommendation: ${agentC.recommendation}`);

    return {
        locationVerification: agentA.locationSummary,
        scopeAndSentiment: agentB.scopeAndSentiment,
        divergenceScore: D,
        executiveSummary: agentC.executiveSummary,
        recommendation: agentC.recommendation
    };
}

module.exports = {
    improveWriting,
    simplifyTechnical,
    textOnlyAdjudication,
    MAX_INPUT_CHARS,
};

/*
 * Env summary:
 * - GROQ_API_KEY (+ optional GROQ_MODEL, default llama-3.3-70b-versatile) — primary.
 * - OPENAI_API_KEY (+ optional OPENAI_MODEL) — fallback if Groq is not set.
 *
 * Google Gemini: add a geminiComplete() and call it from llmComplete() if desired.
 */
