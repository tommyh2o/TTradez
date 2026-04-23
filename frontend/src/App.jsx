import { useEffect, useState } from "react";

const API_BASE = "http://127.0.0.1:8000";

const defaultForm = {
  market_type: "EQUITY",
  ticker: "",
  instrument_name: "",
  prediction_side: "YES",
  quantity: 1,
  price: 0,
  fees: 0,
  executed_at: new Date().toISOString().slice(0, 16),
  resolution_status: "ONGOING",
  payout_per_contract: "",
  notes: "",
};

function formatDate(value) {
  return new Date(value).toLocaleString();
}

function formatMoney(value) {
  return Number(value || 0).toFixed(2);
}

function amountSpent(form) {
  return Number(form.quantity || 0) * Number(form.price || 0);
}

function netProfit(form) {
  if (form.resolution_status !== "COMPLETE" || form.payout_per_contract === "") {
    return 0;
  }

  return (
    Number(form.quantity || 0) *
      (Number(form.payout_per_contract || 0) - Number(form.price || 0)) -
    Number(form.fees || 0)
  );
}

function cleanPayload(form) {
  const payload = {
    ...form,
    action: "BUY",
    quantity: Number(form.quantity),
    price: Number(form.price),
    fees: Number(form.fees),
    executed_at: new Date(form.executed_at).toISOString(),
    payout_per_contract: form.payout_per_contract === "" ? null : Number(form.payout_per_contract),
    ticker: form.ticker || null,
    notes: form.notes || null,
  };

  if (payload.market_type === "EQUITY") {
    payload.prediction_side = null;
  }

  if (payload.resolution_status === "ONGOING") {
    payload.payout_per_contract = null;
  }

  return payload;
}

function tradeToForm(trade) {
  return {
    market_type: trade.market_type,
    ticker: trade.ticker || "",
    instrument_name: trade.instrument_name,
    prediction_side: trade.prediction_side || "YES",
    quantity: trade.quantity,
    price: trade.price,
    fees: trade.fees ?? 0,
    executed_at: new Date(trade.executed_at).toISOString().slice(0, 16),
    resolution_status: trade.resolution_status,
    payout_per_contract: trade.payout_per_contract ?? "",
    notes: trade.notes || "",
  };
}

function App() {
  const [form, setForm] = useState(defaultForm);
  const [trades, setTrades] = useState([]);
  const [summary, setSummary] = useState({ total_trades: 0, equities_logged: 0, prediction_trades_logged: 0, open_positions: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingTradeId, setEditingTradeId] = useState(null);
  const [editForm, setEditForm] = useState(defaultForm);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [tradesRes, summaryRes] = await Promise.all([
        fetch(`${API_BASE}/trades`),
        fetch(`${API_BASE}/summary`),
      ]);

      if (!tradesRes.ok || !summaryRes.ok) {
        throw new Error("API request failed");
      }

      const [tradesData, summaryData] = await Promise.all([tradesRes.json(), summaryRes.json()]);
      setTrades(tradesData);
      setSummary(summaryData);
    } catch (err) {
      setError("Unable to reach the API. Start the backend and refresh.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    try {
      const response = await fetch(`${API_BASE}/trades`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(cleanPayload(form)),
      });

      if (!response.ok) {
        const details = await response.json();
        throw new Error(details.detail || "Request failed");
      }

      setForm({
        ...defaultForm,
        market_type: form.market_type,
        executed_at: new Date().toISOString().slice(0, 16),
      });
      await loadData();
    } catch (err) {
      setError(typeof err.message === "string" ? err.message : "Unable to save trade.");
    }
  }

  function startEditing(trade) {
    setEditingTradeId(trade.id);
    setEditForm(tradeToForm(trade));
    setError("");
  }

  function cancelEditing() {
    setEditingTradeId(null);
    setEditForm(defaultForm);
  }

  async function handleUpdate(event) {
    event.preventDefault();
    setError("");

    try {
      const response = await fetch(`${API_BASE}/trades/${editingTradeId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(cleanPayload(editForm)),
      });

      if (!response.ok) {
        const details = await response.json();
        throw new Error(details.detail || "Update failed");
      }

      cancelEditing();
      await loadData();
    } catch (err) {
      setError(typeof err.message === "string" ? err.message : "Unable to update trade.");
    }
  }

  return (
    <div className="page-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Trading journal for equities and prediction markets</p>
          <h1>TTradez</h1>
          <p className="hero-copy">
            Log stock trades the way you always planned to, while also tracking Robinhood
            prediction contracts in the same journal.
          </p>
        </div>
        <div className="hero-grid">
          <article className="metric-card">
            <span>Total entries</span>
            <strong>{summary.total_trades}</strong>
          </article>
          <article className="metric-card">
            <span>Equity trades</span>
            <strong>{summary.equities_logged}</strong>
          </article>
          <article className="metric-card">
            <span>Prediction trades</span>
            <strong>{summary.prediction_trades_logged}</strong>
          </article>
        </div>
      </header>

      <main className="content-grid">
        <section className="panel">
          <div className="panel-heading">
            <h2>Add journal entry</h2>
            <p>Use one form for both standard trades and prediction contracts.</p>
          </div>

          <form className="trade-form" onSubmit={handleSubmit}>
            <label>
              Market type
              <select
                value={form.market_type}
                onChange={(event) => setForm({ ...form, market_type: event.target.value })}
              >
                <option value="EQUITY">Equity</option>
                <option value="PREDICTION">Prediction</option>
              </select>
            </label>

            {form.market_type === "EQUITY" ? (
              <label>
                Ticker
                <input
                  value={form.ticker}
                  onChange={(event) => setForm({ ...form, ticker: event.target.value.toUpperCase() })}
                  placeholder="AAPL"
                  required
                />
              </label>
            ) : (
              <label>
                Contract side
                <select
                  value={form.prediction_side}
                  onChange={(event) => setForm({ ...form, prediction_side: event.target.value })}
                >
                  <option value="YES">YES</option>
                  <option value="NO">NO</option>
                </select>
              </label>
            )}

            <label className="span-2">
              {form.market_type === "EQUITY" ? "Stock name" : "Market / event name"}
              <input
                value={form.instrument_name}
                onChange={(event) => setForm({ ...form, instrument_name: event.target.value })}
                placeholder={
                  form.market_type === "EQUITY"
                    ? "Apple Inc."
                    : "Will CPI come in below expectations?"
                }
                required
              />
            </label>

            <label>
              {form.market_type === "EQUITY" ? "Shares bought" : "Contracts bought"}
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={form.quantity}
                onChange={(event) => setForm({ ...form, quantity: event.target.value })}
                required
              />
            </label>

            <label>
              {form.market_type === "EQUITY" ? "Buy price" : "Buy price per contract"}
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(event) => setForm({ ...form, price: event.target.value })}
                required
              />
            </label>

            <label>
              Amount spent
              <input value={`$${formatMoney(amountSpent(form))}`} disabled readOnly />
            </label>

            <label>
              Status
              <select
                value={form.resolution_status}
                onChange={(event) => setForm({ ...form, resolution_status: event.target.value })}
              >
                <option value="ONGOING">Ongoing</option>
                <option value="COMPLETE">Complete</option>
              </select>
            </label>

            <label>
              Executed at
              <input
                type="datetime-local"
                value={form.executed_at}
                onChange={(event) => setForm({ ...form, executed_at: event.target.value })}
                required
              />
            </label>

            <label>
              Fees
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.fees}
                onChange={(event) => setForm({ ...form, fees: event.target.value })}
              />
            </label>

            <label>
              {form.market_type === "EQUITY" ? "Shares sold" : "Contracts sold"}
              <input value={form.quantity} disabled readOnly />
            </label>

            <label>
              {form.market_type === "EQUITY" ? "Sell price" : "Sell price per contract"}
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.payout_per_contract}
                onChange={(event) => setForm({ ...form, payout_per_contract: event.target.value })}
                placeholder="0.00"
                disabled={form.resolution_status !== "COMPLETE"}
              />
            </label>

            <label>
              Net profit
              <input value={`$${formatMoney(netProfit(form))}`} disabled readOnly />
            </label>

            <label className="span-2">
              Notes
              <textarea
                rows="4"
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                placeholder="Why you took the trade, setup details, risk, or post-trade thoughts."
              />
            </label>

            <button type="submit">Save entry</button>
          </form>

          {error ? <p className="message error">{error}</p> : null}
        </section>

        <section className="stack">
          <section className="panel">
            <div className="panel-heading">
              <h2>Open positions</h2>
              <p>Current open exposure derived from journal entries.</p>
            </div>

            <div className="position-list">
              {summary.open_positions.length === 0 ? (
                <p className="empty">No open positions yet.</p>
              ) : (
                summary.open_positions.map((position) => (
                  <article key={position.key} className="position-card">
                    <h3>{position.instrument_name}</h3>
                    <p>
                      {position.market_type === "EQUITY"
                        ? position.ticker
                        : `Prediction ${position.prediction_side}`}
                    </p>
                    <dl>
                      <div>
                        <dt>Open qty</dt>
                        <dd>{position.open_quantity}</dd>
                      </div>
                      <div>
                        <dt>Buy price</dt>
                        <dd>${position.average_cost}</dd>
                      </div>
                      <div>
                        <dt>Amount spent</dt>
                        <dd>${position.amount_spent}</dd>
                      </div>
                    </dl>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <h2>Journal feed</h2>
              <p>Newest entries first across every market type.</p>
            </div>

            {loading ? (
              <p className="empty">Loading journal...</p>
            ) : trades.length === 0 ? (
              <p className="empty">No journal entries yet.</p>
            ) : (
              <div className="journal-list">
                {trades.map((trade) => (
                  <article key={trade.id} className="journal-card">
                    <div className="journal-header">
                      <span className={`pill ${trade.market_type.toLowerCase()}`}>
                        {trade.market_type}
                      </span>
                      <span className="pill action">{trade.resolution_status}</span>
                    </div>

                    <h3>{trade.instrument_name}</h3>
                    <p className="journal-meta">
                      {trade.market_type === "EQUITY"
                        ? trade.ticker
                        : `${trade.prediction_side} contract`}
                    </p>

                    <dl className="journal-details">
                      <div>
                        <dt>Bought</dt>
                        <dd>{trade.quantity}</dd>
                      </div>
                      <div>
                        <dt>Buy price</dt>
                        <dd>${trade.price}</dd>
                      </div>
                      <div>
                        <dt>Spent</dt>
                        <dd>${trade.amount_spent}</dd>
                      </div>
                      <div>
                        <dt>Executed</dt>
                        <dd>{formatDate(trade.executed_at)}</dd>
                      </div>
                      <div>
                        <dt>Sell price</dt>
                        <dd>
                          {trade.payout_per_contract === null ? "Ongoing" : `$${trade.payout_per_contract}`}
                        </dd>
                      </div>
                      <div>
                        <dt>Net profit</dt>
                        <dd>${trade.net_profit}</dd>
                      </div>
                    </dl>

                    {trade.notes ? <p className="notes">{trade.notes}</p> : null}

                    {trade.market_type === "PREDICTION" ? (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => startEditing(trade)}
                      >
                        Edit entry
                      </button>
                    ) : null}

                    {editingTradeId === trade.id ? (
                      <form className="edit-form" onSubmit={handleUpdate}>
                        <label>
                          Status
                          <select
                            value={editForm.resolution_status}
                            onChange={(event) =>
                              setEditForm({ ...editForm, resolution_status: event.target.value })
                            }
                          >
                            <option value="ONGOING">Ongoing</option>
                            <option value="COMPLETE">Complete</option>
                          </select>
                        </label>
                        <label>
                          Sell price per contract
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editForm.payout_per_contract}
                            onChange={(event) =>
                              setEditForm({ ...editForm, payout_per_contract: event.target.value })
                            }
                            disabled={editForm.resolution_status !== "COMPLETE"}
                          />
                        </label>
                        <label className="span-2">
                          Notes
                          <textarea
                            rows="3"
                            value={editForm.notes}
                            onChange={(event) =>
                              setEditForm({ ...editForm, notes: event.target.value })
                            }
                          />
                        </label>
                        <div className="edit-summary">
                          Profit preview: ${formatMoney(netProfit(editForm))}
                        </div>
                        <div className="edit-actions">
                          <button type="submit">Save changes</button>
                          <button type="button" className="secondary-button" onClick={cancelEditing}>
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>
      </main>
    </div>
  );
}

export default App;
