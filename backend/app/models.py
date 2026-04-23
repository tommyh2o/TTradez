import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class MarketType(str, enum.Enum):
    EQUITY = "EQUITY"
    PREDICTION = "PREDICTION"


class TradeAction(str, enum.Enum):
    BUY = "BUY"
    SELL = "SELL"


class ContractSide(str, enum.Enum):
    YES = "YES"
    NO = "NO"


class ResolutionStatus(str, enum.Enum):
    ONGOING = "ONGOING"
    COMPLETE = "COMPLETE"
    OPEN = "OPEN"
    CLOSED = "CLOSED"
    RESOLVED = "RESOLVED"


class Trade(Base):
    __tablename__ = "trades"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    market_type: Mapped[MarketType] = mapped_column(Enum(MarketType), nullable=False)
    action: Mapped[TradeAction] = mapped_column(Enum(TradeAction), nullable=False)
    ticker: Mapped[str | None] = mapped_column(String(20), nullable=True)
    instrument_name: Mapped[str] = mapped_column(String(255), nullable=False)
    prediction_side: Mapped[ContractSide | None] = mapped_column(
        Enum(ContractSide), nullable=True
    )
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    fees: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    executed_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    resolution_status: Mapped[ResolutionStatus] = mapped_column(
        Enum(ResolutionStatus), nullable=False, default=ResolutionStatus.OPEN
    )
    outcome: Mapped[str | None] = mapped_column(String(50), nullable=True)
    payout_per_contract: Mapped[float | None] = mapped_column(Float, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
