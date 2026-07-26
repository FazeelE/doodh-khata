"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { DEMO_PARTIES, DEMO_TRANSACTIONS, PRODUCT_OPTIONS } from "./demo-data";
import {
  generateBusinessAdvice,
  isFirebaseConfigured,
  removeTransaction,
  saveTransaction,
  subscribeToTransactions,
} from "./firebase-client";
import type {
  DairyTransaction,
  FirebaseState,
  InventoryItem,
  LedgerRow,
  TransactionInput,
  TransactionKind,
  Unit,
} from "./types";

type Tab = "dashboard" | "transactions" | "ledgers" | "inventory" | "advisor";
type Filter = "all" | "sale" | "purchase";

const STORAGE_KEY = "doodh-khata-demo-transactions";
const URDU_NAME = "\u062f\u0648\u062f\u06be \u06a9\u06be\u0627\u062a\u06c1";

const NAV_ITEMS: { id: Tab; label: string; mark: string }[] = [
  { id: "dashboard", label: "Overview", mark: "D" },
  { id: "transactions", label: "Transactions", mark: "T" },
  { id: "ledgers", label: "Ledgers", mark: "L" },
  { id: "inventory", label: "Inventory", mark: "I" },
  { id: "advisor", label: "AI Mashwara", mark: "AI" },
];

const money = (value: number) =>
  `Rs ${Math.round(value).toLocaleString("en-PK")}`;
const totalOf = (item: DairyTransaction) => item.quantity * item.rate;
const today = () => {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
};
const prettyDate = (date: string) =>
  new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short" }).format(
    new Date(`${date}T12:00:00`),
  );

function buildInventory(transactions: DairyTransaction[]) {
  const map = new Map<string, InventoryItem>();
  for (const option of PRODUCT_OPTIONS) {
    map.set(option.name, {
      product: option.name,
      unit: option.unit,
      purchased: 0,
      sold: 0,
      stock: 0,
      value: 0,
    });
  }
  for (const item of transactions) {
    const row = map.get(item.product) ?? {
      product: item.product,
      unit: item.unit,
      purchased: 0,
      sold: 0,
      stock: 0,
      value: 0,
    };
    if (item.kind === "purchase") row.purchased += item.quantity;
    else row.sold += item.quantity;
    row.stock = row.purchased - row.sold;
    row.value = Math.max(0, row.stock * item.rate);
    map.set(item.product, row);
  }
  return Array.from(map.values());
}

function buildLedgers(transactions: DairyTransaction[]) {
  const map = new Map<string, LedgerRow>();
  for (const item of transactions) {
    const row = map.get(item.party) ?? {
      name: item.party,
      role: item.kind === "sale" ? "customer" : "supplier",
      totalBusiness: 0,
      paid: 0,
      balance: 0,
      transactionCount: 0,
    };
    const itemTotal = totalOf(item);
    const role = item.kind === "sale" ? "customer" : "supplier";
    if (row.role !== role) row.role = "both";
    row.totalBusiness += itemTotal;
    row.paid += item.paid;
    row.balance += itemTotal - item.paid;
    row.transactionCount += 1;
    map.set(item.party, row);
  }
  return Array.from(map.values()).sort((a, b) => b.balance - a.balance);
}

function offlineAdvice(transactions: DairyTransaction[]) {
  const day = today();
  const daySales = transactions.filter((item) => item.date === day && item.kind === "sale");
  const dayPurchases = transactions.filter((item) => item.date === day && item.kind === "purchase");
  const sales = daySales.reduce((sum, item) => sum + totalOf(item), 0);
  const purchases = dayPurchases.reduce((sum, item) => sum + totalOf(item), 0);
  const receivable = transactions
    .filter((item) => item.kind === "sale")
    .reduce((sum, item) => sum + totalOf(item) - item.paid, 0);
  const milk = buildInventory(transactions).find((item) => item.product === "Loose milk");
  return `Today\'s trade is ${money(sales)} in sales against ${money(purchases)} in purchases.\n\n- Cash: ${money(receivable)} is still in customer udhaar; follow up on the largest balance first.\n- Stock: Loose milk shows ${Math.max(0, milk?.stock ?? 0).toFixed(1)} litres available from recorded entries.\n- Next step: Confirm evening demand before buying more and record every payment against the correct khata.`;
}

export default function DoodhKhata() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [transactions, setTransactions] = useState<DairyTransaction[]>(DEMO_TRANSACTIONS);
  const [firebaseState, setFirebaseState] = useState<FirebaseState>(
    isFirebaseConfigured ? "connecting" : "demo",
  );
  const [modalKind, setModalKind] = useState<TransactionKind | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");
  const [advice, setAdvice] = useState(offlineAdvice(DEMO_TRANSACTIONS));
  const [adviceState, setAdviceState] = useState<"sample" | "loading" | "live" | "error">("sample");

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as DairyTransaction[];
          if (Array.isArray(parsed) && parsed.length) {
            queueMicrotask(() => setTransactions(parsed));
          }
        } catch {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      }
      return;
    }

    let unsubscribe: undefined | (() => void);
    let active = true;
    subscribeToTransactions(
      (items) => {
        if (!active) return;
        setTransactions(items);
        setFirebaseState("connected");
      },
      () => active && setFirebaseState("error"),
    )
      .then((stop) => {
        if (active) unsubscribe = stop;
        else stop();
      })
      .catch(() => active && setFirebaseState("error"));
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const inventory = useMemo(() => buildInventory(transactions), [transactions]);
  const ledgers = useMemo(() => buildLedgers(transactions), [transactions]);
  const day = today();
  const todayRows = transactions.filter((item) => item.date === day);
  const todaySales = todayRows
    .filter((item) => item.kind === "sale")
    .reduce((sum, item) => sum + totalOf(item), 0);
  const todayPurchases = todayRows
    .filter((item) => item.kind === "purchase")
    .reduce((sum, item) => sum + totalOf(item), 0);
  const todayCashIn = todayRows
    .filter((item) => item.kind === "sale")
    .reduce((sum, item) => sum + item.paid, 0);
  const todayCashOut = todayRows
    .filter((item) => item.kind === "purchase")
    .reduce((sum, item) => sum + item.paid, 0);
  const receivable = transactions
    .filter((item) => item.kind === "sale")
    .reduce((sum, item) => sum + Math.max(0, totalOf(item) - item.paid), 0);
  const payable = transactions
    .filter((item) => item.kind === "purchase")
    .reduce((sum, item) => sum + Math.max(0, totalOf(item) - item.paid), 0);
  const lowStock = inventory.filter((item) => item.stock <= (item.unit === "litre" ? 30 : 5));

  const filteredTransactions = transactions.filter((item) => {
    const matchesFilter = filter === "all" || item.kind === filter;
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || `${item.party} ${item.product}`.toLowerCase().includes(query);
    return matchesFilter && matchesSearch;
  });

  const persistDemo = (items: DairyTransaction[]) => {
    setTransactions(items);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  };

  const handleSave = async (input: TransactionInput) => {
    if (isFirebaseConfigured) {
      await saveTransaction(input);
    } else {
      const item: DairyTransaction = {
        ...input,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
      };
      persistDemo([item, ...transactions]);
    }
    setModalKind(null);
    setToast(`${input.kind === "sale" ? "Sale" : "Purchase"} saved to khata`);
  };

  const handleDelete = async (item: DairyTransaction) => {
    if (!window.confirm(`Delete the ${item.product} entry for ${item.party}?`)) return;
    if (isFirebaseConfigured) await removeTransaction(item.id);
    else persistDemo(transactions.filter((row) => row.id !== item.id));
    setToast("Transaction removed");
  };

  const handleAdvice = async () => {
    setAdviceState("loading");
    if (!isFirebaseConfigured) {
      await new Promise((resolve) => window.setTimeout(resolve, 550));
      setAdvice(offlineAdvice(transactions));
      setAdviceState("sample");
      return;
    }
    try {
      setAdvice(await generateBusinessAdvice(transactions));
      setAdviceState("live");
    } catch {
      setAdviceState("error");
      setAdvice(offlineAdvice(transactions));
    }
  };

  const pageTitle = NAV_ITEMS.find((item) => item.id === activeTab)?.label ?? "Overview";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => setActiveTab("dashboard")} aria-label="Open Doodh Khata overview">
          <span className="brand-mark">DK</span>
          <span><strong>Doodh Khata</strong><small lang="ur" dir="rtl">{URDU_NAME}</small></span>
        </button>
        <nav className="side-nav" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => (
            <button key={item.id} className={activeTab === item.id ? "active" : ""} onClick={() => setActiveTab(item.id)}>
              <span className="nav-mark">{item.mark}</span><span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="profile-avatar">AK</div>
          <div><strong>Apna Khata</strong><small>{firebaseState === "connected" ? "Cloud synced" : "Demo business"}</small></div>
          <span className={`sync-dot ${firebaseState}`} aria-label={`Database status: ${firebaseState}`} />
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div><p className="eyebrow"><span className="desktop-date">Saturday, 25 July</span><span className="mobile-app-name">Doodh Khata</span></p><h1>{pageTitle}</h1></div>
          <div className="top-actions">
            <span className={`connection-pill ${firebaseState}`}>
              <span />{firebaseState === "connected" ? "Firebase live" : firebaseState === "connecting" ? "Connecting" : firebaseState === "error" ? "Sync issue" : "Demo mode"}
            </span>
            <button className="button secondary" onClick={() => setModalKind("purchase")}><span>+</span> Purchase</button>
            <button className="button primary" onClick={() => setModalKind("sale")}><span>+</span> Record sale</button>
          </div>
        </header>

        {activeTab === "dashboard" && (
          <Dashboard
            transactions={transactions}
            inventory={inventory}
            ledgers={ledgers}
            todaySales={todaySales}
            todayPurchases={todayPurchases}
            todayCashIn={todayCashIn}
            todayCashOut={todayCashOut}
            receivable={receivable}
            payable={payable}
            lowStock={lowStock}
            advice={advice}
            adviceState={adviceState}
            onAdvice={handleAdvice}
            onTab={setActiveTab}
          />
        )}

        {activeTab === "transactions" && (
          <section className="page-section">
            <div className="section-heading"><div><h2>Sale & purchase book</h2><p>Every litre, payment, and balance in one place.</p></div><button className="button primary" onClick={() => setModalKind("sale")}>+ New entry</button></div>
            <div className="toolbar card">
              <div className="segmented" aria-label="Filter transactions">
                {(["all", "sale", "purchase"] as Filter[]).map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item === "all" ? "All entries" : `${item}s`}</button>)}
              </div>
              <label className="search-box"><span aria-hidden="true">S</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search party or product" aria-label="Search transactions" /></label>
            </div>
            <TransactionTable rows={filteredTransactions} onDelete={handleDelete} />
          </section>
        )}

        {activeTab === "ledgers" && (
          <section className="page-section">
            <div className="section-heading"><div><h2>Party ledgers</h2><p>Know exactly who owes you and who you need to pay.</p></div><span className="count-badge">{ledgers.length} active khatas</span></div>
            <div className="ledger-summary-grid">
              <article className="summary-card green"><span>Customer udhaar</span><strong>{money(receivable)}</strong><small>Money to collect</small></article>
              <article className="summary-card amber"><span>Supplier payable</span><strong>{money(payable)}</strong><small>Money to settle</small></article>
              <article className="summary-card ink"><span>Total parties</span><strong>{ledgers.length}</strong><small>Customers and suppliers</small></article>
            </div>
            <div className="ledger-grid">
              {ledgers.map((row) => (
                <article className="ledger-card card" key={row.name}>
                  <div className="party-avatar">{row.name.split(" ").slice(0, 2).map((part) => part[0]).join("")}</div>
                  <div className="ledger-card-main"><div><h3>{row.name}</h3><span className={`role-tag ${row.role}`}>{row.role}</span></div><p>{row.transactionCount} entries - {money(row.totalBusiness)} business</p></div>
                  <div className="ledger-balance"><small>Open balance</small><strong>{money(row.balance)}</strong></div>
                </article>
              ))}
            </div>
          </section>
        )}

        {activeTab === "inventory" && (
          <section className="page-section">
            <div className="section-heading"><div><h2>Live inventory</h2><p>Stock is calculated automatically from purchases minus sales.</p></div><span className="count-badge">{lowStock.length} need attention</span></div>
            <div className="inventory-grid">
              {inventory.map((item) => (
                <article className="inventory-card card" key={item.product}>
                  <div className={`product-icon p-${item.product.toLowerCase().replaceAll(" ", "-")}`}>{item.product.slice(0, 2).toUpperCase()}</div>
                  <div className="inventory-title"><h3>{item.product}</h3><span className={item.stock <= (item.unit === "litre" ? 30 : 5) ? "stock-status low" : "stock-status good"}>{item.stock <= (item.unit === "litre" ? 30 : 5) ? "Low stock" : "Healthy"}</span></div>
                  <strong className="stock-number">{item.stock.toFixed(item.unit === "pack" ? 0 : 1)} <small>{item.unit}s</small></strong>
                  <div className="stock-track"><span style={{ width: `${Math.min(100, Math.max(4, item.stock * (item.unit === "litre" ? 0.7 : 5)))}%` }} /></div>
                  <div className="inventory-meta"><span>Bought <strong>{item.purchased.toFixed(0)}</strong></span><span>Sold <strong>{item.sold.toFixed(0)}</strong></span></div>
                </article>
              ))}
            </div>
          </section>
        )}

        {activeTab === "advisor" && (
          <AdvisorPage advice={advice} state={adviceState} onGenerate={handleAdvice} transactions={transactions} firebaseState={firebaseState} />
        )}
      </main>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {NAV_ITEMS.map((item) => <button key={item.id} className={activeTab === item.id ? "active" : ""} onClick={() => setActiveTab(item.id)}><span>{item.mark}</span><small>{item.label === "Transactions" ? "Entries" : item.label.replace("AI ", "")}</small></button>)}
      </nav>

      {modalKind && <TransactionModal kind={modalKind} onClose={() => setModalKind(null)} onSave={handleSave} />}
      {toast && <div className="toast" role="status"><span>OK</span>{toast}</div>}
    </div>
  );
}

type DashboardProps = {
  transactions: DairyTransaction[];
  inventory: InventoryItem[];
  ledgers: LedgerRow[];
  todaySales: number;
  todayPurchases: number;
  todayCashIn: number;
  todayCashOut: number;
  receivable: number;
  payable: number;
  lowStock: InventoryItem[];
  advice: string;
  adviceState: "sample" | "loading" | "live" | "error";
  onAdvice: () => void;
  onTab: (tab: Tab) => void;
};

function Dashboard(props: DashboardProps) {
  const { transactions, inventory, ledgers, todaySales, todayPurchases, todayCashIn, todayCashOut, receivable, payable, lowStock, advice, adviceState, onAdvice, onTab } = props;
  const milk = inventory.find((item) => item.product === "Loose milk");
  const maxFlow = Math.max(todaySales, todayPurchases, 1);
  return (
    <section className="dashboard-grid">
      <article className="welcome-card">
        <div><span className="hero-kicker">Aaj ka hisaab</span><h2>Your dairy, clearly accounted for.</h2><p>{transactions.filter((item) => item.date === today()).length} entries recorded today. Cash position is <strong>{money(todayCashIn - todayCashOut)}</strong>.</p><div className="hero-actions"><button className="button light" onClick={() => onTab("transactions")}>View day book</button><button className="text-button" onClick={() => onTab("ledgers")}>Check udhaar <span>-&gt;</span></button></div></div>
        <div className="milk-orbit"><div className="orbit-ring"><span>{Math.max(0, milk?.stock ?? 0).toFixed(0)}<small>litres</small></span></div><p>Milk available</p></div>
      </article>

      <div className="metric-grid">
        <Metric label="Today's sales" value={money(todaySales)} note={`${money(todayCashIn)} received`} tone="green" trend="+" />
        <Metric label="Today's purchases" value={money(todayPurchases)} note={`${money(todayCashOut)} paid`} tone="amber" trend="-" />
        <Metric label="Customer udhaar" value={money(receivable)} note={`${ledgers.filter((row) => row.role !== "supplier" && row.balance > 0).length} open khatas`} tone="blue" trend="C" />
        <Metric label="Supplier payable" value={money(payable)} note="Keep suppliers settled" tone="rose" trend="P" />
      </div>

      <article className="card flow-card">
        <div className="card-heading"><div><span className="section-kicker">Today</span><h3>Money movement</h3></div><span className={`net-pill ${todayCashIn - todayCashOut >= 0 ? "positive" : "negative"}`}>{money(todayCashIn - todayCashOut)} net cash</span></div>
        <div className="flow-bars">
          <div><label><span>Sales</span><strong>{money(todaySales)}</strong></label><div className="bar-track"><span className="sales-bar" style={{ width: `${(todaySales / maxFlow) * 100}%` }} /></div></div>
          <div><label><span>Purchases</span><strong>{money(todayPurchases)}</strong></label><div className="bar-track"><span className="purchase-bar" style={{ width: `${(todayPurchases / maxFlow) * 100}%` }} /></div></div>
          <div><label><span>Cash received</span><strong>{money(todayCashIn)}</strong></label><div className="bar-track"><span className="cash-bar" style={{ width: `${(todayCashIn / maxFlow) * 100}%` }} /></div></div>
        </div>
        <div className="flow-foot"><span><i className="dot sales" /> Sale value</span><span><i className="dot purchase" /> Purchase value</span><button onClick={() => onTab("transactions")}>Full day book</button></div>
      </article>

      <article className="card advisor-card">
        <div className="advisor-top"><span className="spark-mark">AI</span><div><span className="section-kicker">Rozana Mashwara</span><h3>Business briefing</h3></div><span className={`ai-label ${adviceState}`}>{adviceState === "live" ? "Gemini live" : adviceState === "loading" ? "Thinking" : "Sample"}</span></div>
        <p className="advisor-copy">{advice.split("\n")[0]}</p>
        <div className="advisor-mini"><div><span>Biggest balance</span><strong>{ledgers[0]?.name ?? "No balance"}</strong></div><div><span>Stock alerts</span><strong>{lowStock.length} products</strong></div></div>
        <button className="button advisor-button" onClick={onAdvice} disabled={adviceState === "loading"}>{adviceState === "loading" ? "Reviewing hisaab..." : "Refresh mashwara"}<span>-&gt;</span></button>
      </article>

      <article className="card recent-card">
        <div className="card-heading"><div><span className="section-kicker">Day book</span><h3>Recent entries</h3></div><button className="plain-link" onClick={() => onTab("transactions")}>See all</button></div>
        <div className="recent-list">{transactions.slice(0, 5).map((item) => <TransactionRow item={item} key={item.id} />)}</div>
      </article>

      <article className="card stock-card">
        <div className="card-heading"><div><span className="section-kicker">Inventory</span><h3>Stock at a glance</h3></div><button className="plain-link" onClick={() => onTab("inventory")}>Manage</button></div>
        <div className="stock-list">{inventory.slice(0, 5).map((item) => <div key={item.product}><span className="mini-product">{item.product.slice(0, 2).toUpperCase()}</span><div><strong>{item.product}</strong><small>{item.sold.toFixed(0)} sold</small></div><b className={item.stock < 5 ? "low-text" : ""}>{item.stock.toFixed(item.unit === "pack" ? 0 : 1)} {item.unit}</b></div>)}</div>
      </article>
    </section>
  );
}

function Metric({ label, value, note, tone, trend }: { label: string; value: string; note: string; tone: string; trend: string }) {
  return <article className="metric-card card"><div className={`metric-icon ${tone}`}>{trend}</div><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></article>;
}

function TransactionRow({ item }: { item: DairyTransaction }) {
  return <div className="transaction-row"><span className={`transaction-icon ${item.kind}`}>{item.kind === "sale" ? "S" : "P"}</span><div className="transaction-main"><strong>{item.party}</strong><span>{item.product} - {item.quantity} {item.unit}</span></div><div className="transaction-amount"><strong>{money(totalOf(item))}</strong><span className={totalOf(item) - item.paid > 0 ? "due" : "paid"}>{totalOf(item) - item.paid > 0 ? `${money(totalOf(item) - item.paid)} due` : "Paid"}</span></div></div>;
}

function TransactionTable({ rows, onDelete }: { rows: DairyTransaction[]; onDelete: (item: DairyTransaction) => void }) {
  return <div className="table-card card"><div className="table-head"><span>Party & product</span><span>Type</span><span>Date</span><span>Total</span><span>Payment</span><span /></div>{rows.length ? rows.map((item) => <div className="table-row" key={item.id}><div className="table-party"><span className={`transaction-icon ${item.kind}`}>{item.kind === "sale" ? "S" : "P"}</span><div><strong>{item.party}</strong><small>{item.product} - {item.quantity} {item.unit}{item.fat ? ` - ${item.fat}% fat` : ""}</small></div></div><span className={`kind-badge ${item.kind}`}>{item.kind}</span><span>{prettyDate(item.date)}</span><strong>{money(totalOf(item))}</strong><span className={totalOf(item) - item.paid > 0 ? "payment due" : "payment paid"}>{totalOf(item) - item.paid > 0 ? `${money(totalOf(item) - item.paid)} due` : "Settled"}</span><button className="delete-button" onClick={() => onDelete(item)} aria-label={`Delete transaction for ${item.party}`}>x</button></div>) : <div className="empty-state"><span>0</span><h3>No matching entries</h3><p>Try another search or record a new transaction.</p></div>}</div>;
}

function AdvisorPage({ advice, state, onGenerate, transactions, firebaseState }: { advice: string; state: "sample" | "loading" | "live" | "error"; onGenerate: () => void; transactions: DairyTransaction[]; firebaseState: FirebaseState }) {
  return <section className="advisor-page"><div className="advisor-hero"><div><span className="hero-kicker">Firebase AI Logic + Gemini</span><h2>Rozana Mashwara</h2><p>A practical daily briefing made from your real sales, purchases, stock, and udhaar - without business jargon.</p><button className="button light" onClick={onGenerate} disabled={state === "loading"}>{state === "loading" ? "Analyzing your khata..." : "Generate today's briefing"}</button></div><div className="ai-orb"><span>AI</span><i /><i /><i /></div></div><div className="advisor-layout"><article className="card briefing-card"><div className="briefing-head"><div><span className="spark-mark">AI</span><div><span className="section-kicker">Saturday briefing</span><h3>Your dairy coach says</h3></div></div><span className={`ai-label ${state}`}>{state === "live" ? "Live analysis" : firebaseState === "connected" ? "Ready" : "Demo preview"}</span></div><div className="briefing-copy">{advice.split("\n").filter(Boolean).map((line, index) => line.startsWith("-") ? <div className="advice-line" key={index}><span>{index}</span><p>{line.replace(/^-\s*/, "")}</p></div> : <h4 key={index}>{line}</h4>)}</div><div className="privacy-note"><span>Private by design</span>Only your transaction summary is sent for analysis. The prompt asks the model not to invent prices or guarantees.</div></article><aside className="card context-card"><span className="section-kicker">Data reviewed</span><h3>{transactions.length} entries</h3><div><span>Sales</span><strong>{transactions.filter((item) => item.kind === "sale").length}</strong></div><div><span>Purchases</span><strong>{transactions.filter((item) => item.kind === "purchase").length}</strong></div><div><span>Products</span><strong>{new Set(transactions.map((item) => item.product)).size}</strong></div><p>{firebaseState === "connected" ? "Synced securely to your private Firebase user path." : "Connect Firebase to switch from the sample briefing to live Gemini analysis."}</p></aside></div></section>;
}

function TransactionModal({ kind, onClose, onSave }: { kind: TransactionKind; onClose: () => void; onSave: (input: TransactionInput) => Promise<void> }) {
  const defaultProduct = PRODUCT_OPTIONS[0];
  const [party, setParty] = useState("");
  const [product, setProduct] = useState<string>(defaultProduct.name);
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState<Unit>(defaultProduct.unit);
  const [rate, setRate] = useState(String(kind === "sale" ? defaultProduct.rate : 170));
  const [paid, setPaid] = useState("");
  const [fat, setFat] = useState("");
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const total = Number(quantity || 0) * Number(rate || 0);

  useEffect(() => { const handle = (event: KeyboardEvent) => event.key === "Escape" && onClose(); window.addEventListener("keydown", handle); return () => window.removeEventListener("keydown", handle); }, [onClose]);

  const changeProduct = (value: string) => {
    setProduct(value);
    const option = PRODUCT_OPTIONS.find((item) => item.name === value);
    if (option) { setUnit(option.unit); setRate(String(kind === "sale" ? option.rate : Math.round(option.rate * 0.78))); }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!party.trim() || Number(quantity) <= 0 || Number(rate) <= 0) return;
    setSaving(true);
    try {
      await onSave({ kind, party: party.trim(), product, quantity: Number(quantity), unit, rate: Number(rate), paid: Math.min(Number(paid || 0), total), fat: fat ? Number(fat) : undefined, date, notes: notes.trim() || undefined });
    } finally { setSaving(false); }
  };

  const partyOptions = DEMO_PARTIES.filter((item) => item.role === "both" || item.role === (kind === "sale" ? "customer" : "supplier"));
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-head"><div><span className={`kind-badge ${kind}`}>{kind}</span><h2 id="modal-title">Record {kind}</h2><p>Add it once. Stock and ledgers update automatically.</p></div><button className="close-button" onClick={onClose} aria-label="Close dialog">x</button></div><form onSubmit={submit}><div className="form-grid"><label className="field full"><span>{kind === "sale" ? "Customer" : "Supplier"}</span><input list="party-options" value={party} onChange={(event) => setParty(event.target.value)} placeholder={kind === "sale" ? "e.g. Rehman Sweets" : "e.g. Haji Kareem Farm"} required autoFocus /><datalist id="party-options">{partyOptions.map((item) => <option key={item.id} value={item.name} />)}</datalist></label><label className="field"><span>Product</span><select value={product} onChange={(event) => changeProduct(event.target.value)}>{PRODUCT_OPTIONS.map((item) => <option key={item.name}>{item.name}</option>)}</select></label><label className="field"><span>Date</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label><label className="field quantity-field"><span>Quantity</span><div><input type="number" min="0.1" step="0.1" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="0" required /><select value={unit} onChange={(event) => setUnit(event.target.value as Unit)}><option value="litre">litre</option><option value="kg">kg</option><option value="pack">pack</option></select></div></label><label className="field"><span>Rate per {unit}</span><div className="money-input"><b>Rs</b><input type="number" min="1" value={rate} onChange={(event) => setRate(event.target.value)} required /></div></label>{product === "Loose milk" && <label className="field"><span>Fat % <small>optional</small></span><input type="number" min="0" max="15" step="0.1" value={fat} onChange={(event) => setFat(event.target.value)} placeholder="4.2" /></label>}<label className="field"><span>Amount paid</span><div className="money-input"><b>Rs</b><input type="number" min="0" max={total || undefined} value={paid} onChange={(event) => setPaid(event.target.value)} placeholder="0" /></div></label><label className="field full"><span>Notes <small>optional</small></span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Morning collection, delivery details, quality note..." rows={2} /></label></div><div className="bill-preview"><div><span>Transaction total</span><strong>{money(total)}</strong></div><div><span>Added to {kind === "sale" ? "customer udhaar" : "supplier payable"}</span><strong>{money(Math.max(0, total - Number(paid || 0)))}</strong></div></div><div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button type="submit" className="button primary" disabled={saving}>{saving ? "Saving..." : `Save ${kind}`}</button></div></form></section></div>;
}




