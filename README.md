# TTradez

TTradez is a full-stack trading journal for both traditional stock trades and Robinhood-style
prediction market contracts.

## What it does

- Log equity buys and sells
- Log prediction market YES/NO contracts
- Keep a unified journal feed with notes
- Show simple open-position summaries

## Project layout

- `frontend/`: React + Vite interface for entering trades and reviewing the journal
- `backend/`: FastAPI API backed by SQLite

## Data model

The first version uses a single `trades` table with fields that work for both market types:

- `market_type`: `EQUITY` or `PREDICTION`
- `action`: `BUY` or `SELL`
- `ticker`: required for equities
- `instrument_name`: company name or prediction market question
- `prediction_side`: `YES` or `NO` for prediction contracts
- `quantity`, `price`, `fees`, `executed_at`
- `expires_at`, `resolution_status`, `outcome`, `payout_per_contract`
- `notes`

This keeps the journal unified while still allowing prediction-specific fields where needed.

## Run locally

### One command

From the repo root:

```bash
npm install
npm run dev:all
```

This starts both:

- FastAPI on `http://127.0.0.1:8000`
- Vite on `http://127.0.0.1:5173`

Make sure you have already created the backend virtualenv and installed backend dependencies once.

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

With both running, open `http://127.0.0.1:5173`.
