# SevaSync Backend

AI-Powered Community Need Intelligence & Volunteer Coordination Platform

> **Note:** This is the **Backend repository** for SevaSync. The frontend code is in a separate repository: [SevaSync-Frontend](https://github.com/Dhruv727876/SevaSync-Frontend)

**Live API:** https://sevasync-backend-917106621948.us-central1.run.app

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Primary AI:** Google Gemini 2.5 Flash (with Groq fallback)
- **Image Analysis:** Llama 4 Vision (OpenRouter)
- **Database:** Firebase Firestore
- **Hosting:** Google Cloud Run
- **Authentication:** API Key based

## Quick Start

### 1) Install Dependencies
```bash
npm install- Field name: `image`

Returns the same structure as `/parse-text`:
```json
{
  "id": "...",
  "village": "...",
  "need_type": "food|medical|shelter",
  "urgency": "low|medium|high|critical",
  "people": 0,
  "priority_score": 0,
  "created_at": "ISO timestamp"
}
```

### GET `/needs`
Returns all needs sorted by `priority_score` descending.

### POST `/match-volunteers`
Works unchanged.
