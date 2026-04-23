# TTradez

TTradez is a full-stack prediction market journal and bankroll tracker built around
Robinhood-style YES/NO contracts.

## What it does

- Log prediction market YES/NO contracts
- Log cash deposits and withdrawals
- Keep a unified journal feed for trades and bankroll movements
- Show account balance, open positions, and running profitability

## Project layout

- `frontend/`: React + Vite interface for entering trades and reviewing the journal
- `backend/`: FastAPI API backed by SQLite

## Data model

The current version uses:

- `trades`
  - prediction market question
  - `YES` / `NO` side
  - contracts bought
  - buy price per contract
  - optional sell price per contract
  - ongoing / complete status
  - fees, date, notes
- `cash_movements`
  - `DEPOSIT` or `WITHDRAWAL`
  - amount
  - date
  - notes

Account balance is derived from:

- deposits
- withdrawals
- open prediction positions tying up cash
- completed trade profit or loss

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
