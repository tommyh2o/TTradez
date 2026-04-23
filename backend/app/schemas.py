from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from .models import CashMovementType, ContractSide, MarketType, ResolutionStatus, TradeAction


def normalize_status(status: ResolutionStatus) -> ResolutionStatus:
    if status == ResolutionStatus.OPEN:
        return ResolutionStatus.ONGOING
    if status in {ResolutionStatus.CLOSED, ResolutionStatus.RESOLVED}:
        return ResolutionStatus.COMPLETE
    return status


class TradeBase(BaseModel):
    instrument_name: str = Field(min_length=1, max_length=255)
    prediction_side: ContractSide
    quantity: float = Field(gt=0)
    price: float = Field(ge=0, le=1)
    fees: float = Field(default=0, ge=0)
    executed_at: datetime
    resolution_status: ResolutionStatus = ResolutionStatus.ONGOING
    payout_per_contract: float | None = Field(default=None, ge=0, le=1)
    notes: str | None = None

    @model_validator(mode="after")
    def validate_trade_shape(self):
        self.resolution_status = normalize_status(self.resolution_status)
        if self.resolution_status == ResolutionStatus.ONGOING:
            self.payout_per_contract = None
        if self.resolution_status == ResolutionStatus.COMPLETE and self.payout_per_contract is None:
            raise ValueError("Complete trades require a sell price.")
        return self


class TradeCreate(TradeBase):
    pass


class TradeUpdate(TradeBase):
    pass


class TradeRead(TradeBase):
    id: int
    created_at: datetime
    market_type: MarketType = MarketType.PREDICTION
    action: TradeAction = TradeAction.BUY
    amount_spent: float = 0
    proceeds: float = 0
    net_profit: float = 0
    cash_impact: float = 0

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="after")
    def attach_calculated_fields(self):
        self.resolution_status = normalize_status(self.resolution_status)
        gross_entry = self.quantity * self.price
        self.amount_spent = round(gross_entry + self.fees, 2)

        if self.payout_per_contract is not None:
            gross_exit = self.quantity * self.payout_per_contract
            exit_fees = self.fees if 0 < self.payout_per_contract < 1 else 0
            self.proceeds = round(max(gross_exit - exit_fees, 0), 2)
        else:
            self.proceeds = 0

        if self.resolution_status == ResolutionStatus.COMPLETE and self.payout_per_contract is not None:
            self.net_profit = round(self.proceeds - self.amount_spent, 2)
            self.cash_impact = self.net_profit
        else:
            self.net_profit = round(-self.amount_spent, 2)
            self.cash_impact = self.net_profit
        return self


class CashMovementBase(BaseModel):
    movement_type: CashMovementType
    amount: float = Field(gt=0)
    moved_at: datetime
    notes: str | None = None


class CashMovementCreate(CashMovementBase):
    pass


class CashMovementRead(CashMovementBase):
    id: int
    created_at: datetime
    signed_amount: float = 0

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="after")
    def attach_signed_amount(self):
        multiplier = 1 if self.movement_type == CashMovementType.DEPOSIT else -1
        self.signed_amount = round(multiplier * self.amount, 2)
        return self


class PositionSummary(BaseModel):
    key: str
    instrument_name: str
    prediction_side: ContractSide
    open_quantity: float
    average_cost: float
    total_fees: float
    amount_spent: float


class JournalEntry(BaseModel):
    id: int
    entry_kind: Literal["TRADE", "CASH"]
    title: str
    subtitle: str
    date: datetime
    notes: str | None = None
    amount_spent: float | None = None
    proceeds: float | None = None
    net_profit: float | None = None
    cash_impact: float
    status: str
    quantity: float | None = None
    buy_price: float | None = None
    sell_price: float | None = None
    fees: float | None = None
    prediction_side: ContractSide | None = None
    movement_type: CashMovementType | None = None


class JournalSummary(BaseModel):
    total_entries: int
    prediction_trades_logged: int
    cash_movements_logged: int
    account_balance: float
    total_deposits: float
    total_withdrawals: float
    open_positions: list[PositionSummary]
