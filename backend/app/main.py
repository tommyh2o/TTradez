from fastapi import Depends, FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from .database import Base, engine, get_db
from .models import CashMovement, CashMovementType, MarketType, ResolutionStatus, Trade, TradeAction
from .schemas import (
    CashMovementCreate,
    CashMovementRead,
    JournalEntry,
    JournalSummary,
    PositionSummary,
    TradeCreate,
    TradeRead,
    TradeUpdate,
)


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


def serialize_trade(trade: Trade) -> TradeRead:
    return TradeRead.model_validate(trade)


def serialize_cash_movement(movement: CashMovement) -> CashMovementRead:
    return CashMovementRead.model_validate(movement)


def serialize_journal_entry(item: Trade | CashMovement) -> JournalEntry:
    if isinstance(item, Trade):
        trade = serialize_trade(item)
        return JournalEntry(
            id=trade.id,
            entry_kind="TRADE",
            title=trade.instrument_name,
            subtitle=f"{trade.prediction_side.value} contract",
            date=trade.executed_at,
            notes=trade.notes,
            amount_spent=trade.amount_spent,
            proceeds=trade.proceeds,
            net_profit=trade.net_profit,
            cash_impact=trade.cash_impact,
            status=trade.resolution_status.value,
            quantity=trade.quantity,
            buy_price=trade.price,
            sell_price=trade.payout_per_contract,
            fees=trade.fees,
            prediction_side=trade.prediction_side,
        )

    movement = serialize_cash_movement(item)
    return JournalEntry(
        id=movement.id,
        entry_kind="CASH",
        title="Cash deposit" if movement.movement_type == CashMovementType.DEPOSIT else "Cash withdrawal",
        subtitle=movement.movement_type.value.title(),
        date=movement.moved_at,
        notes=movement.notes,
        cash_impact=movement.signed_amount,
        status=movement.movement_type.value.title(),
        movement_type=movement.movement_type,
    )


def get_balance_components(db: Session) -> tuple[float, float, float]:
    trades = db.scalars(
        select(Trade)
        .where(Trade.market_type == MarketType.PREDICTION)
        .order_by(Trade.executed_at.desc(), Trade.id.desc())
    ).all()
    cash_movements = db.scalars(select(CashMovement).order_by(CashMovement.moved_at.desc())).all()

    total_deposits = round(
        sum(movement.amount for movement in cash_movements if movement.movement_type == CashMovementType.DEPOSIT),
        2,
    )
    total_withdrawals = round(
        sum(movement.amount for movement in cash_movements if movement.movement_type == CashMovementType.WITHDRAWAL),
        2,
    )

    trade_cash_effect = 0.0
    for trade in trades:
        serialized_trade = serialize_trade(trade)
        trade_cash_effect += serialized_trade.cash_impact

    account_balance = round(total_deposits - total_withdrawals + trade_cash_effect, 2)
    return account_balance, total_deposits, total_withdrawals


@app.get("/health")
def healthcheck():
    return {"status": "ok"}


@app.get("/trades", response_model=list[TradeRead])
def list_trades(db: Session = Depends(get_db)):
    stmt = (
        select(Trade)
        .where(Trade.market_type == MarketType.PREDICTION)
        .order_by(Trade.executed_at.desc(), Trade.id.desc())
    )
    return [serialize_trade(trade) for trade in db.scalars(stmt).all()]


@app.post("/trades", response_model=TradeRead, status_code=201)
def create_trade(payload: TradeCreate, db: Session = Depends(get_db)):
    trade = Trade(
        market_type=MarketType.PREDICTION,
        action=TradeAction.BUY,
        ticker=None,
        instrument_name=payload.instrument_name,
        prediction_side=payload.prediction_side,
        quantity=payload.quantity,
        price=payload.price,
        fees=payload.fees,
        executed_at=payload.executed_at,
        resolution_status=payload.resolution_status,
        payout_per_contract=payload.payout_per_contract,
        notes=payload.notes,
        expires_at=None,
        outcome=None,
    )
    db.add(trade)
    db.commit()
    db.refresh(trade)
    return serialize_trade(trade)


@app.put("/trades/{trade_id}", response_model=TradeRead)
def update_trade(trade_id: int, payload: TradeUpdate, db: Session = Depends(get_db)):
    trade = db.get(Trade, trade_id)
    if trade is None or trade.market_type != MarketType.PREDICTION:
        raise HTTPException(status_code=404, detail="Trade not found")

    trade.instrument_name = payload.instrument_name
    trade.prediction_side = payload.prediction_side
    trade.quantity = payload.quantity
    trade.price = payload.price
    trade.fees = payload.fees
    trade.executed_at = payload.executed_at
    trade.resolution_status = payload.resolution_status
    trade.payout_per_contract = payload.payout_per_contract
    trade.notes = payload.notes

    db.add(trade)
    db.commit()
    db.refresh(trade)
    return serialize_trade(trade)


@app.delete("/trades/{trade_id}", status_code=204)
def delete_trade(trade_id: int, db: Session = Depends(get_db)):
    trade = db.get(Trade, trade_id)
    if trade is None or trade.market_type != MarketType.PREDICTION:
        raise HTTPException(status_code=404, detail="Trade not found")

    db.delete(trade)
    db.commit()
    return Response(status_code=204)


@app.get("/cash-movements", response_model=list[CashMovementRead])
def list_cash_movements(db: Session = Depends(get_db)):
    stmt = select(CashMovement).order_by(CashMovement.moved_at.desc(), CashMovement.id.desc())
    return [serialize_cash_movement(movement) for movement in db.scalars(stmt).all()]


@app.post("/cash-movements", response_model=CashMovementRead, status_code=201)
def create_cash_movement(payload: CashMovementCreate, db: Session = Depends(get_db)):
    movement = CashMovement(**payload.model_dump())
    db.add(movement)
    db.commit()
    db.refresh(movement)
    return serialize_cash_movement(movement)


@app.delete("/cash-movements/{movement_id}", status_code=204)
def delete_cash_movement(movement_id: int, db: Session = Depends(get_db)):
    movement = db.get(CashMovement, movement_id)
    if movement is None:
        raise HTTPException(status_code=404, detail="Cash movement not found")

    db.delete(movement)
    db.commit()
    return Response(status_code=204)


@app.get("/journal", response_model=list[JournalEntry])
def list_journal(db: Session = Depends(get_db)):
    trades = db.scalars(
        select(Trade)
        .where(Trade.market_type == MarketType.PREDICTION)
        .order_by(Trade.executed_at.desc(), Trade.id.desc())
    ).all()
    cash_movements = db.scalars(
        select(CashMovement).order_by(CashMovement.moved_at.desc(), CashMovement.id.desc())
    ).all()

    entries = [serialize_journal_entry(trade) for trade in trades] + [
        serialize_journal_entry(movement) for movement in cash_movements
    ]
    return sorted(entries, key=lambda entry: (entry.date, entry.id), reverse=True)


@app.get("/summary", response_model=JournalSummary)
def get_summary(db: Session = Depends(get_db)):
    trades = db.scalars(
        select(Trade)
        .where(Trade.market_type == MarketType.PREDICTION)
        .order_by(Trade.executed_at.desc(), Trade.id.desc())
    ).all()
    cash_movements = db.scalars(select(CashMovement).order_by(CashMovement.moved_at.desc())).all()

    open_positions = []
    for trade in trades:
        if trade.resolution_status != ResolutionStatus.ONGOING:
            continue

        amount_spent = trade.quantity * trade.price
        open_positions.append(
            PositionSummary(
                key=f"PREDICTION::{trade.id}",
                instrument_name=trade.instrument_name,
                prediction_side=trade.prediction_side,
                open_quantity=round(trade.quantity, 4),
                average_cost=round(trade.price, 4),
                total_fees=round(trade.fees, 2),
                amount_spent=round(amount_spent + trade.fees, 2),
            )
        )

    account_balance, total_deposits, total_withdrawals = get_balance_components(db)

    return JournalSummary(
        total_entries=len(trades) + len(cash_movements),
        prediction_trades_logged=len(trades),
        cash_movements_logged=len(cash_movements),
        account_balance=account_balance,
        total_deposits=total_deposits,
        total_withdrawals=total_withdrawals,
        open_positions=open_positions,
    )
