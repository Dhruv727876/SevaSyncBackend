# SevaSync Backend (Express + Gemini + Firestore + Llama 4 Image Analysis)

## 1) Install
```bash
npm install
```

## 2) Configure environment
Create `.env` from `.env.example`:

```env
PORT=5000
GEMINI_API_KEY=your_key
LLAMA_API_KEY=your_llama_api_key
LLAMA_API_URL=https://openrouter.ai/api/v1/chat/completions
FIREBASE_CONFIG=your_config
```

## 3) Run
```bash
npm run dev
```

## API Endpoints

### POST `/parse-text`
Body:
```json
{
  "text": "Kamrup needs medical help for 300 people urgently"
}
```

### POST `/analyze-image`
- Content-Type: `multipart/form-data`
- Field name: `image`

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
