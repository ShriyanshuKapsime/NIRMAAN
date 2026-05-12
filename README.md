# NIRMAAN: Where Every Brick is Accountable

**NIRMAAN** is a decentralized, 360-degree transparency and monitoring platform designed to eliminate corruption in rural development projects. By creating a verifiable digital trail between the Government, Contractors, and Citizens, we ensure that public infrastructure is built honestly and efficiently.

## The Core Problem
Billions are spent annually on public works like roads and sanitation, yet a significant "Information Gap" exists. Traditional reporting allows for:
* **Contractor Fraud:** Using old or staged photos to claim progress.
* **Lack of Oversight:** Citizens have no way to verify claims in real-time.
* **Opaque Approvals:** No permanent, public record of why work was approved or rejected.

## Our Solution
NIRMAAN bridges this gap through a three-way verification ecosystem:

### 1. The Admin Flow (The Controller)
* **Project Lifecycle Management:** Create and oversee projects with baseline site photos.
* **Evidence-Based Approval:** Admins compare contractor claims against citizen-submitted ground-reality reports.
* **Permanent Audit Trail:** Every Request ID creates a non-erasable history of approvals and rejections.

### 2. The Contractor Flow (The Executor)
* **Live-Only Reporting:** Contractors must capture live site photos; file uploads are disabled to prevent fraud.
* **Pre-emptive Correction:** Contractors view citizen feedback in real-time to fix issues before an official audit.

### 3. The Citizen Flow (The Independent Monitor)
* **Decentralized Verification:** Citizens upload geotagged photos to counter-verify contractor claims.
* **Reputation System:** We implemented a **Percentage-Based Credibility Score** (normalized to 5 stars).
* **Community Consensus:** Citizens vote on reports as "True" or "Fake". Reports reaching a high threshold of upvotes are automatically flagged for priority Admin review.

## Tech Stack
* **Frontend:** HTML5, CSS3, JavaScript (Vanilla/ES6+)
* **Backend:** Node.js, Express.js
* **Database:** MongoDB
* **Security:** Git-based version control with strict `.env` protection.

## Technical Highlights
* **Anti-Sybil Voting:** A security layer ensures each user can cast only one "True" or "Fake" vote per report.
* **Geographical Integrity:** Integrated **Google Maps** verification allows Admins to instantly see the exact location of a citizen's complaint.
* **Dynamic Reputation Logic:** Credibility scores are calculated as: 

$$Score = \left( \frac{\text{True Votes}}{\text{Total Votes}} \right) \times 5$$

## Installation & Setup

### 1. Prerequisites
Ensure you have **Node.js** and **npm** installed on your system.

### 2. Clone the Repository
```bash
git clone [https://github.com/ShriyanshuKapsime/NIRMAAN.git](https://github.com/ShriyanshuKapsime/NIRMAAN.git)
cd transparency-platform
```

### 3. Install Dependencies
```bash
npm install express mongoose dotenv multer cookie-parser bcrypt jsonwebtoken
```

### 4. Configuration (Environment Variables)
Create a `.env` file in the root directory and add the following:
```env
PORT=3000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key

# AI (citizen portal — improve writing & easy summary). Groq is used first if set.
GROQ_API_KEY=your_groq_api_key
# Optional: GROQ_MODEL=llama-3.3-70b-versatile
# Optional fallback: OPENAI_API_KEY=...
```

### 5. Run the Application
```bash
npm start
```

---
**Developed by Team PROTOSTARS**
