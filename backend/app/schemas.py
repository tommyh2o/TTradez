from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from .models import ContractSide, MarketType, ResolutionStatus, TradeAction


def normalize_status(status: ResolutionStatus) -> ResolutionStatus:
    if status == ResolutionStatus.OPEN:
        return ResolutionStatus.ONGOING
    if status in {ResolutionStatus.CLOSED, ResolutionStatus.RESOLVED}:
        return ResolutionStatus.COMPLETE
    return status


class TradeBase(BaseModel):
    market_type: MarketType
    action: TradeAction = TradeAction.BUY
    ticker: str | None = None
    instrument_name: str = Field(min_length=1, max_length=255)
    prediction_side: ContractSide | None = None
    quantity: float = Field(gt=0)
    price: float = Field(ge=0)
    fees: float = Field(default=0, ge=0)
    executed_at: datetime
    expires_at: datetime | None = None
    resolution_status: ResolutionStatus = ResolutionStatus.ONGOING
    outcome: str | None = None
    payout_per_contract: float | None = Field(default=None, ge=0)
    notes: str | None = None

    @model_validator(mode="after")
    def validate_trade_shape(self):
        self.resolution_status = normalize_status(self.resolution_status)

        if self.market_type == MarketType.EQUITY:
            if not self.ticker:
                raise ValueError("Equity trades require a ticker.")
            self.prediction_side = None
            self.expires_at = None
            self.outcome = None

        if self.market_type == MarketType.PREDICTION:
            if not self.prediction_side:
                raise ValueError("Prediction trades require a YES/NO side.")

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
    amount_spent: float = 0
    net_profit: float = 0

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="after")
    def attach_calculated_fields(self):
        self.resolution_status = normalize_status(self.resolution_status)
        self.amount_spent = round(self.quantity * self.price, 2)
        if self.resolution_status == ResolutionStatus.COMPLETE and self.payout_per_contract is not None:
            gross_sale = self.quantity * self.payout_per_contract
            self.net_profit = round(gross_sale - self.amount_spent - self.fees, 2)
        else:
            self.net_profit = round(0 - self.amount_spent - self.fees, 2)
        return self


class PositionSummary(BaseModel):
    key: str
    market_type: MarketType
    instrument_name: str
    ticker: str | None = None
    prediction_side: ContractSide | None = None
    open_quantity: float
    average_cost: float
    net_cash_flow: float
    total_fees: float
    amount_spent: float


class JournalSummary(BaseModel):
    total_trades: int
    equities_logged: int
    prediction_trades_logged: int
    open_positions: list[PositionSummary]
