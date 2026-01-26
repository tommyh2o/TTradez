# TTradez

A full-stack trading journal:
- Log buy/sell transactions
- View combined positions (total shares, avg cost, P/L)
- Watchlist + live prices (later)

Tech:
- Frontend: React (Vite)
- Backend: Python (FastAPI)
- DB: SQLite (dev), Postgres (later)

## Data Model Approach
### users
- id (PK)
- email (unique)
- password_hash
- created_at

### transactions
- id (PK)
- user_id (FK)
- ticker
- side (BUY / SELL)
- shares
- price
- fees
- executed_at

### watchlist
- id (PK)
- user_id (FK)
- ticker