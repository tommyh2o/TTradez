import { useEffect, useState } from "react";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import IconButton from "@mui/material/IconButton";

const API_BASE = "http://127.0.0.1:8000";

const defaultTradeForm = {
  instrument_name: "",
  prediction_side: "YES",
  quantity: 1,
  price: 0.5,
  fees: 0,
  executed_at: new Date().toISOString().slice(0, 10),
  resolution_status: "ONGOING",
  payout_per_contract: "",
  notes: "",
};

const defaultCashForm = {
  movement_type: "DEPOSIT",
  amount: "",
  moved_at: new Date().toISOString().slice(0, 10),
  notes: "",
};

function formatDate(value) {
  return new Date(value).toLocaleDateString();
}

function formatMoney(value) {
  return Number(value || 0).toFixed(2);
}

function formatContractPrice(value) {
  return Number(value || 0).toFixed(2);
}

function amountSpent(form) {
  return Number(form.quantity || 0) * Number(form.price || 0) + Number(form.fees || 0);
}

function grossSellValue(form) {
  if (form.resolution_status !== "COMPLETE" || form.payout_per_contract === "") {
    return 0;
  }

  const grossExit = Number(form.quantity || 0) * Number(form.payout_per_contract || 0);
  const sellPrice = Number(form.payout_per_contract || 0);
  const exitFees = sellPrice > 0 && sellPrice < 1 ? Number(form.fees || 0) : 0;
  return Math.max(grossExit - exitFees, 0);
}

function netProfit(form) {
  if (form.resolution_status !== "COMPLETE" || form.payout_per_contract === "") {
    return 0;
  }

  return grossSellValue(form) - amountSpent(form);
}

function cleanTradePayload(form) {
  return {
    instrument_name: form.instrument_name,
    prediction_side: form.prediction_side,
    quantity: Number(form.quantity),
    price: Number(form.price),
    fees: Number(form.fees),
    executed_at: new Date(`${form.executed_at}T00:00:00`).toISOString(),
    resolution_status: form.resolution_status,
    payout_per_contract:
      form.resolution_status === "COMPLETE" && form.payout_per_contract !== ""
        ? Number(form.payout_per_contract)
        : null,
    notes: form.notes || null,
  };
}

function cleanCashPayload(form) {
  return {
    movement_type: form.movement_type,
    amount: Number(form.amount),
    moved_at: new Date(`${form.moved_at}T00:00:00`).toISOString(),
    notes: form.notes || null,
  };
}

function tradeToForm(trade) {
  return {
    instrument_name: trade.instrument_name,
    prediction_side: trade.prediction_side || "YES",
    quantity: trade.quantity,
    price: trade.price,
    fees: trade.fees ?? 0,
    executed_at: new Date(trade.executed_at).toISOString().slice(0, 10),
    resolution_status: trade.resolution_status,
    payout_per_contract: trade.payout_per_contract ?? "",
    notes: trade.notes || "",
  };
}

function buildProfitSeries(entries) {
  let runningProfit = 0;

  return entries
    .filter((entry) => entry.entry_kind === "TRADE")
    .slice()
    .reverse()
    .map((entry, index) => {
      runningProfit += Number(entry.net_profit || 0);
      return {
        label: `${index + 1}`,
        title: entry.title,
        tradeProfit: Number((entry.net_profit || 0).toFixed(2)),
        value: Number(runningProfit.toFixed(2)),
      };
    });
}

function ProfitChart({ entries }) {
  const series = buildProfitSeries(entries);
  const [hoveredPoint, setHoveredPoint] = useState(null);

  if (series.length === 0) {
    return <p className="empty">Profitability chart will appear once you log prediction trades.</p>;
  }

  const width = 520;
  const height = 220;
  const leftPadding = 64;
  const rightPadding = 24;
  const topPadding = 24;
  const bottomPadding = 24;
  const values = series.map((point) => point.value);
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(0, ...values);
  const range = maxValue - minValue || 1;
  const stepX =
    series.length === 1 ? 0 : (width - leftPadding - rightPadding) / (series.length - 1);

  const points = series.map((point, index) => {
    const x = leftPadding + index * stepX;
    const y =
      height -
      bottomPadding -
      ((point.value - minValue) / range) * (height - topPadding - bottomPadding);
    return { ...point, x, y };
  });

  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const zeroY =
    height -
    bottomPadding -
    ((0 - minValue) / range) * (height - topPadding - bottomPadding);
  const yTicks = [maxValue, maxValue - range / 2, minValue].map((value) =>
    Number(value.toFixed(2)),
  );

  const tooltipWidth = 126;
  const tooltipHeight = 46;
  const tooltipX = hoveredPoint
    ? Math.min(Math.max(hoveredPoint.x - tooltipWidth / 2, leftPadding), width - rightPadding - tooltipWidth)
    : 0;
  const tooltipY = hoveredPoint
    ? Math.max(hoveredPoint.y - tooltipHeight - 14, topPadding)
    : 0;

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="profit-chart" role="img" aria-label="Profitability by trade">
        <line
          x1={leftPadding}
          x2={width - rightPadding}
          y1={zeroY}
          y2={zeroY}
          className="chart-axis"
        />
        {yTicks.map((tickValue) => {
          const tickY =
            height -
            bottomPadding -
            ((tickValue - minValue) / range) * (height - topPadding - bottomPadding);
          return (
            <g key={tickValue}>
              <line
                x1={leftPadding}
                x2={width - rightPadding}
                y1={tickY}
                y2={tickY}
                className="chart-grid-line"
              />
              <text
                x={12}
                y={tickY + 4}
                className="chart-y-label"
              >
                ${formatMoney(tickValue)}
              </text>
            </g>
          );
        })}
        <path d={path} className="chart-line" />
        {points.map((point) => (
          <g key={point.label}>
            <circle
              cx={point.x}
              cy={point.y}
              r="9"
              className="chart-hit-area"
              onMouseEnter={() => setHoveredPoint(point)}
              onMouseLeave={() => setHoveredPoint(null)}
            />
            <circle
              cx={point.x}
              cy={point.y}
              r="4"
              className={point.value >= 0 ? "chart-point positive" : "chart-point negative"}
            />
            <text x={point.x} y={height - 6} textAnchor="middle" className="chart-label">
              {point.label}
            </text>
          </g>
        ))}
        {hoveredPoint ? (
          <g className="chart-tooltip" pointerEvents="none">
            <rect
              x={tooltipX}
              y={tooltipY}
              width={tooltipWidth}
              height={tooltipHeight}
              rx="12"
              className="chart-tooltip-box"
            />
            <text x={tooltipX + 12} y={tooltipY + 18} className="chart-tooltip-title">
              Trade {hoveredPoint.label}
            </text>
            <text
              x={tooltipX + 12}
              y={tooltipY + 35}
              className={hoveredPoint.tradeProfit >= 0 ? "chart-tooltip-value positive" : "chart-tooltip-value negative"}
            >
              P/L {hoveredPoint.tradeProfit >= 0 ? "+" : ""}${formatMoney(hoveredPoint.tradeProfit)}
            </text>
          </g>
        ) : null}
      </svg>
      <div className="chart-legend">
        <span>Prediction trade sequence with running P/L</span>
        <strong className={series.at(-1).value >= 0 ? "profit positive" : "profit negative"}>
          Running P/L: ${formatMoney(series.at(-1).value)}
        </strong>
      </div>
    </div>
  );
}

function App() {
  const [tradeForm, setTradeForm] = useState(defaultTradeForm);
  const [cashForm, setCashForm] = useState(defaultCashForm);
  const [journalEntries, setJournalEntries] = useState([]);
  const [summary, setSummary] = useState({
    total_entries: 0,
    prediction_trades_logged: 0,
    cash_movements_logged: 0,
    account_balance: 0,
    total_deposits: 0,
    total_withdrawals: 0,
    open_positions: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingTradeId, setEditingTradeId] = useState(null);
  const [editForm, setEditForm] = useState(defaultTradeForm);
  const [activeView, setActiveView] = useState("dashboard");
  const [entryMode, setEntryMode] = useState("trade");
  const [importFile, setImportFile] = useState(null);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [journalRes, summaryRes] = await Promise.all([
        fetch(`${API_BASE}/journal`),
        fetch(`${API_BASE}/summary`),
      ]);

      if (!journalRes.ok || !summaryRes.ok) {
        throw new Error("API request failed");
      }

      const [journalData, summaryData] = await Promise.all([journalRes.json(), summaryRes.json()]);
      setJournalEntries(journalData);
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

  async function handleTradeSubmit(event) {
    event.preventDefault();
    setError("");

    try {
      const response = await fetch(`${API_BASE}/trades`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanTradePayload(tradeForm)),
      });

      if (!response.ok) {
        const details = await response.json();
        throw new Error(details.detail || "Request failed");
      }

      setTradeForm({
        ...defaultTradeForm,
        executed_at: new Date().toISOString().slice(0, 10),
      });
      await loadData();
      setActiveView("dashboard");
    } catch (err) {
      setError(typeof err.message === "string" ? err.message : "Unable to save trade.");
    }
  }

  async function handleCashSubmit(event) {
    event.preventDefault();
    setError("");

    try {
      const response = await fetch(`${API_BASE}/cash-movements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanCashPayload(cashForm)),
      });

      if (!response.ok) {
        const details = await response.json();
        throw new Error(details.detail || "Request failed");
      }

      setCashForm({
        ...defaultCashForm,
        moved_at: new Date().toISOString().slice(0, 10),
      });
      await loadData();
      setActiveView("dashboard");
    } catch (err) {
      setError(typeof err.message === "string" ? err.message : "Unable to save cash movement.");
    }
  }

  function startEditing(entry) {
    if (entry.entry_kind !== "TRADE") {
      return;
    }
    setEditingTradeId(entry.id);
    setEditForm(
      tradeToForm({
        instrument_name: entry.title,
        prediction_side: entry.prediction_side,
        quantity: entry.quantity,
        price: entry.buy_price,
        fees: entry.fees ?? 0,
        executed_at: entry.date,
        resolution_status: entry.status,
        payout_per_contract: entry.sell_price,
        notes: entry.notes,
      }),
    );
    setError("");
  }

  function cancelEditing() {
    setEditingTradeId(null);
    setEditForm(defaultTradeForm);
  }

  async function handleUpdate(event) {
    event.preventDefault();
    setError("");

    try {
      const response = await fetch(`${API_BASE}/trades/${editingTradeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanTradePayload(editForm)),
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

  async function handleDelete(entry) {
    setError("");

    try {
      const endpoint =
        entry.entry_kind === "TRADE"
          ? `${API_BASE}/trades/${entry.id}`
          : `${API_BASE}/cash-movements/${entry.id}`;

      const response = await fetch(endpoint, { method: "DELETE" });

      if (!response.ok) {
        let details = {};
        try {
          details = await response.json();
        } catch {
          details = {};
        }
        throw new Error(details.detail || "Delete failed");
      }

      if (editingTradeId === entry.id) {
        cancelEditing();
      }

      await loadData();
    } catch (err) {
      setError(typeof err.message === "string" ? err.message : "Unable to delete entry.");
    }
  }

  async function handleExport() {
    setError("");

    try {
      const response = await fetch(`${API_BASE}/backup`);
      if (!response.ok) {
        throw new Error("Unable to export backup.");
      }

      const payload = await response.json();
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `ttradez-backup-${stamp}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(typeof err.message === "string" ? err.message : "Unable to export backup.");
    }
  }

  async function handleImport() {
    if (!importFile) {
      setError("Choose a backup JSON file first.");
      return;
    }

    const confirmed = window.confirm(
      "Importing a backup will replace your current TTradez data. Continue?",
    );
    if (!confirmed) {
      return;
    }

    setError("");

    try {
      const text = await importFile.text();
      const response = await fetch(`${API_BASE}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: text,
      });

      if (!response.ok) {
        const details = await response.json();
        throw new Error(details.detail || "Import failed");
      }

      setImportFile(null);
      await loadData();
    } catch (err) {
      setError(typeof err.message === "string" ? err.message : "Unable to import backup.");
    }
  }

  return (
    <div className="page-shell">
      <nav className="top-nav">
        <div>
          <p className="eyebrow">Prediction market journal and bankroll tracker</p>
          <h1>TTradez</h1>
        </div>
        <div className="nav-actions">
          <button
            type="button"
            className={activeView === "dashboard" ? "nav-link active" : "nav-link"}
            onClick={() => setActiveView("dashboard")}
          >
            Dashboard
          </button>
          <button
            type="button"
            className={activeView === "entry" ? "nav-link active" : "nav-link"}
            onClick={() => setActiveView("entry")}
          >
            Add Entry
          </button>
        </div>
      </nav>

      <header className="hero">
        <div>
          <p className="hero-copy">
            Track prediction contracts, bankroll deposits, and withdrawals in one focused
            journal built around Robinhood-style markets.
          </p>
        </div>
        <div className="hero-grid">
          <article className="metric-card">
            <span>Account balance</span>
            <strong>${formatMoney(summary.account_balance)}</strong>
          </article>
          <article className="metric-card">
            <span>Total deposits</span>
            <strong>${formatMoney(summary.total_deposits)}</strong>
          </article>
          <article className="metric-card">
            <span>Total withdrawals</span>
            <strong>${formatMoney(summary.total_withdrawals)}</strong>
          </article>
          <article className="metric-card">
            <span>Prediction trades</span>
            <strong>{summary.prediction_trades_logged}</strong>
          </article>
        </div>
      </header>

      {activeView === "entry" ? (
        <main className="entry-layout">
          <section className="panel">
            <div className="panel-heading">
              <h2>Add entry</h2>
              <p>Log either a prediction trade or a bankroll movement.</p>
            </div>

            <div className="entry-mode-toggle">
              <button
                type="button"
                className={entryMode === "trade" ? "nav-link active" : "nav-link"}
                onClick={() => setEntryMode("trade")}
              >
                Prediction Trade
              </button>
              <button
                type="button"
                className={entryMode === "cash" ? "nav-link active" : "nav-link"}
                onClick={() => setEntryMode("cash")}
              >
                Deposit / Withdrawal
              </button>
            </div>

            {entryMode === "trade" ? (
              <form className="trade-form" onSubmit={handleTradeSubmit}>
                <label>
                  Contract side
                  <select
                    value={tradeForm.prediction_side}
                    onChange={(event) =>
                      setTradeForm({ ...tradeForm, prediction_side: event.target.value })
                    }
                  >
                    <option value="YES">YES</option>
                    <option value="NO">NO</option>
                  </select>
                </label>

                <label>
                  Status
                  <select
                    value={tradeForm.resolution_status}
                    onChange={(event) =>
                      setTradeForm({ ...tradeForm, resolution_status: event.target.value })
                    }
                  >
                    <option value="ONGOING">Ongoing</option>
                    <option value="COMPLETE">Complete</option>
                  </select>
                </label>

                <label className="span-2">
                  Date
                  <input
                    type="date"
                    value={tradeForm.executed_at}
                    onChange={(event) =>
                      setTradeForm({ ...tradeForm, executed_at: event.target.value })
                    }
                    required
                  />
                </label>

                <label className="span-2">
                  Market / event name
                  <input
                    value={tradeForm.instrument_name}
                    onChange={(event) =>
                      setTradeForm({ ...tradeForm, instrument_name: event.target.value })
                    }
                    placeholder="Will Team 1 win tonight?"
                    required
                  />
                </label>

                <label>
                  Contracts bought
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={tradeForm.quantity}
                    onChange={(event) =>
                      setTradeForm({ ...tradeForm, quantity: event.target.value })
                    }
                    required
                  />
                </label>

                <label className="slider-field">
                  Buy price per contract
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={tradeForm.price}
                    onChange={(event) => setTradeForm({ ...tradeForm, price: event.target.value })}
                  />
                  <span className="slider-value">${formatContractPrice(tradeForm.price)}</span>
                </label>

                <label>
                  Fees
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={tradeForm.fees}
                    onChange={(event) => setTradeForm({ ...tradeForm, fees: event.target.value })}
                  />
                </label>

                <label>
                  Amount spent
                  <input value={`$${formatMoney(amountSpent(tradeForm))}`} disabled readOnly />
                </label>

                <label>
                  Contracts sold
                  <input value={tradeForm.quantity} disabled readOnly />
                </label>

                <label className="slider-field">
                  Sell price per contract
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={
                      tradeForm.resolution_status === "COMPLETE"
                        ? tradeForm.payout_per_contract || 0
                        : 0
                    }
                    onChange={(event) =>
                      setTradeForm({ ...tradeForm, payout_per_contract: event.target.value })
                    }
                    disabled={tradeForm.resolution_status !== "COMPLETE"}
                  />
                  <span className="slider-value">
                    $
                    {formatContractPrice(
                      tradeForm.resolution_status === "COMPLETE"
                        ? tradeForm.payout_per_contract || 0
                        : 0,
                    )}
                  </span>
                </label>

                <label>
                  Total sell price
                  <input value={`$${formatMoney(grossSellValue(tradeForm))}`} disabled readOnly />
                </label>

                <label>
                  Net profit
                  <input value={`$${formatMoney(netProfit(tradeForm))}`} disabled readOnly />
                </label>

                <label className="span-2">
                  Notes
                  <textarea
                    rows="4"
                    value={tradeForm.notes}
                    onChange={(event) => setTradeForm({ ...tradeForm, notes: event.target.value })}
                    placeholder="Why you took the contract, risk, and post-trade thoughts."
                  />
                </label>

                <button type="submit">Save prediction trade</button>
              </form>
            ) : (
              <form className="trade-form" onSubmit={handleCashSubmit}>
                <label>
                  Movement type
                  <select
                    value={cashForm.movement_type}
                    onChange={(event) =>
                      setCashForm({ ...cashForm, movement_type: event.target.value })
                    }
                  >
                    <option value="DEPOSIT">Deposit</option>
                    <option value="WITHDRAWAL">Withdrawal</option>
                  </select>
                </label>

                <label>
                  Date
                  <input
                    type="date"
                    value={cashForm.moved_at}
                    onChange={(event) => setCashForm({ ...cashForm, moved_at: event.target.value })}
                    required
                  />
                </label>

                <label className="span-2">
                  Amount
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={cashForm.amount}
                    onChange={(event) => setCashForm({ ...cashForm, amount: event.target.value })}
                    placeholder="500.00"
                    required
                  />
                </label>

                <label className="span-2">
                  Notes
                  <textarea
                    rows="4"
                    value={cashForm.notes}
                    onChange={(event) => setCashForm({ ...cashForm, notes: event.target.value })}
                    placeholder="Initial bankroll, payout transfer, or money pulled off the platform."
                  />
                </label>

                <button type="submit">
                  Save {cashForm.movement_type === "DEPOSIT" ? "deposit" : "withdrawal"}
                </button>
              </form>
            )}

            {error ? <p className="message error">{error}</p> : null}
          </section>
        </main>
      ) : (
        <main className="dashboard-layout">
          <section className="panel">
            <div className="panel-heading">
              <h2>Backup data</h2>
              <p>Export a JSON backup or restore from one. Import replaces current data.</p>
            </div>
            <div className="backup-actions">
              <button type="button" onClick={handleExport}>
                Export backup
              </button>
              <input
                type="file"
                accept="application/json"
                onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                className="secondary-button"
                onClick={handleImport}
                disabled={!importFile}
              >
                Import backup
              </button>
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <h2>Profitability</h2>
              <p>Running profit and loss across your prediction trade history.</p>
            </div>
            <ProfitChart entries={journalEntries} />
          </section>

          <section className="content-grid">
            <section className="panel">
              <div className="panel-heading">
                <h2>Open positions</h2>
                <p>Contracts still tying up bankroll.</p>
              </div>

              <div className="position-list">
                {summary.open_positions.length === 0 ? (
                  <p className="empty">No open positions yet.</p>
                ) : (
                  summary.open_positions.map((position) => (
                    <article key={position.key} className="position-card">
                      <h3>{position.instrument_name}</h3>
                      <p>Prediction {position.prediction_side}</p>
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
                          <dt>Cash tied up</dt>
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
                <p>Prediction trades and bankroll movements in one timeline.</p>
              </div>

              {error ? <p className="message error">{error}</p> : null}

              {loading ? (
                <p className="empty">Loading journal...</p>
              ) : journalEntries.length === 0 ? (
                <p className="empty">No journal entries yet.</p>
              ) : (
                <div className="journal-list">
                  {journalEntries.map((entry) => (
                    <article key={`${entry.entry_kind}-${entry.id}`} className="journal-card">
                      <div className="journal-header">
                        <div className="journal-badges">
                          <span className={`pill ${entry.entry_kind === "TRADE" ? "prediction" : "cash"}`}>
                            {entry.entry_kind === "TRADE" ? "PREDICTION" : "CASH"}
                          </span>
                          <span className="pill action">{entry.status}</span>
                        </div>
                        <IconButton
                          aria-label="Delete entry"
                          className="delete-button"
                          onClick={() => handleDelete(entry)}
                          size="small"
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </div>

                      <h3>{entry.title}</h3>
                      <p className="journal-meta">{entry.subtitle}</p>

                      {entry.entry_kind === "TRADE" ? (
                        <dl className="journal-details">
                          <div>
                            <dt>Contracts</dt>
                            <dd>{entry.quantity}</dd>
                          </div>
                          <div>
                            <dt>Buy price</dt>
                            <dd>${entry.buy_price}</dd>
                          </div>
                          <div>
                            <dt>Spent</dt>
                            <dd>${entry.amount_spent}</dd>
                          </div>
                          <div>
                            <dt>Date</dt>
                            <dd>{formatDate(entry.date)}</dd>
                          </div>
                          <div>
                            <dt>Sell price</dt>
                            <dd>{entry.sell_price === null ? "Ongoing" : `$${entry.sell_price}`}</dd>
                          </div>
                          <div>
                            <dt>Net profit</dt>
                            <dd className={entry.net_profit >= 0 ? "profit positive" : "profit negative"}>
                              ${formatMoney(entry.net_profit)}
                            </dd>
                          </div>
                        </dl>
                      ) : (
                        <dl className="journal-details">
                          <div>
                            <dt>Amount</dt>
                            <dd className={entry.cash_impact >= 0 ? "profit positive" : "profit negative"}>
                              ${formatMoney(entry.cash_impact)}
                            </dd>
                          </div>
                          <div>
                            <dt>Date</dt>
                            <dd>{formatDate(entry.date)}</dd>
                          </div>
                        </dl>
                      )}

                      {entry.notes ? <p className="notes">{entry.notes}</p> : null}

                      {entry.entry_kind === "TRADE" ? (
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => startEditing(entry)}
                        >
                          Edit entry
                        </button>
                      ) : null}

                      {entry.entry_kind === "TRADE" && editingTradeId === entry.id ? (
                        <form className="edit-form" onSubmit={handleUpdate}>
                          <label>
                            Date
                            <input
                              type="date"
                              value={editForm.executed_at}
                              onChange={(event) =>
                                setEditForm({ ...editForm, executed_at: event.target.value })
                              }
                              required
                            />
                          </label>
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
                          <label className="slider-field">
                            Sell price per contract
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.01"
                              value={
                                editForm.resolution_status === "COMPLETE"
                                  ? editForm.payout_per_contract || 0
                                  : 0
                              }
                              onChange={(event) =>
                                setEditForm({ ...editForm, payout_per_contract: event.target.value })
                              }
                              disabled={editForm.resolution_status !== "COMPLETE"}
                            />
                            <span className="slider-value">
                              $
                              {formatContractPrice(
                                editForm.resolution_status === "COMPLETE"
                                  ? editForm.payout_per_contract || 0
                                  : 0,
                              )}
                            </span>
                          </label>
                          <label>
                            Total sell price
                            <input value={`$${formatMoney(grossSellValue(editForm))}`} disabled readOnly />
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
                            Profit preview:
                            <span className={netProfit(editForm) >= 0 ? "profit positive" : "profit negative"}>
                              {" "}${formatMoney(netProfit(editForm))}
                            </span>
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
      )}
    </div>
  );
}

export default App;
