from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text, select
from sqlalchemy.orm import Session

from .database import Base, engine, get_db
from .models import MarketType, ResolutionStatus, Trade
from .schemas import JournalSummary, PositionSummary, TradeCreate, TradeRead, TradeUpdate


Base.metadata.create_all(bind=engine)

with engine.begin() as connection:
    connection.execute(
        text(
            "UPDATE trades SET resolution_status = 'ONGOING' "
            "WHERE resolution_status = 'OPEN'"
        )
    )
    connection.execute(
        text(
            "UPDATE trades SET resolution_status = 'COMPLETE' "
            "WHERE resolution_status IN ('CLOSED', 'RESOLVED')"
        )
    )

app = FastAPI(title="TTradez API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def healthcheck():
    return {"status": "ok"}


@app.get("/trades", response_model=list[TradeRead])
def list_trades(db: Session = Depends(get_db)):
    stmt = select(Trade).order_by(Trade.executed_at.desc(), Trade.id.desc())
    return db.scalars(stmt).all()


@app.post("/trades", response_model=TradeRead, status_code=201)
def create_trade(payload: TradeCreate, db: Session = Depends(get_db)):
    trade = Trade(**payload.model_dump())
    db.add(trade)
    db.commit()
    db.refresh(trade)
    return trade


@app.put("/trades/{trade_id}", response_model=TradeRead)
def update_trade(trade_id: int, payload: TradeUpdate, db: Session = Depends(get_db)):
    trade = db.get(Trade, trade_id)
    if trade is None:
        raise HTTPException(status_code=404, detail="Trade not found")

    for field, value in payload.model_dump().items():
        setattr(trade, field, value)

    db.add(trade)
    db.commit()
    db.refresh(trade)
    return trade


@app.get("/summary", response_model=JournalSummary)
def get_summary(db: Session = Depends(get_db)):
    trades = db.scalars(select(Trade).order_by(Trade.executed_at.desc(), Trade.id.desc())).all()

    open_positions = []
    for trade in trades:
        if trade.resolution_status != ResolutionStatus.ONGOING:
            continue

        amount_spent = trade.quantity * trade.price
        open_positions.append(
            PositionSummary(
                key=f"{trade.market_type.value}::{trade.id}",
                market_type=trade.market_type,
                instrument_name=trade.instrument_name,
                ticker=trade.ticker,
                prediction_side=trade.prediction_side,
                open_quantity=round(trade.quantity, 4),
                average_cost=round(trade.price, 4),
                net_cash_flow=round(-amount_spent - trade.fees, 2),
                total_fees=round(trade.fees, 2),
                amount_spent=round(amount_spent, 2),
            )
        )

    return JournalSummary(
        total_trades=len(trades),
        equities_logged=sum(1 for trade in trades if trade.market_type == MarketType.EQUITY),
        prediction_trades_logged=sum(
            1 for trade in trades if trade.market_type == MarketType.PREDICTION
        ),
        open_positions=open_positions,
    )
