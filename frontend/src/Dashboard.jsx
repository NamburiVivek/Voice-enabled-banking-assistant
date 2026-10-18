import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
    Home,
    CreditCard,
    ArrowLeftRight,
    Settings,
    Send,
    PlusCircle,
    FileText,
    ArrowLeft,
    ArrowRight,
    ArrowUpRight,
    ArrowDownLeft,
    Mic,
    Eye,
    EyeOff,
    ShoppingBag,
    Coffee,
    Smartphone,
    LogOut,
    CheckCircle,
    Copy,
    Download,
    Printer,
    Search,
    Shield,
    Lock,
    Unlock,
    Zap,
    X,
    AlertCircle,
    User as UserIcon,
    Radio,
    Clock,
    Check,
    AlertTriangle,
    Volume2,
    VolumeX,
    Sparkles,
    RefreshCw,
} from 'lucide-react';
import { useAuth } from './AuthContext.jsx';
import { authApi, bankingApi, voiceApi } from './api.js';
import './Dashboard.css';

// ── Leaf Logo ────────────────────────────────────────────────────────────────
function LeafLogo({ size = 40 }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="leaf-logo"
        >
            <defs>
                <linearGradient id="leafGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--color-primary)" />
                    <stop offset="100%" stopColor="var(--color-accent)" />
                </linearGradient>
            </defs>
            <path d="M50 92 L50 22" stroke="url(#leafGradient)" strokeWidth="3" strokeLinecap="round" />
            <path d="M50 34 C30 34 14 18 12 4 C34 4 50 16 50 34 Z" fill="url(#leafGradient)" />
            <path d="M50 50 C72 50 88 34 90 20 C68 20 50 32 50 50 Z" fill="url(#leafGradient)" />
            <path d="M50 62 C34 62 22 50 19 38 C39 38 50 46 50 62 Z" fill="url(#leafGradient)" />
        </svg>
    );
}

// ── Currency Formatter (INR ₹) ───────────────────────────────────────────────

// ─── CSV Statement Export Helper ──────────────────────────────────────────────
export function exportCsvToUser(transactions) {
    if (!transactions || transactions.length === 0) {
        alert('No transactions to export.');
        return;
    }
    const headers = ['Transaction ID', 'Date', 'Description', 'Category', 'Type', 'Amount (INR)', 'Status'];
    const rows = transactions.map((t) => [
        t.id,
        t.date,
        `"${(t.name || '').replace(/"/g, '""')}"`,
        t.category || 'General',
        (t.type || 'DEBIT').toUpperCase(),
        typeof t.amount === 'number' ? t.amount.toFixed(2) : t.amount,
        t.status || 'Completed',
    ]);
    const csvContent =
        'data:text/csv;charset=utf-8,' +
        [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Voxa_Statement_INR_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function formatINR(val) {
    const num = Number(val) || 0;
    return `₹${num.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

// ── Helper: Deterministic generation per user ────────────────────────────────
function getUserSeed(user) {
    const str = user?.id || user?.email || 'default_user';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash * 31 + str.charCodeAt(i)) & 0xffffffff;
    }
    return Math.abs(hash);
}

function getInitialBankingData(user) {
    const seed = getUserSeed(user);
    const last4 = String((seed % 9000) + 1000);
    const bin2 = String(((seed * 3) % 9000) + 1000);
    const bin3 = String(((seed * 7) % 9000) + 1000);
    const cvv = String((seed % 900) + 100);
    const fullCard = `4532 ${bin2} ${bin3} ${last4}`;
    const accountNum = `5021${last4}${String((seed % 90) + 10)}`;

    return {
        accountNumber: accountNum,
        ifscCode: 'VOXA0001824',
        balance: 0.0, // Initial balance starts at ₹0.00
        card: {
            cardNumber: fullCard,
            last4: last4,
            expiry: '08/29',
            cvv: cvv,
            cardholder: (user?.full_name || 'VOXA MEMBER').toUpperCase(),
            dailyLimit: 50000,
            perTxLimit: 25000,
            domestic: true,
            international: false,
            online: true,
            atm: true,
            frozen: false,
        },
        transactions: [], // Initial transactions start empty
        preferences: {
            emailAlerts: true,
            twoFactor: true,
            biometrics: false,
        },
    };
}

// ── Confirmation Logout Modal ────────────────────────────────────────────────

// ─── Voice Action Authorization Modal ───────────────────────────────────────
function VoiceActionConfirmModal({ actionData, onClose, onConfirm, onCancel }) {
    if (!actionData) return null;
    const isBill = actionData.action === 'BILL_CONFIRMATION' || Boolean(actionData.biller);
    const isDeposit = actionData.action === 'DEPOSIT_CONFIRMATION';

    const title = isBill ? 'Voice Bill Payment Authorization' : isDeposit ? 'Voice Deposit Authorization' : 'Voice Transfer Authorization';
    const sub = isBill ? 'VoxaBank AI detected a utility bill payment request' : isDeposit ? 'VoxaBank AI detected an account deposit request' : 'VoxaBank AI detected a fund transfer request';
    const partyLabel = isBill ? 'Biller / Provider' : isDeposit ? 'Payment Method' : 'Recipient';
    const partyVal = isBill ? (actionData.biller || 'Utility Provider') : isDeposit ? (actionData.method || 'UPI') : (actionData.recipient || 'Beneficiary');
    const categoryVal = isBill ? 'Utility Bill Payment' : isDeposit ? 'Deposit' : (actionData.category || 'Peer Transfer');
    const confirmBtnText = isBill ? 'Confirm Bill Payment' : isDeposit ? 'Confirm Deposit' : 'Confirm Transfer';

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-card voice-confirm-modal-card glass-card" onClick={(e) => e.stopPropagation()}>
                <div className="voice-modal-header">
                    <div className="voice-modal-icon pulse-glow">
                        {isBill ? <Zap size={26} /> : isDeposit ? <ArrowDownLeft size={26} /> : <Send size={26} />}
                    </div>
                    <div>
                        <h3 className="voice-modal-title">{title}</h3>
                        <p className="voice-modal-sub">{sub}</p>
                    </div>
                </div>

                <div className="voice-confirm-details">
                    <div className="voice-detail-row">
                        <span className="voice-detail-label">{partyLabel}</span>
                        <span className="voice-detail-val highlight">{partyVal}</span>
                    </div>
                    <div className="voice-detail-row">
                        <span className="voice-detail-label">Amount</span>
                        <span className="voice-detail-val amount-highlight">{formatINR(actionData.amount)}</span>
                    </div>
                    <div className="voice-detail-row">
                        <span className="voice-detail-label">Category</span>
                        <span className="voice-detail-val">{categoryVal}</span>
                    </div>
                    {actionData.memo && (
                        <div className="voice-detail-row">
                            <span className="voice-detail-label">Note</span>
                            <span className="voice-detail-val">{actionData.memo}</span>
                        </div>
                    )}
                </div>

                <p className="voice-confirm-prompt">
                    Say <strong>"Yes"</strong> aloud or click below to authorize this transaction securely.
                </p>

                <div className="voice-modal-actions">
                    <button type="button" className="btn-modal-cancel" onClick={onCancel} id="voice-cancel-action-btn">
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="btn-modal-confirm-transfer"
                        onClick={onConfirm}
                        id="voice-confirm-action-btn"
                    >
                        <CheckCircle size={18} />
                        <span>{confirmBtnText}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Floating Voice Assistant Trigger ─────────────────────────────────────────
function FloatingVoiceButton({ onClick, isListening }) {
    return (
        <button
            className={`floating-voice-trigger ${isListening ? 'listening' : ''}`}
            onClick={onClick}
            title={isListening ? 'Assistant listening...' : 'VoxaBank Voice Assistant'}
            id="floating-voice-trigger-btn"
        >
            <Mic size={26} />
        </button>
    );
}

function ConfirmLogoutModal({ isOpen, onClose, onConfirm }) {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-card confirm-modal-card" onClick={(e) => e.stopPropagation()}>
                <div className="confirm-modal-icon">
                    <LogOut size={30} />
                </div>
                <h3 className="confirm-modal-title">Confirm Sign Out</h3>
                <p className="confirm-modal-desc">
                    Are you sure you want to log out of your Voxa account? Your session will end and you will need to sign back in to access your banking dashboard.
                </p>

                <div className="confirm-modal-actions">
                    <button type="button" className="btn-modal-cancel" onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="btn-modal-confirm-logout"
                        onClick={onConfirm}
                        id="modal-confirm-logout-btn"
                    >
                        <LogOut size={16} />
                        <span>Yes, Log Out</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Sidebar Component ────────────────────────────────────────────────────────
const navItems = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'cards', icon: CreditCard, label: 'Cards' },
    { id: 'transfers', icon: ArrowLeftRight, label: 'Transfers' },
    { id: 'statements', icon: FileText, label: 'Statements' },
    { id: 'settings', icon: Settings, label: 'Settings' },
];

function Sidebar({ activeTab, setActiveTab, onBack, onRequestLogout }) {
    const { user } = useAuth();

    const initials = user?.full_name
        ? user.full_name
              .trim()
              .split(/\s+/)
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)
        : 'U';

    return (
        <aside className="dashboard-sidebar">
            <div className="sidebar-top">
                <LeafLogo size={36} />
                <span className="sidebar-brand">Voxa</span>
            </div>

            <nav className="sidebar-nav">
                {navItems.map(({ id, icon: Icon, label }) => (
                    <button
                        key={id}
                        className={`sidebar-nav-item ${activeTab === id ? 'active' : ''}`}
                        onClick={() => setActiveTab(id)}
                        id={`nav-${id}-btn`}
                    >
                        <Icon size={20} />
                        <span>{label}</span>
                    </button>
                ))}
            </nav>

            <div className="sidebar-bottom">
                {user && (
                    <div className="sidebar-user-card glass">
                        <div className="sidebar-user-avatar">{initials}</div>
                        <div className="sidebar-user-info">
                            <span className="sidebar-user-name" title={user.full_name}>
                                {user.full_name}
                            </span>
                            <span className="sidebar-user-email" title={user.email}>
                                {user.email}
                            </span>
                        </div>
                    </div>
                )}

                <div className="sidebar-actions">
                    <button className="dashboard-back" onClick={onBack} title="Back to Home">
                        <ArrowLeft size={18} />
                        <span>Home</span>
                    </button>
                    <button
                        className="dashboard-logout-btn"
                        onClick={onRequestLogout}
                        title="Sign out of your account"
                        id="dashboard-logout-btn"
                    >
                        <LogOut size={18} />
                        <span>Log Out</span>
                    </button>
                </div>
            </div>
        </aside>
    );
}

// ── Home View ────────────────────────────────────────────────────────────────
function HomeView({
    user,
    bankingData,
    onOpenDeposit,
    onOpenBillPay,
    onNavigateTab,
    isMasked,
    setIsMasked,
}) {
    const balanceVisible = !isMasked;
    const toggleBalanceVisible = () => setIsMasked((prev) => !prev);

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const displayName = user?.full_name || 'Customer';

    const totalIncome = useMemo(() => {
        return bankingData.transactions
            .filter((tx) => tx.type === 'credit')
            .reduce((sum, tx) => sum + tx.amount, 0);
    }, [bankingData.transactions]);

    const totalExpenses = useMemo(() => {
        return bankingData.transactions
            .filter((tx) => tx.type === 'debit')
            .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    }, [bankingData.transactions]);

    const formattedBalance = formatINR(bankingData.balance);
    const recentList = bankingData.transactions.slice(0, 4);

    return (
        <div className="dashboard-main-content">
            <div className="dashboard-greeting">
                <h1>{greeting}, {displayName} 👋</h1>
                <p>Here's what's happening with your account today.</p>
            </div>

            {/* Balance Card */}
            <div className="balance-card glass glass-card">
                <div className="balance-card-header">
                    <span className="balance-label">Total Balance</span>
                    <button
                        className="balance-toggle"
                        onClick={toggleBalanceVisible}
                        aria-label={balanceVisible ? 'Hide balance' : 'Show balance'}
                    >
                        {balanceVisible ? <Eye size={18} /> : <EyeOff size={18} />}
                    </button>
                </div>
                <div className="balance-amount">{balanceVisible ? formattedBalance : '••••••••'}</div>
                <div className="balance-sub">
                    <span>Voxa Savings •••• {bankingData.card?.last4 || '4821'}</span>
                </div>

                <div className="balance-card-actions">
                    <button
                        className="btn-deposit-primary"
                        onClick={onOpenDeposit}
                        id="balance-deposit-btn"
                    >
                        <PlusCircle size={17} />
                        <span>Deposit Funds</span>
                    </button>
                    <button
                        className="btn-balance-secondary"
                        onClick={() => onNavigateTab('transfers')}
                        id="balance-transfer-btn"
                    >
                        <Send size={16} />
                        <span>Send Money</span>
                    </button>
                </div>
            </div>

            {/* Spending Summary */}
            <div className="spending-summary">
                <div className="summary-card glass glass-card">
                    <span className="summary-label">Monthly Inflow</span>
                    <span className="summary-amount credit">
                        +{formatINR(totalIncome)}
                    </span>
                </div>
                <div className="summary-card glass glass-card">
                    <span className="summary-label">Monthly Outflow</span>
                    <span className="summary-amount debit">
                        -{formatINR(totalExpenses)}
                    </span>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="quick-actions">
                <button
                    className="quick-action-btn glass"
                    onClick={() => onNavigateTab('transfers')}
                    id="qa-send-money-btn"
                >
                    <span className="quick-action-icon"><Send size={22} /></span>
                    <span>Send Money</span>
                </button>
                <button
                    className="quick-action-btn glass"
                    onClick={onOpenDeposit}
                    id="qa-add-money-btn"
                >
                    <span className="quick-action-icon"><PlusCircle size={22} /></span>
                    <span>Add Money</span>
                </button>
                <button
                    className="quick-action-btn glass"
                    onClick={onOpenBillPay}
                    id="qa-pay-bills-btn"
                >
                    <span className="quick-action-icon"><FileText size={22} /></span>
                    <span>Pay Bills</span>
                </button>
                <button
                    className="quick-action-btn glass"
                    onClick={() => onNavigateTab('cards')}
                    id="qa-cards-btn"
                >
                    <span className="quick-action-icon"><CreditCard size={22} /></span>
                    <span>Cards</span>
                </button>
            </div>

            {/* Recent Transactions */}
            <div className="transactions-card glass glass-card">
                <div className="transactions-header">
                    <h3>Recent Transactions</h3>
                    {bankingData.transactions.length > 0 && (
                        <button
                            className="view-all-link"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit' }}
                            onClick={() => onNavigateTab('statements')}
                            id="view-all-transactions-btn"
                        >
                            View all
                        </button>
                    )}
                </div>

                {recentList.length === 0 ? (
                    <div className="empty-state-card">
                        <div className="empty-state-icon">
                            <Clock size={28} />
                        </div>
                        <h4>No transactions yet</h4>
                        <p>Deposit funds or make your first transfer to see activity recorded here.</p>
                        <button
                            className="btn-deposit-primary"
                            style={{ marginTop: '0.5rem' }}
                            onClick={onOpenDeposit}
                        >
                            <PlusCircle size={16} /> Make a Deposit
                        </button>
                    </div>
                ) : (
                    <div className="transactions-list">
                        {recentList.map((tx) => (
                            <div className="transaction-row" key={tx.id}>
                                <div className={`transaction-icon ${tx.type}`}>
                                    {tx.type === 'credit' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                                </div>
                                <div className="transaction-info">
                                    <span className="transaction-name">{tx.name}</span>
                                    <span className="transaction-date">{tx.date}</span>
                                </div>
                                <div className={`transaction-amount ${tx.type}`}>
                                    {tx.amount > 0 ? '+' : '-'}{formatINR(Math.abs(tx.amount))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Cards View ───────────────────────────────────────────────────────────────
function CardsView({ bankingData, setBankingData }) {
    const card = bankingData.card;
    const [revealNumber, setRevealNumber] = useState(false);
    const [revealCvv, setRevealCvv] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);
    const [savedToast, setSavedToast] = useState(false);

    const toggleFreeze = () => {
        setBankingData((prev) => ({
            ...prev,
            card: { ...prev.card, frozen: !prev.card.frozen },
        }));
    };

    const handleCopyNumber = () => {
        navigator.clipboard.writeText(card.cardNumber.replace(/\s+/g, ''));
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    };

    const handleLimitChange = (key, val) => {
        setBankingData((prev) => ({
            ...prev,
            card: { ...prev.card, [key]: Number(val) },
        }));
    };

    const handleToggleChannel = (key) => {
        setBankingData((prev) => ({
            ...prev,
            card: { ...prev.card, [key]: !prev.card[key] },
        }));
    };

    const handleSaveSettings = () => {
        setSavedToast(true);
        setTimeout(() => setSavedToast(false), 2500);
    };

    const displayCardNumber = revealNumber
        ? card.cardNumber
        : `4532 •••• •••• ${card.last4}`;

    return (
        <div className="dashboard-main-content">
            <div className="tab-header">
                <h1>Cards & Security</h1>
                <p>Manage your virtual RuPay / Visa platinum debit card, real-time limits, and security channels.</p>
            </div>

            <div className="cards-layout">
                {/* Physical Card Representation */}
                <div className="card-showcase-container">
                    <div className={`virtual-card ${card.frozen ? 'frozen' : ''}`}>
                        <div className="virtual-card-glare" />
                        {card.frozen && <div className="frozen-badge">Card Frozen 🔒</div>}

                        <div className="card-top-row">
                            <div className="card-bank-name">
                                <LeafLogo size={24} />
                                <span>Voxa Bank</span>
                            </div>
                            <span className="card-type-label">Platinum Debit</span>
                        </div>

                        <div className="card-chip-row">
                            <div className="card-emv-chip" />
                            <Radio size={20} color="rgba(255,255,255,0.7)" style={{ transform: 'rotate(90deg)' }} />
                        </div>

                        <div className="card-number-display">
                            <span>{displayCardNumber}</span>
                            <button
                                type="button"
                                onClick={() => setRevealNumber(!revealNumber)}
                                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '4px' }}
                                title={revealNumber ? 'Hide full number' : 'Show full number'}
                            >
                                {revealNumber ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>

                        <div className="card-bottom-row">
                            <div className="card-meta-group">
                                <span className="card-meta-title">Cardholder</span>
                                <span className="card-meta-value">{card.cardholder}</span>
                            </div>
                            <div className="card-meta-group">
                                <span className="card-meta-title">Expires</span>
                                <span className="card-meta-value">{card.expiry}</span>
                            </div>
                            <div className="card-meta-group">
                                <span className="card-meta-title">CVV</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span className="card-meta-value">{revealCvv ? card.cvv : '•••'}</span>
                                    <button
                                        type="button"
                                        onClick={() => setRevealCvv(!revealCvv)}
                                        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}
                                    >
                                        {revealCvv ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Card Action Buttons */}
                    <div className="card-actions-strip">
                        <button
                            className={`card-action-btn ${card.frozen ? '' : 'freeze'}`}
                            onClick={toggleFreeze}
                            id="toggle-freeze-card-btn"
                        >
                            {card.frozen ? <Unlock size={16} /> : <Lock size={16} />}
                            <span>{card.frozen ? 'Unfreeze Card' : 'Freeze Card'}</span>
                        </button>

                        <button className="card-action-btn" onClick={handleCopyNumber}>
                            {copySuccess ? <Check size={16} color="#4ade80" /> : <Copy size={16} />}
                            <span>{copySuccess ? 'Copied!' : 'Copy Card #'}</span>
                        </button>
                    </div>
                </div>

                {/* Card Controls & Limits */}
                <div className="card-settings-card glass glass-card">
                    <h3>Card Limits & Security Channels</h3>

                    {/* Daily Spending Limit Slider */}
                    <div className="slider-group">
                        <div className="slider-header">
                            <span>Daily Spending Limit</span>
                            <strong>{formatINR(card.dailyLimit)}</strong>
                        </div>
                        <input
                            type="range"
                            min="5000"
                            max="200000"
                            step="5000"
                            value={card.dailyLimit}
                            onChange={(e) => handleLimitChange('dailyLimit', e.target.value)}
                            className="range-slider"
                        />
                    </div>

                    {/* Per-Transaction Limit Slider */}
                    <div className="slider-group">
                        <div className="slider-header">
                            <span>Per-Transaction Limit</span>
                            <strong>{formatINR(card.perTxLimit)}</strong>
                        </div>
                        <input
                            type="range"
                            min="1000"
                            max="100000"
                            step="1000"
                            value={card.perTxLimit}
                            onChange={(e) => handleLimitChange('perTxLimit', e.target.value)}
                            className="range-slider"
                        />
                    </div>

                    {/* Channel Toggles */}
                    <div className="toggles-list">
                        <div className="toggle-row">
                            <div className="toggle-info">
                                <h5>Domestic Transactions</h5>
                                <p>Enable merchant swipe & POS payments in India</p>
                            </div>
                            <label className="switch">
                                <input
                                    type="checkbox"
                                    checked={card.domestic}
                                    onChange={() => handleToggleChannel('domestic')}
                                />
                                <span className="switch-slider" />
                            </label>
                        </div>

                        <div className="toggle-row">
                            <div className="toggle-info">
                                <h5>International Transactions</h5>
                                <p>Enable global cross-border payments and forex conversions</p>
                            </div>
                            <label className="switch">
                                <input
                                    type="checkbox"
                                    checked={card.international}
                                    onChange={() => handleToggleChannel('international')}
                                />
                                <span className="switch-slider" />
                            </label>
                        </div>

                        <div className="toggle-row">
                            <div className="toggle-info">
                                <h5>Online / E-Commerce (e-Mandate)</h5>
                                <p>Allow online checkout, UPI e-commerce, and digital merchants</p>
                            </div>
                            <label className="switch">
                                <input
                                    type="checkbox"
                                    checked={card.online}
                                    onChange={() => handleToggleChannel('online')}
                                />
                                <span className="switch-slider" />
                            </label>
                        </div>

                        <div className="toggle-row">
                            <div className="toggle-info">
                                <h5>ATM Cash Withdrawals</h5>
                                <p>Allow physical ATM cash dispensing with 4-digit PIN</p>
                            </div>
                            <label className="switch">
                                <input
                                    type="checkbox"
                                    checked={card.atm}
                                    onChange={() => handleToggleChannel('atm')}
                                />
                                <span className="switch-slider" />
                            </label>
                        </div>
                    </div>

                    <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button className="btn-save-settings" onClick={handleSaveSettings}>
                            Save Card Settings
                        </button>
                        {savedToast && (
                            <span style={{ color: '#4ade80', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <CheckCircle size={16} /> Preferences updated!
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Transfers View (Strict Database Verification) ────────────────────────────
function TransfersView({
    user,
    bankingData,
    setBankingData,
    onOpenDeposit,
    onTransferSuccess,
    onRefreshAccount,
}) {
    const [recipient, setRecipient] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('Peer Transfer');
    const [note, setNote] = useState('');
    const [error, setError] = useState('');

    // Verification state
    const [verifying, setVerifying] = useState(false);
    const [verifiedUser, setVerifiedUser] = useState(null); // { id, full_name, email }
    const [verifyError, setVerifyError] = useState('');

    // Registered Voxa users fetched from live Supabase database
    const [registeredUsers, setRegisteredUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(true);

    const currentBalance = bankingData.balance;

    // Fetch other registered Voxa users from Supabase on mount
    useEffect(() => {
        let mounted = true;
        const fetchUsers = async () => {
            try {
                const res = await bankingApi.getVoxaUsers();
                if (mounted) {
                    setRegisteredUsers(res.data || []);
                }
            } catch {
                if (mounted) setRegisteredUsers([]);
            } finally {
                if (mounted) setLoadingUsers(false);
            }
        };
        fetchUsers();
        return () => {
            mounted = false;
        };
    }, []);

    // Live verification debounced
    useEffect(() => {
        const trimmed = recipient.trim();
        if (!trimmed) {
            setVerifiedUser(null);
            setVerifyError('');
            return;
        }

        const timer = setTimeout(async () => {
            setVerifying(true);
            setVerifyError('');
            setVerifiedUser(null);
            try {
                const res = await bankingApi.verifyRecipient(trimmed);
                setVerifiedUser(res.data);
                setVerifyError('');
            } catch (err) {
                const msg = err.response?.data?.detail || 'Recipient not found in Voxa database.';
                setVerifyError(typeof msg === 'string' ? msg : 'Recipient is not a registered Voxa user.');
                setVerifiedUser(null);
            } finally {
                setVerifying(false);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [recipient]);

    const handleSelectBeneficiary = (u) => {
        setRecipient(u.email);
        setVerifiedUser(u);
        setVerifyError('');
    };

    const handleChipAmount = (amt) => {
        setAmount(String(amt));
        setError('');
    };

    const handleSubmitTransfer = async (e) => {
        e.preventDefault();
        setError('');

        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount) || numericAmount <= 0) {
            setError('Please enter a valid transfer amount greater than ₹0.');
            return;
        }

        if (numericAmount > currentBalance) {
            setError(`Insufficient balance (${formatINR(currentBalance)}). Please deposit funds first.`);
            return;
        }

        if (!recipient.trim()) {
            setError('Please provide a recipient registered Voxa email or ID.');
            return;
        }

        // Verify with backend before submitting
        setVerifying(true);
        let targetUser = verifiedUser;
        try {
            if (!targetUser) {
                const res = await bankingApi.verifyRecipient(recipient.trim());
                targetUser = res.data;
                setVerifiedUser(targetUser);
            }
        } catch (err) {
            const msg = err.response?.data?.detail || 'Recipient not found in Voxa database.';
            setError(typeof msg === 'string' ? msg : 'Recipient is not a registered Voxa user.');
            setVerifying(false);
            return;
        }
        setVerifying(false);

        if (!targetUser) {
            setError('Recipient must be a registered Voxa user in the database.');
            setVerifying(false);
            return;
        }

        try {
            const transferRes = await bankingApi.transfer({
                recipient: targetUser.email || targetUser.id || recipient.trim(),
                amount: numericAmount,
                category: category,
                note: note || '',
            });

            const dateStr = transferRes.data.date;
            const refId = transferRes.data.ref_id;

            // Also keep recipient localStorage updated for immediate local fallback if on same device
            try {
                const recipientStorageKey = `voxa_banking_${targetUser.id}`;
                const existingRecipientDataRaw = localStorage.getItem(recipientStorageKey);
                const recipientData = existingRecipientDataRaw
                    ? JSON.parse(existingRecipientDataRaw)
                    : getInitialBankingData(targetUser);

                const creditTx = {
                    id: refId,
                    name: `Received from ${user?.full_name || 'Voxa User'} (${user?.email || ''})`,
                    date: dateStr,
                    amount: numericAmount,
                    type: 'credit',
                    category: category,
                    status: 'Completed',
                    ref: refId,
                };

                recipientData.balance = (recipientData.balance || 0) + numericAmount;
                recipientData.transactions = [creditTx, ...(recipientData.transactions || [])];
                localStorage.setItem(recipientStorageKey, JSON.stringify(recipientData));
            } catch {}

            if (onRefreshAccount) {
                await onRefreshAccount();
            } else {
                setBankingData((prev) => ({
                    ...prev,
                    balance: transferRes.data.new_balance,
                    transactions: [
                        {
                            id: refId,
                            name: `Transfer to ${targetUser.full_name} (${targetUser.email})`,
                            date: dateStr,
                            amount: -numericAmount,
                            type: 'debit',
                            category: category,
                            status: 'Completed',
                            ref: refId,
                        },
                        ...prev.transactions,
                    ],
                }));
            }

            setAmount('');
            setRecipient('');
            setNote('');
            setVerifiedUser(null);

            onTransferSuccess({
                refId,
                recipient: `${targetUser.full_name} (${targetUser.email})`,
                amount: numericAmount,
                category,
                date: dateStr,
            });
        } catch (err) {
            const msg = err.response?.data?.detail || 'Transfer failed. Please check recipient and balance.';
            setError(typeof msg === 'string' ? msg : 'Transfer execution failed.');
        } finally {
            setVerifying(false);
        }
    };

    return (
        <div className="dashboard-main-content">
            <div className="tab-header">
                <h1>Money Transfer</h1>
                <p>Send funds securely to verified Voxa users registered in our database.</p>
            </div>

            <div className="transfers-container">
                {/* Source account overview */}
                <div className="transfer-source-box">
                    <div>
                        <div className="source-account-title">Debit From Account</div>
                        <div className="source-account-name">Voxa Savings •••• {bankingData.card?.last4 || '4821'}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div className="source-account-title">Available Balance</div>
                        <div className="source-balance-val">{formatINR(currentBalance)}</div>
                    </div>
                </div>

                {/* Registered Voxa Beneficiaries (From Database) */}
                <div className="beneficiaries-card glass glass-card">
                    <h4>Registered Voxa Users in Database (Click to Select)</h4>
                    {loadingUsers ? (
                        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Loading registered users from database…</p>
                    ) : registeredUsers.length === 0 ? (
                        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                            No other users registered yet. Register a second account to test transfers!
                        </p>
                    ) : (
                        <div className="beneficiaries-row">
                            {registeredUsers.map((u) => {
                                const initials = u.full_name
                                    ? u.full_name.trim().split(/\s+/).map((n) => n[0]).join('').toUpperCase().slice(0, 2)
                                    : 'VU';
                                return (
                                    <button
                                        key={u.id}
                                        type="button"
                                        className="beneficiary-chip"
                                        onClick={() => handleSelectBeneficiary(u)}
                                        title={u.email}
                                    >
                                        <span className="beneficiary-avatar-dot">{initials}</span>
                                        <span>{u.full_name}</span>
                                        <span style={{ fontSize: '0.72rem', opacity: 0.65 }}>({u.email})</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Transfer Form */}
                <div className="transfer-form-card glass glass-card">
                    {error && (
                        <div className="password-alert error" style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>{error}</span>
                            {currentBalance <= 0 && (
                                <button
                                    onClick={onOpenDeposit}
                                    style={{ background: 'none', border: 'none', color: '#4ade80', textDecoration: 'underline', cursor: 'pointer', fontWeight: 600 }}
                                >
                                    Deposit Now
                                </button>
                            )}
                        </div>
                    )}

                    <form onSubmit={handleSubmitTransfer}>
                        <div className="form-field-group">
                            <label className="form-field-label">Recipient Voxa Email or ID (Must exist in Database)</label>
                            <input
                                type="text"
                                className="form-field-input"
                                placeholder="e.g. test@nlp.com"
                                value={recipient}
                                onChange={(e) => setRecipient(e.target.value)}
                                required
                            />

                            {/* Verification Feedback */}
                            {verifying && (
                                <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginTop: '0.35rem' }}>
                                    Checking database records…
                                </p>
                            )}

                            {verifiedUser && (
                                <div className="recipient-verified-box">
                                    <CheckCircle size={16} />
                                    <span>Verified Voxa User: <strong>{verifiedUser.full_name}</strong> ({verifiedUser.email}) ✓</span>
                                </div>
                            )}

                            {verifyError && (
                                <div className="recipient-unverified-box">
                                    <AlertCircle size={16} />
                                    <span>{verifyError}</span>
                                </div>
                            )}
                        </div>

                        <div className="form-field-group">
                            <label className="form-field-label">Transfer Amount (₹ INR)</label>
                            <input
                                type="number"
                                step="1"
                                min="1"
                                className="form-field-input"
                                placeholder="0.00"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                required
                            />
                            <div className="chips-row">
                                {[100, 500, 1000, 2000, 5000].map((amt) => (
                                    <button
                                        key={amt}
                                        type="button"
                                        className="chip-btn"
                                        onClick={() => handleChipAmount(amt)}
                                    >
                                        +₹{amt}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="form-field-group">
                            <label className="form-field-label">Category / Purpose</label>
                            <select
                                className="form-field-input"
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                            >
                                <option value="Peer Transfer">Peer Transfer (P2P)</option>
                                <option value="Rent & Housing">Rent & Housing</option>
                                <option value="Dining & Food">Dining & Food</option>
                                <option value="Services & Work">Services & Work</option>
                                <option value="Gift / Family">Gift / Family</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>

                        <div className="form-field-group">
                            <label className="form-field-label">Note / UPI Ref (Optional)</label>
                            <input
                                type="text"
                                className="form-field-input"
                                placeholder="Add a memo..."
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                maxLength={60}
                            />
                        </div>

                        <button
                            type="submit"
                            className="btn-submit-transfer"
                            disabled={currentBalance <= 0 || Boolean(verifyError)}
                            id="submit-transfer-btn"
                        >
                            <Send size={18} />
                            <span>Send Money Now</span>
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

// ── Statements View ──────────────────────────────────────────────────────────
function StatementsView({ bankingData, onOpenDeposit }) {
    const [filter, setFilter] = useState('all'); // 'all' | 'credit' | 'debit'
    const [searchTerm, setSearchTerm] = useState('');

    const transactions = bankingData.transactions;

    const totalInflow = useMemo(() => {
        return transactions
            .filter((t) => t.type === 'credit')
            .reduce((acc, t) => acc + t.amount, 0);
    }, [transactions]);

    const totalOutflow = useMemo(() => {
        return transactions
            .filter((t) => t.type === 'debit')
            .reduce((acc, t) => acc + Math.abs(t.amount), 0);
    }, [transactions]);

    const netChange = totalInflow - totalOutflow;

    const filteredList = useMemo(() => {
        return transactions.filter((tx) => {
            if (filter !== 'all' && tx.type !== filter) return false;
            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase();
                return (
                    tx.name.toLowerCase().includes(term) ||
                    (tx.category && tx.category.toLowerCase().includes(term)) ||
                    (tx.id && tx.id.toLowerCase().includes(term))
                );
            }
            return true;
        });
    }, [transactions, filter, searchTerm]);

    const handleExportCsv = () => { exportCsvToUser(transactions); return;
    /* original */

        if (transactions.length === 0) {
            alert('No transactions to export.');
            return;
        }

        const headers = ['Transaction ID', 'Date', 'Description', 'Category', 'Type', 'Amount (INR)', 'Status'];
        const rows = transactions.map((t) => [
            t.id,
            t.date,
            `"${t.name.replace(/"/g, '""')}"`,
            t.category || 'General',
            t.type.toUpperCase(),
            t.amount.toFixed(2),
            t.status || 'Completed',
        ]);

        const csvContent =
            'data:text/csv;charset=utf-8,' +
            [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `Voxa_Statement_INR_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="dashboard-main-content">
            <div className="tab-header">
                <h1>Account Statements</h1>
                <p>Full transaction ledger, audit references, and monthly export reports in Indian Rupees (₹).</p>
            </div>

            <div className="statements-container">
                {/* KPI Metrics */}
                <div className="statement-kpis-grid">
                    <div className="statement-kpi-card glass glass-card">
                        <span className="statement-kpi-title">Total Inflow</span>
                        <span className="statement-kpi-value green">+{formatINR(totalInflow)}</span>
                    </div>
                    <div className="statement-kpi-card glass glass-card">
                        <span className="statement-kpi-title">Total Outflow</span>
                        <span className="statement-kpi-value red">-{formatINR(totalOutflow)}</span>
                    </div>
                    <div className="statement-kpi-card glass glass-card">
                        <span className="statement-kpi-title">Net Cash Flow</span>
                        <span className={`statement-kpi-value ${netChange >= 0 ? 'green' : 'red'}`}>
                            {netChange >= 0 ? '+' : '-'}{formatINR(Math.abs(netChange))}
                        </span>
                    </div>
                    <div className="statement-kpi-card glass glass-card">
                        <span className="statement-kpi-title">Total Transactions</span>
                        <span className="statement-kpi-value">{transactions.length}</span>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="statement-toolbar">
                    <div className="statement-filters">
                        <button
                            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                            onClick={() => setFilter('all')}
                        >
                            All Transactions
                        </button>
                        <button
                            className={`filter-btn ${filter === 'credit' ? 'active' : ''}`}
                            onClick={() => setFilter('credit')}
                        >
                            Credits (+)
                        </button>
                        <button
                            className={`filter-btn ${filter === 'debit' ? 'active' : ''}`}
                            onClick={() => setFilter('debit')}
                        >
                            Debits (-)
                        </button>
                    </div>

                    <div className="statement-export-actions">
                        <button className="btn-export" onClick={handleExportCsv} id="export-statement-btn">
                            <Download size={16} /> Export CSV
                        </button>
                        <button className="btn-export" onClick={handlePrint}>
                            <Printer size={16} /> Print
                        </button>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="statement-search-box">
                    <Search size={16} className="statement-search-icon" />
                    <input
                        type="text"
                        className="statement-search-input"
                        placeholder="Search description, reference ID, category..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Statements Table */}
                <div className="statement-table-card glass glass-card">
                    {filteredList.length === 0 ? (
                        <div className="empty-state-card">
                            <div className="empty-state-icon">
                                <FileText size={28} />
                            </div>
                            <h4>No matching statement records</h4>
                            <p>
                                {transactions.length === 0
                                    ? 'Your account has 0 transactions recorded so far.'
                                    : 'No transactions match the selected filter.'}
                            </p>
                            {transactions.length === 0 && (
                                <button className="btn-deposit-primary" onClick={onOpenDeposit} style={{ marginTop: '0.5rem' }}>
                                    <PlusCircle size={16} /> Make a Deposit
                                </button>
                            )}
                        </div>
                    ) : (
                        <table className="statement-table">
                            <thead>
                                <tr>
                                    <th>Date & Time</th>
                                    <th>Description</th>
                                    <th>Reference ID</th>
                                    <th>Category</th>
                                    <th>Status</th>
                                    <th style={{ textAlign: 'right' }}>Amount (INR)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredList.map((tx) => (
                                    <tr key={tx.id}>
                                        <td style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{tx.date}</td>
                                        <td style={{ fontWeight: 600 }}>{tx.name}</td>
                                        <td style={{ fontFamily: 'monospace', color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>
                                            {tx.id}
                                        </td>
                                        <td>
                                            <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                                                {tx.category || 'General'}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="status-pill completed">Completed</span>
                                        </td>
                                        <td
                                            style={{
                                                textAlign: 'right',
                                                fontWeight: 700,
                                                color: tx.type === 'credit' ? '#4ade80' : '#f87171',
                                            }}
                                        >
                                            {tx.amount > 0 ? '+' : '-'}{formatINR(Math.abs(tx.amount))}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Settings View ────────────────────────────────────────────────────────────
function SettingsView({ user, bankingData, setBankingData }) {
    // Password state
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [showCurr, setShowCurr] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConf, setShowConf] = useState(false);
    const [pwLoading, setPwLoading] = useState(false);
    const [pwAlert, setPwAlert] = useState(null);

    const [copiedField, setCopiedField] = useState('');

    const handleCopy = (field, text) => {
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(''), 2000);
    };

    const handleTogglePref = (key) => {
        setBankingData((prev) => ({
            ...prev,
            preferences: {
                ...prev.preferences,
                [key]: !prev.preferences?.[key],
            },
        }));
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setPwAlert(null);

        if (!currentPassword) {
            setPwAlert({ type: 'error', message: 'Please enter your current password.' });
            return;
        }

        if (newPassword.length < 8) {
            setPwAlert({ type: 'error', message: 'New password must be at least 8 characters long.' });
            return;
        }

        if (newPassword !== confirmNewPassword) {
            setPwAlert({ type: 'error', message: 'New passwords do not match.' });
            return;
        }

        setPwLoading(true);
        try {
            const res = await authApi.changePassword({
                current_password: currentPassword,
                new_password: newPassword,
                confirm_new_password: confirmNewPassword,
            });
            setPwAlert({ type: 'success', message: res.data.message || 'Password changed successfully!' });
            setCurrentPassword('');
            setNewPassword('');
            setConfirmNewPassword('');
        } catch (err) {
            const msg = err.response?.data?.detail || 'Failed to change password. Please check your current password.';
            setPwAlert({ type: 'error', message: typeof msg === 'string' ? msg : JSON.stringify(msg) });
        } finally {
            setPwLoading(false);
        }
    };

    const memberSince = user?.created_at
        ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        : 'October 2026';

    return (
        <div className="dashboard-main-content">
            <div className="tab-header">
                <h1>Account Settings</h1>
                <p>Manage your account profile, security credentials, and banking preferences.</p>
            </div>

            <div className="settings-container">
                {/* Full Account Information */}
                <div className="settings-card glass glass-card">
                    <h3>Account Profile & Banking Details</h3>
                    <p className="settings-card-desc">Your verified account identifiers for domestic IMPS, NEFT, and RTGS transfers.</p>

                    <div className="account-info-grid">
                        <div className="info-item">
                            <span className="info-item-label">Account Holder</span>
                            <span className="info-item-value">{user?.full_name || 'Pasumarthy Abhinav'}</span>
                        </div>
                        <div className="info-item">
                            <span className="info-item-label">Registered Email</span>
                            <span className="info-item-value">{user?.email || 'user@voxa.com'}</span>
                        </div>
                        <div className="info-item">
                            <span className="info-item-label">Account Number</span>
                            <span className="info-item-value">
                                {bankingData.accountNumber}
                                <button
                                    className="btn-copy-sm"
                                    onClick={() => handleCopy('acc', bankingData.accountNumber)}
                                    title="Copy Account Number"
                                >
                                    {copiedField === 'acc' ? <Check size={14} color="#4ade80" /> : <Copy size={14} />}
                                </button>
                            </span>
                        </div>
                        <div className="info-item">
                            <span className="info-item-label">IFSC Code</span>
                            <span className="info-item-value">
                                {bankingData.ifscCode}
                                <button
                                    className="btn-copy-sm"
                                    onClick={() => handleCopy('ifsc', bankingData.ifscCode)}
                                    title="Copy IFSC Code"
                                >
                                    {copiedField === 'ifsc' ? <Check size={14} color="#4ade80" /> : <Copy size={14} />}
                                </button>
                            </span>
                        </div>
                        <div className="info-item">
                            <span className="info-item-label">Account Type</span>
                            <span className="info-item-value">Voxa Savings (Premier Tier)</span>
                        </div>
                        <div className="info-item">
                            <span className="info-item-label">KYC Verification</span>
                            <span className="info-item-value" style={{ color: '#4ade80' }}>
                                Verified & Active ✓
                            </span>
                        </div>
                        <div className="info-item">
                            <span className="info-item-label">Member Since</span>
                            <span className="info-item-value">{memberSince}</span>
                        </div>
                        <div className="info-item">
                            <span className="info-item-label">Operating Currency</span>
                            <span className="info-item-value">INR (₹) Indian Rupee</span>
                        </div>
                    </div>
                </div>

                {/* Change Password Form */}
                <div className="settings-card glass glass-card">
                    <h3>Change Password</h3>
                    <p className="settings-card-desc">Update your password to keep your banking credentials secure.</p>

                    {pwAlert && (
                        <div className={`password-alert ${pwAlert.type}`} style={{ marginBottom: '1.25rem' }}>
                            {pwAlert.message}
                        </div>
                    )}

                    <form onSubmit={handleChangePassword} className="password-form">
                        <div className="form-field-group">
                            <label className="form-field-label">Current Password</label>
                            <div className="password-input-wrapper">
                                <input
                                    type={showCurr ? 'text' : 'password'}
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    placeholder="Enter current password"
                                    required
                                />
                                <button
                                    type="button"
                                    className="password-eye-btn"
                                    onClick={() => setShowCurr(!showCurr)}
                                >
                                    {showCurr ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <div className="form-field-group">
                            <label className="form-field-label">New Password</label>
                            <div className="password-input-wrapper">
                                <input
                                    type={showNew ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Min 8 chars with uppercase & symbol"
                                    required
                                />
                                <button
                                    type="button"
                                    className="password-eye-btn"
                                    onClick={() => setShowNew(!showNew)}
                                >
                                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <div className="form-field-group">
                            <label className="form-field-label">Confirm New Password</label>
                            <div className="password-input-wrapper">
                                <input
                                    type={showConf ? 'text' : 'password'}
                                    value={confirmNewPassword}
                                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                                    placeholder="Re-enter new password"
                                    required
                                />
                                <button
                                    type="button"
                                    className="password-eye-btn"
                                    onClick={() => setShowConf(!showConf)}
                                >
                                    {showConf ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="btn-save-settings"
                            disabled={pwLoading}
                            id="change-password-submit-btn"
                        >
                            {pwLoading ? 'Updating…' : 'Update Password'}
                        </button>
                    </form>
                </div>

                {/* Preferences */}
                <div className="settings-card glass glass-card">
                    <h3>Notifications & Security Preferences</h3>
                    <div className="toggles-list" style={{ borderTop: 'none', paddingTop: 0 }}>
                        <div className="toggle-row">
                            <div className="toggle-info">
                                <h5>Instant Email Alerts</h5>
                                <p>Receive immediate security emails for every deposit and withdrawal</p>
                            </div>
                            <label className="switch">
                                <input
                                    type="checkbox"
                                    checked={bankingData.preferences?.emailAlerts ?? true}
                                    onChange={() => handleTogglePref('emailAlerts')}
                                />
                                <span className="switch-slider" />
                            </label>
                        </div>
                        <div className="toggle-row">
                            <div className="toggle-info">
                                <h5>Two-Factor Authentication (2FA)</h5>
                                <p>Prompt for OTP / authenticator code on new device sign-ins</p>
                            </div>
                            <label className="switch">
                                <input
                                    type="checkbox"
                                    checked={bankingData.preferences?.twoFactor ?? true}
                                    onChange={() => handleTogglePref('twoFactor')}
                                />
                                <span className="switch-slider" />
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Modals: Deposit Funds (₹ INR) ────────────────────────────────────────────
function DepositModal({ isOpen, onClose, onDepositSuccess }) {
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState('UPI / NetBanking');

    if (!isOpen) return null;

    const handleConfirm = (e) => {
        e.preventDefault();
        const num = parseFloat(amount);
        if (isNaN(num) || num <= 0) {
            alert('Please enter a valid deposit amount.');
            return;
        }

        onDepositSuccess(num, method);
        setAmount('');
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div>
                        <h3>Deposit Funds</h3>
                        <p>Add money to your Voxa account in Indian Rupees (₹) instantly.</p>
                    </div>
                    <button className="modal-close-btn" onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleConfirm} className="modal-body">
                    <div className="amount-input-box">
                        <span className="amount-currency-symbol">₹</span>
                        <input
                            type="number"
                            step="1"
                            min="1"
                            className="amount-large-input"
                            placeholder="0"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            autoFocus
                            required
                        />
                    </div>

                    <div className="quick-amount-chips">
                        {[500, 1000, 2000, 5000, 10000].map((chip) => (
                            <button
                                key={chip}
                                type="button"
                                className="quick-chip"
                                onClick={() => setAmount(String(chip))}
                            >
                                +₹{chip}
                            </button>
                        ))}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Payment Method</span>

                        <div
                            className={`deposit-method-card ${method === 'UPI / NetBanking' ? 'selected' : ''}`}
                            onClick={() => setMethod('UPI / NetBanking')}
                        >
                            <Zap size={20} color="var(--color-primary)" />
                            <div>
                                <div style={{ fontSize: '0.92rem', fontWeight: 600 }}>UPI (GPay / PhonePe / Paytm)</div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>Instant • 0% convenience fee</div>
                            </div>
                        </div>

                        <div
                            className={`deposit-method-card ${method === 'IMPS / NEFT' ? 'selected' : ''}`}
                            onClick={() => setMethod('IMPS / NEFT')}
                        >
                            <CreditCard size={20} color="var(--color-primary)" />
                            <div>
                                <div style={{ fontSize: '0.92rem', fontWeight: 600 }}>NetBanking / IMPS / NEFT</div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>Direct Bank Transfer • Instant</div>
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn-submit-transfer"
                        style={{ marginTop: '1rem' }}
                        id="confirm-deposit-btn"
                    >
                        Confirm Deposit
                    </button>
                </form>
            </div>
        </div>
    );
}

// ── Modals: Pay Bills (₹ INR) ────────────────────────────────────────────────
function PayBillsModal({ isOpen, onClose, balance, onPaySuccess }) {
    const [biller, setBiller] = useState('Electric & Gas — Metro Clean Energy');
    const [accountNumber, setAccountNumber] = useState('');
    const [amount, setAmount] = useState('');
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handlePay = (e) => {
        e.preventDefault();
        setError('');

        const num = parseFloat(amount);
        if (isNaN(num) || num <= 0) {
            setError('Please enter a valid bill amount.');
            return;
        }

        if (num > balance) {
            setError(`Insufficient balance (${formatINR(balance)}). Please deposit funds first.`);
            return;
        }

        onPaySuccess(num, biller);
        setAmount('');
        setAccountNumber('');
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div>
                        <h3>Pay Utilities & Bills</h3>
                        <p>Pay verified electricity, broadband, mobile, and rent bills in ₹.</p>
                    </div>
                    <button className="modal-close-btn" onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handlePay} className="modal-body">
                    {error && (
                        <div className="password-alert error">{error}</div>
                    )}

                    <div className="form-field-group">
                        <label className="form-field-label">Select Utility / Biller</label>
                        <select
                            className="form-field-input"
                            value={biller}
                            onChange={(e) => setBiller(e.target.value)}
                        >
                            <option value="Electric & Gas — Metro Clean Energy">Electric & Gas — Metro Clean Energy</option>
                            <option value="Broadband — Apex High-Speed Fiber">Broadband — Apex High-Speed Fiber</option>
                            <option value="Mobile — Wireless Postpaid">Mobile — Wireless Postpaid</option>
                            <option value="Rent & Property — City Housing LLC">Rent & Property — City Housing LLC</option>
                            <option value="Electricity — State Electricity Board">Electricity — State Electricity Board</option>
                        </select>
                    </div>

                    <div className="form-field-group">
                        <label className="form-field-label">Consumer / Bill Account #</label>
                        <input
                            type="text"
                            className="form-field-input"
                            placeholder="e.g. 9812-441-290"
                            value={accountNumber}
                            onChange={(e) => setAccountNumber(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-field-group">
                        <label className="form-field-label">Bill Amount (₹ INR)</label>
                        <input
                            type="number"
                            step="1"
                            min="1"
                            className="form-field-input"
                            placeholder="0"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            required
                        />
                        <div className="chips-row">
                            {[250, 500, 1000, 2500].map((chip) => (
                                <button
                                    key={chip}
                                    type="button"
                                    className="chip-btn"
                                    onClick={() => setAmount(String(chip))}
                                >
                                    ₹{chip}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button type="submit" className="btn-submit-transfer" style={{ marginTop: '0.75rem' }}>
                        Pay Bill Now
                    </button>
                </form>
            </div>
        </div>
    );
}

// ── Modals: Transfer Receipt (₹ INR) ─────────────────────────────────────────
function TransferReceiptModal({ receipt, onClose }) {
    if (!receipt) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                <div className="receipt-icon-success">
                    <CheckCircle size={36} />
                </div>

                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.3rem' }}>Transfer Successful!</h3>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.92rem' }}>
                        Funds have been dispatched instantly to the verified Voxa user.
                    </p>
                </div>

                <div className="receipt-details-list">
                    <div className="receipt-row">
                        <span>Amount Transferred</span>
                        <strong style={{ color: '#4ade80', fontSize: '1.15rem' }}>
                            {formatINR(receipt.amount)} INR
                        </strong>
                    </div>
                    <div className="receipt-row">
                        <span>Verified Recipient</span>
                        <strong>{receipt.recipient}</strong>
                    </div>
                    <div className="receipt-row">
                        <span>Category</span>
                        <strong>{receipt.category}</strong>
                    </div>
                    <div className="receipt-row">
                        <span>Transaction Reference</span>
                        <strong style={{ fontFamily: 'monospace' }}>{receipt.refId}</strong>
                    </div>
                    <div className="receipt-row">
                        <span>Date & Time</span>
                        <strong>{receipt.date}</strong>
                    </div>
                    <div className="receipt-row">
                        <span>Status</span>
                        <span className="status-pill completed">Completed</span>
                    </div>
                </div>

                <button
                    className="btn-submit-transfer"
                    style={{ marginTop: '1.5rem' }}
                    onClick={onClose}
                >
                    Done
                </button>
            </div>
        </div>
    );
}

// ── Assistant Panel (Voice / Queries) ────────────────────────────────────────
function AssistantPanel({
    user,
    bankingData,
    setBankingData,
    isMasked,
    setIsMasked,
    onVoiceTransferConfirm,
    setTransferReceipt,
    onNavigateTab,
    voiceAssistantRef,
    onRefreshAccount,
}) {
    const [isTyping, setIsTyping] = useState(false);
    const [query, setQuery] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [ttsEnabled, setTtsEnabled] = useState(true);
    const [interimTranscript, setInterimTranscript] = useState('');
    const [messages, setMessages] = useState([
        {
            id: 1,
            sender: 'bot',
            text: 'Hello! I am your VoxaBank AI Voice Assistant. Speak or type to transfer money, check balances, freeze cards, or export statements.',
            time: 'Just now',
        },
    ]);

    const recognitionRef = useRef(null);
    const silenceTimerRef = useRef(null);
    const accumulatedTranscriptRef = useRef('');
    const isListeningRef = useRef(false);
    const handleSendQueryRef = useRef(null);
    const [voiceError, setVoiceError] = useState('');
    const [voiceLang, setVoiceLang] = useState('en-IN');
    const voiceLangRef = useRef('en-IN');
    useEffect(() => {
        voiceLangRef.current = voiceLang;
    }, [voiceLang]);

    // Speak helper using Web Speech API
    const speakText = useCallback(
        (text) => {
            if (!ttsEnabled || !('speechSynthesis' in window)) return;
            try {
                window.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.rate = 1.0;
                utterance.pitch = 1.0;

                const voices = window.speechSynthesis.getVoices();
                const preferred =
                    voices.find((v) => v.lang.includes('en-IN') || v.name.includes('India')) ||
                    voices.find((v) => v.lang.startsWith('en'));
                if (preferred) utterance.voice = preferred;

                utterance.onstart = () => setIsSpeaking(true);
                utterance.onend = () => setIsSpeaking(false);
                utterance.onerror = () => setIsSpeaking(false);

                window.speechSynthesis.speak(utterance);
            } catch (e) {
                console.error('TTS error:', e);
                setIsSpeaking(false);
            }
        },
        [ttsEnabled]
    );

    // Main query processor
    const handleSendQuery = useCallback(
        async (rawText) => {
            const text = (rawText || query).trim();
            if (!text) return;

            setQuery('');
            setInterimTranscript('');
            setIsProcessing(true);

            const now = new Date();
            const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            const userMsg = {
                id: Date.now(),
                sender: 'user',
                text,
                time: timeStr,
            };
            setMessages((prev) => [...prev, userMsg]);

            try {
                const sessionId = user?.id || 'voxa_guest_session';
                const totalInflow = bankingData.transactions
                    ? bankingData.transactions.filter((tx) => tx.type === 'credit').reduce((s, tx) => s + tx.amount, 0)
                    : 0;
                const totalOutflow = bankingData.transactions
                    ? bankingData.transactions.filter((tx) => tx.type === 'debit').reduce((s, tx) => s + Math.abs(tx.amount), 0)
                    : 0;

                const res = await voiceApi.chat({
                    query: text,
                    session_id: sessionId,
                    current_balance: Number(bankingData.balance),
                    user_name: user?.full_name || 'Member',
                    user_email: user?.email,
                    account_number: bankingData.accountNumber,
                    card: bankingData.card,
                    preferences: bankingData.preferences,
                    transactions: bankingData.transactions,
                    inflow: totalInflow,
                    outflow: totalOutflow,
                });
                const data = res.data;

                const botMsg = {
                    id: Date.now() + 1,
                    sender: 'bot',
                    text: data.bot_response,
                    status: data.status,
                    intent: data.intent,
                    subIntent: data.sub_intent,
                    actionPayload: data.action_payload,
                    time: timeStr,
                };
                setMessages((prev) => [...prev, botMsg]);

                speakText(data.bot_response);

                // 1. Privacy Toggle Sync
                if (data.intent === 'account_overview' && data.sub_intent === 'privacy_toggle') {
                    setIsMasked((prev) => !prev);
                } else if (data.action_payload?.action === 'TOGGLE_PRIVACY') {
                    setIsMasked(Boolean(data.action_payload.is_masked));
                }

                // 2. Transfer & Bill Payment Confirmation / Execution Sync
                if (data.status === 'confirm' && (
                    data.action_payload?.action === 'TRANSFER_CONFIRMATION' ||
                    data.action_payload?.action === 'BILL_CONFIRMATION' ||
                    data.action_payload?.action === 'DEPOSIT_CONFIRMATION'
                )) {
                    onVoiceTransferConfirm(data.action_payload);
                } else if (data.status === 'ok' && data.action_payload?.action === 'TRANSFER_SUCCESS') {
                    const amt = parseFloat(data.action_payload.amount);
                    const recipient = data.action_payload.recipient || 'Beneficiary';
                    const recipientTarget = data.action_payload.recipient_id || data.action_payload.recipient_email || recipient;
                    const cat = data.action_payload.category || 'Peer Transfer';
                    const refId = `TXN-VOX-${Date.now().toString(36).toUpperCase()}`;

                    // Execute transfer against backend database so recipient ledger is credited in Supabase
                    try {
                        const transferRes = await bankingApi.transfer({
                            recipient: recipientTarget,
                            amount: amt,
                            category: cat,
                        });

                        const actualRefId = transferRes.data.ref_id || refId;
                        const actualDate = transferRes.data.date || `Today, ${timeStr}`;

                        if (onRefreshAccount) {
                            await onRefreshAccount();
                        } else {
                            setBankingData((prev) => ({
                                ...prev,
                                balance: transferRes.data.new_balance,
                                transactions: [
                                    {
                                        id: actualRefId,
                                        name: `Transfer to ${transferRes.data.recipient || recipient}`,
                                        date: actualDate,
                                        amount: -amt,
                                        type: 'debit',
                                        category: cat,
                                        status: 'Completed',
                                        ref: actualRefId,
                                    },
                                    ...prev.transactions,
                                ],
                            }));
                        }

                        setTransferReceipt({
                            id: actualRefId,
                            recipient: transferRes.data.recipient || recipient,
                            amount: amt,
                            date: actualDate,
                            category: cat,
                            type: 'debit',
                        });
                    } catch (transferErr) {
                        console.error('Voice transfer backend sync error:', transferErr);
                        const newTx = {
                            id: refId,
                            name: `Transfer to ${recipient}`,
                            date: `Today, ${timeStr}`,
                            amount: -amt,
                            type: 'debit',
                            category: cat,
                            status: 'Completed',
                            ref: refId,
                        };

                        setBankingData((prev) => ({
                            ...prev,
                            balance: Math.max(0, prev.balance - amt),
                            transactions: [newTx, ...prev.transactions],
                        }));

                        setTransferReceipt({
                            id: refId,
                            recipient,
                            amount: amt,
                            date: `Today, ${timeStr}`,
                            category: cat,
                            type: 'debit',
                        });
                    }
                } else if (data.status === 'ok' && data.action_payload?.action === 'BILL_SUCCESS') {
                    const amt = parseFloat(data.action_payload.amount);
                    const biller = data.action_payload.biller || 'Electricity & Gas';
                    const refId = `TXN-BILL-${Date.now().toString(36).toUpperCase()}`;

                    // Execute bill payment against backend database so user ledger is deducted in Supabase
                    try {
                        const billRes = await bankingApi.billPay({
                            biller,
                            amount: amt,
                        });

                        const actualRefId = billRes.data?.ref_id || refId;
                        const actualDate = billRes.data?.date || `Today, ${timeStr}`;

                        if (onRefreshAccount) {
                            await onRefreshAccount();
                        } else {
                            setBankingData((prev) => ({
                                ...prev,
                                balance: billRes.data?.new_balance ?? Math.max(0, prev.balance - amt),
                                transactions: [
                                    {
                                        id: actualRefId,
                                        name: `Bill Payment — ${biller}`,
                                        date: actualDate,
                                        amount: -amt,
                                        type: 'debit',
                                        category: 'Utilities',
                                        status: 'Completed',
                                        ref: actualRefId,
                                    },
                                    ...prev.transactions,
                                ],
                            }));
                        }
                    } catch (billErr) {
                        console.error('Voice bill payment backend sync error:', billErr);
                        const newTx = {
                            id: refId,
                            name: `Bill Payment — ${biller}`,
                            date: `Today, ${timeStr}`,
                            amount: -amt,
                            type: 'debit',
                            category: 'Utilities',
                            status: 'Completed',
                            ref: refId,
                        };

                        setBankingData((prev) => ({
                            ...prev,
                            balance: Math.max(0, prev.balance - amt),
                            transactions: [newTx, ...prev.transactions],
                        }));
                    }
                }

                // 3b. Security & Notification Preferences Sync (2FA & Email Alerts)
                if (data.action_payload?.action === 'TOGGLE_PREFERENCE') {
                    const { two_factor, email_alerts, has_2fa, has_email } = data.action_payload;
                    setBankingData((prev) => {
                        const newPrefs = { ...(prev.preferences || {}) };
                        if (has_2fa && two_factor !== undefined) {
                            newPrefs.twoFactor = Boolean(two_factor);
                        }
                        if (has_email && email_alerts !== undefined) {
                            newPrefs.emailAlerts = Boolean(email_alerts);
                        }
                        return {
                            ...prev,
                            preferences: newPrefs,
                        };
                    });
                }

                // 3. Card Management Sync
                if (data.action_payload?.action === 'FREEZE_CARD') {
                    setBankingData((prev) => ({
                        ...prev,
                        card: { ...prev.card, frozen: true },
                    }));
                } else if (data.action_payload?.action === 'UNFREEZE_CARD') {
                    setBankingData((prev) => ({
                        ...prev,
                        card: { ...prev.card, frozen: false },
                    }));
                } else if (data.action_payload?.action === 'TOGGLE_CARD_CHANNEL') {
                    const channelKey = data.action_payload.channel; // 'international', 'domestic', 'online', 'atm'
                    const isEnabled = Boolean(data.action_payload.enabled);
                    setBankingData((prev) => ({
                        ...prev,
                        card: {
                            ...prev.card,
                            [channelKey]: isEnabled,
                        },
                    }));
                } else if (data.action_payload?.action === 'SET_CARD_LIMIT') {
                    const limKey = data.action_payload.limit_type === 'per_txn' ? 'perTxLimit' : 'dailyLimit';
                    const val = Number(data.action_payload.amount);
                    if (!isNaN(val) && val > 0) {
                        setBankingData((prev) => ({
                            ...prev,
                            card: {
                                ...prev.card,
                                [limKey]: val,
                            },
                        }));
                    }
                }

                // 4. Statements CSV Export Sync
                if (data.sub_intent === 'export_csv' || data.action_payload?.action === 'EXPORT_CSV') {
                    exportCsvToUser(bankingData.transactions);
                } else if (data.sub_intent === 'print_statement' || data.action_payload?.action === 'PRINT_STATEMENT') {
                    window.print();
                }

                // 5. Deposit Sync
                if (data.status === 'ok' && data.action_payload?.action === 'DEPOSIT_SUCCESS') {
                    const amt = parseFloat(data.action_payload.amount);
                    const method = data.action_payload.method || 'UPI';
                    const refId = `TXN-DEP-${Date.now().toString(36).toUpperCase()}`;

                    const newTx = {
                        id: refId,
                        name: `Deposit via ${method}`,
                        date: `Today, ${timeStr}`,
                        amount: amt,
                        type: 'credit',
                        category: 'Deposit',
                        status: 'Completed',
                    };

                    setBankingData((prev) => ({
                        ...prev,
                        balance: prev.balance + amt,
                        transactions: [newTx, ...prev.transactions],
                    }));
                }
            } catch (err) {
                console.error('Voice assistant request error:', err);
                const errDetail =
                    err.response?.data?.detail ||
                    'Voice assistant could not connect to server. Ensure FastAPI is running on port 8000.';
                setMessages((prev) => [
                    ...prev,
                    { id: Date.now() + 1, sender: 'bot', text: errDetail, isError: true, time: timeStr },
                ]);
                speakText('Sorry, I encountered an error communicating with the banking server.');
            } finally {
                setIsProcessing(false);
            }
        },
        [query, user, bankingData.balance, bankingData.transactions, speakText, setIsMasked, onVoiceTransferConfirm, setBankingData, setTransferReceipt]
    );

    // Keep handleSendQueryRef always pointing to latest handler
    useEffect(() => {
        handleSendQueryRef.current = handleSendQuery;
    });

    const handleStopListening = useCallback((queryToSend = null) => {
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }
        isListeningRef.current = false;
        setIsListening(false);

        const pending = (queryToSend !== null ? queryToSend : (accumulatedTranscriptRef.current || interimTranscript)).trim();
        setInterimTranscript('');
        accumulatedTranscriptRef.current = '';

        if (recognitionRef.current) {
            try {
                recognitionRef.current.onend = null;
                recognitionRef.current.onerror = null;
                recognitionRef.current.abort();
            } catch {}
            recognitionRef.current = null;
        }

        if (pending && handleSendQueryRef.current) {
            handleSendQueryRef.current(pending);
        }
    }, [interimTranscript]);

    const initiateRecognitionSession = useCallback(() => {
        if (!isListeningRef.current) return;

        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRec) {
            setVoiceError('Speech Recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
            isListeningRef.current = false;
            setIsListening(false);
            return;
        }

        // Clean up previous instance cleanly
        if (recognitionRef.current) {
            try {
                recognitionRef.current.onend = null;
                recognitionRef.current.onerror = null;
                recognitionRef.current.abort();
            } catch {}
            recognitionRef.current = null;
        }

        try {
            const rec = new SpeechRec();
            rec.continuous = true;
            rec.interimResults = true;
            rec.maxAlternatives = 1;
            rec.lang = voiceLangRef.current || 'en-IN';

            rec.onstart = () => {
                if (isListeningRef.current) {
                    setIsListening(true);
                    setVoiceError('');
                }
            };

            rec.onresult = (e) => {
                let newlyFinal = '';
                let currentInterim = '';

                for (let i = e.resultIndex; i < e.results.length; i++) {
                    const transcript = e.results[i][0].transcript;
                    if (e.results[i].isFinal) {
                        newlyFinal += (newlyFinal ? ' ' : '') + transcript;
                    } else {
                        currentInterim += (currentInterim ? ' ' : '') + transcript;
                    }
                }

                if (newlyFinal) {
                    accumulatedTranscriptRef.current = (accumulatedTranscriptRef.current + ' ' + newlyFinal).trim();
                }

                const currentFullText = (accumulatedTranscriptRef.current + ' ' + currentInterim).trim();
                if (currentFullText) {
                    setInterimTranscript(currentFullText);
                }

                // Reset silence timer on every speech packet
                if (silenceTimerRef.current) {
                    clearTimeout(silenceTimerRef.current);
                    silenceTimerRef.current = null;
                }

                // Auto-submit after 2.8 seconds of natural silence after speaking
                if (currentFullText) {
                    silenceTimerRef.current = setTimeout(() => {
                        const finalQuery = (accumulatedTranscriptRef.current + ' ' + currentInterim).trim();
                        if (finalQuery && isListeningRef.current) {
                            handleStopListening(finalQuery);
                        }
                    }, 2800);
                }
            };

            rec.onerror = (e) => {
                // Non-fatal: 'no-speech' is expected when user is quiet
                if (e.error === 'no-speech') {
                    return;
                }
                if (e.error === 'aborted') {
                    return;
                }
                console.warn('Speech recognition warning/error:', e.error);

                if (e.error === 'not-allowed') {
                    setVoiceError('Microphone blocked. Click the lock/tune icon 🔒 in the browser address bar to allow microphone access.');
                    isListeningRef.current = false;
                    setIsListening(false);
                } else if (e.error === 'network') {
                    setVoiceError('Speech service connection issue. Please check your internet connection or type your query below.');
                    isListeningRef.current = false;
                    setIsListening(false);
                } else if (e.error === 'audio-capture') {
                    setVoiceError('No microphone detected. Please connect a microphone or headset.');
                    isListeningRef.current = false;
                    setIsListening(false);
                }
            };

            rec.onend = () => {
                if (isListeningRef.current) {
                    const pendingQuery = (accumulatedTranscriptRef.current || interimTranscript).trim();
                    if (pendingQuery && !silenceTimerRef.current) {
                        handleStopListening(pendingQuery);
                    } else if (!pendingQuery) {
                        // User was quiet or Chrome timed out its window; restart a fresh instance cleanly!
                        setTimeout(() => {
                            if (isListeningRef.current) {
                                initiateRecognitionSession();
                            }
                        }, 120);
                    }
                } else {
                    setIsListening(false);
                }
            };

            recognitionRef.current = rec;
            rec.start();
        } catch (err) {
            console.error('Failed to start speech recognition session:', err);
            setVoiceError('Unable to start speech recognition. Please check your microphone or type your query.');
            isListeningRef.current = false;
            setIsListening(false);
        }
    }, [handleStopListening, interimTranscript]);

    const handleStartListening = useCallback(() => {
        setVoiceError('');
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
        }
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }
        accumulatedTranscriptRef.current = '';
        setInterimTranscript('');

        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRec) {
            setVoiceError('Speech Recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
            return;
        }

        isListeningRef.current = true;
        setIsListening(true);
        initiateRecognitionSession();
    }, [initiateRecognitionSession]);

    const handleSpeakToggle = () => {
        if (isListening) {
            handleStopListening();
        } else {
            handleStartListening();
        }
    };

    // Clean up recognition strictly on component unmount
    useEffect(() => {
        return () => {
            if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
            }
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.abort();
                } catch {}
            }
        };
    }, []);

    // Expose methods to parent ref
    useEffect(() => {
        if (voiceAssistantRef) {
            voiceAssistantRef.current = {
                sendQuery: handleSendQuery,
                startListening: handleStartListening,
                stopListening: handleStopListening,
                toggleListening: handleSpeakToggle,
                isListening,
            };
        }
    });

    const handleResetSession = async () => {
        try {
            const sessionId = user?.id || 'voxa_guest_session';
            await voiceApi.resetSession(sessionId);
        } catch {}
        setMessages([
            {
                id: Date.now(),
                sender: 'bot',
                text: 'Dialogue state reset. How can I help you today?',
                time: 'Just now',
            },
        ]);
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
        }
    };

    return (
        <aside className="assistant-panel">
            <div className="dashboard-card glass glass-card">
                <LeafLogo size={48} />
                <h2 className="dashboard-brand">Voxa Bank AI</h2>

                {/* Big Mic Button with Active Pulse Animation */}
                <button
                    className={`dashboard-speak-btn ${isListening ? 'active-pulse' : ''}`}
                    onClick={handleSpeakToggle}
                    title={isListening ? 'Click to stop listening' : 'Click to speak to VoxaBank AI'}
                    id="dashboard-voice-mic-btn"
                >
                    <Mic size={36} />
                    <span>{isListening ? 'Listening...' : isProcessing ? 'Thinking...' : isSpeaking ? 'Speaking...' : 'Speak Now'}</span>
                </button>

                {/* Dialect Switcher Pill */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', margin: '0.35rem 0' }}>
                    <button
                        type="button"
                        className="glass-pill"
                        style={{
                            fontSize: '0.7rem',
                            padding: '0.2rem 0.55rem',
                            border: voiceLang === 'en-IN' ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.12)',
                            background: voiceLang === 'en-IN' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                            color: voiceLang === 'en-IN' ? '#34d399' : 'rgba(255,255,255,0.6)',
                            cursor: 'pointer',
                        }}
                        onClick={() => setVoiceLang('en-IN')}
                        title="Indian English (optimized for INR ₹, Indian names and accent)"
                    >
                        🇮🇳 English (IN)
                    </button>
                    <button
                        type="button"
                        className="glass-pill"
                        style={{
                            fontSize: '0.7rem',
                            padding: '0.2rem 0.55rem',
                            border: voiceLang === 'en-US' ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.12)',
                            background: voiceLang === 'en-US' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                            color: voiceLang === 'en-US' ? '#34d399' : 'rgba(255,255,255,0.6)',
                            cursor: 'pointer',
                        }}
                        onClick={() => setVoiceLang('en-US')}
                        title="US English"
                    >
                        🇺🇸 English (US)
                    </button>
                </div>

                {/* Done Speaking Quick Submit Button */}
                {isListening && (
                    <button
                        type="button"
                        className="glass-pill"
                        style={{
                            marginTop: '0.3rem',
                            fontSize: '0.78rem',
                            padding: '0.35rem 0.85rem',
                            color: 'var(--color-primary)',
                            background: 'rgba(74, 222, 128, 0.12)',
                            border: '1px solid rgba(74, 222, 128, 0.3)',
                            cursor: 'pointer',
                        }}
                        onClick={() => handleStopListening()}
                    >
                        ✓ Done Speaking — Submit
                    </button>
                )}

                {/* Listening Prompt Hint */}
                {isListening && !interimTranscript && (
                    <div style={{
                        fontSize: '0.75rem',
                        color: '#94a3b8',
                        fontStyle: 'italic',
                        marginTop: '0.35rem',
                        textAlign: 'center',
                        lineHeight: 1.3,
                    }}>
                        Listening... Say "Check my balance" or "Transfer 500 to Abhinav"
                    </div>
                )}

                {/* Voice Error Notification Banner */}
                {voiceError && (
                    <div style={{
                        marginTop: '0.6rem',
                        marginBottom: '0.3rem',
                        padding: '0.55rem 0.8rem',
                        borderRadius: '8px',
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.35)',
                        color: '#fca5a5',
                        fontSize: '0.78rem',
                        lineHeight: 1.35,
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: '6px',
                        textAlign: 'left',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
                            <span>{voiceError}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setVoiceError('')}
                            style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', padding: 0 }}
                            title="Dismiss"
                        >
                            <X size={14} />
                        </button>
                    </div>
                )}

                {/* Soundwave Frequency Visualization */}
                {isListening && (
                    <div className="voice-wave-container">
                        <div className="voice-wave-bar"></div>
                        <div className="voice-wave-bar"></div>
                        <div className="voice-wave-bar"></div>
                        <div className="voice-wave-bar"></div>
                        <div className="voice-wave-bar"></div>
                    </div>
                )}

                {/* Live Interim Transcript Display */}
                {interimTranscript && (
                    <div className="voice-interim-box">
                        "{interimTranscript}"
                    </div>
                )}

                {/* Conversation History Feed */}
                <div className="assistant-dialog-feed">
                    {messages.map((m) => (
                        <div key={m.id} className={`dialog-msg ${m.sender}`}>
                            <div className={`dialog-bubble ${m.isError ? 'error-bubble' : ''}`}>
                                {m.text}
                            </div>
                            <span className="dialog-meta">{m.time}</span>
                        </div>
                    ))}
                </div>

                {/* Quick Action Suggestion Chips */}
                <div className="assistant-suggestions">
                    <button
                        type="button"
                        className="suggestion-chip"
                        onClick={() => handleSendQuery('Transfer 100 to Pasumarthy')}
                    >
                        Send ₹100 to Pasumarthy
                    </button>
                    <button
                        type="button"
                        className="suggestion-chip"
                        onClick={() => handleSendQuery('Check my balance')}
                    >
                        Check Balance
                    </button>
                    <button
                        type="button"
                        className="suggestion-chip"
                        onClick={() => handleSendQuery('Toggle privacy mode')}
                    >
                        Privacy Mode
                    </button>
                    <button
                        type="button"
                        className="suggestion-chip"
                        onClick={() => handleSendQuery('Freeze my debit card')}
                    >
                        Freeze Card
                    </button>
                    <button
                        type="button"
                        className="suggestion-chip"
                        onClick={() => handleSendQuery('Export CSV statement')}
                    >
                        Export CSV
                    </button>
                </div>

                {/* Typed Query Form Fallback */}
                {!isTyping ? (
                    <button
                        className="dashboard-type-btn glass-pill"
                        onClick={() => setIsTyping(true)}
                        id="dashboard-type-queries-btn"
                    >
                        <span>Type your Queries</span>
                        <ArrowRight size={18} />
                    </button>
                ) : (
                    <form
                        className="query-input-form"
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleSendQuery();
                        }}
                    >
                        <input
                            type="text"
                            className="query-input"
                            placeholder="Ask Voxa anything..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            autoFocus
                        />
                        <button type="submit" className="query-send-btn" id="query-submit-btn">
                            <ArrowRight size={18} />
                        </button>
                    </form>
                )}

                {/* Assistant Toolbar Controls */}
                <div className="assistant-toolbar">
                    <button
                        type="button"
                        className={`assistant-tool-btn ${ttsEnabled ? 'active' : ''}`}
                        onClick={() => setTtsEnabled(!ttsEnabled)}
                        title={ttsEnabled ? 'Mute Voice Responses' : 'Enable Voice Audio Responses'}
                    >
                        {ttsEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
                        <span>{ttsEnabled ? 'Audio On' : 'Muted'}</span>
                    </button>
                    <button
                        type="button"
                        className="assistant-tool-btn"
                        onClick={handleResetSession}
                        title="Reset assistant dialogue memory"
                    >
                        <RefreshCw size={14} />
                        <span>Reset Session</span>
                    </button>
                </div>
            </div>
        </aside>
    );
}


export default function Dashboard({ onBack }) {
    const { user, logout } = useAuth();
    const [activeTab, setActiveTab] = useState('home');

    // Storage Key tied to the authenticated user ID
    const storageKey = user ? `voxa_banking_${user.id}` : 'voxa_banking_guest';

    // State initialized from localStorage or fresh 0 balance
    const [bankingData, setBankingData] = useState(() => {
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                return JSON.parse(saved);
            }
        } catch {}
        return getInitialBankingData(user);
    });

    // Save state on any bankingData change
    useEffect(() => {
        try {
            localStorage.setItem(storageKey, JSON.stringify(bankingData));
        } catch {}
    }, [bankingData, storageKey]);

    // Privacy mask state
    const [isMasked, setIsMasked] = useState(false);

    // Modals
    const [isDepositOpen, setIsDepositOpen] = useState(false);
    const [isBillPayOpen, setIsBillPayOpen] = useState(false);
    const [transferReceipt, setTransferReceipt] = useState(null);
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
    const [voiceTransferModal, setVoiceTransferModal] = useState(null);

    // Ref to communicate with AssistantPanel
    const voiceAssistantRef = useRef(null);

    // Refresh live account state from Supabase audit ledger
    const refreshAccountState = useCallback(async () => {
        if (!user) return;
        try {
            const res = await bankingApi.getAccount();
            if (res.data) {
                // If server ledger has 0 records but client localStorage has a balance, sync it seamlessly
                if (res.data.transactions.length === 0) {
                    try {
                        const localRaw = localStorage.getItem(storageKey);
                        if (localRaw) {
                            const localParsed = JSON.parse(localRaw);
                            if (localParsed.balance > 0) {
                                await bankingApi.sync({ balance: localParsed.balance });
                                const syncedRes = await bankingApi.getAccount();
                                setBankingData((prev) => ({
                                    ...prev,
                                    balance: syncedRes.data.balance,
                                    transactions: syncedRes.data.transactions,
                                }));
                                return;
                            }
                        }
                    } catch {}
                }

                setBankingData((prev) => ({
                    ...prev,
                    balance: res.data.balance,
                    transactions: res.data.transactions,
                }));
            }
        } catch (err) {
            // Keep using local state if offline
        }
    }, [user, storageKey]);

    // Initial sync and real-time polling so peer transfers show up instantly
    useEffect(() => {
        refreshAccountState();

        // 5s polling interval ensures recipient in any window/browser receives money in real-time
        const interval = setInterval(refreshAccountState, 5000);
        const onFocus = () => refreshAccountState();
        window.addEventListener('focus', onFocus);

        return () => {
            clearInterval(interval);
            window.removeEventListener('focus', onFocus);
        };
    }, [refreshAccountState]);

    // Handlers
    const handleDepositSuccess = useCallback(async (amount, method) => {
        const now = new Date();
        const dateStr = `Today, ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        const refId = `TXN-DEP-${Date.now().toString(36).toUpperCase()}`;

        try {
            await bankingApi.deposit({ amount, method });
        } catch (err) {
            console.error('Deposit backend sync error:', err);
        }

        const newTx = {
            id: refId,
            name: `Deposit via ${method}`,
            date: dateStr,
            amount: amount,
            type: 'credit',
            category: 'Deposit',
            status: 'Completed',
        };

        setBankingData((prev) => ({
            ...prev,
            balance: prev.balance + amount,
            transactions: [newTx, ...prev.transactions],
        }));

        refreshAccountState();
    }, [refreshAccountState]);

    const handleBillPaySuccess = useCallback(async (amount, biller) => {
        const now = new Date();
        const dateStr = `Today, ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        const refId = `TXN-BILL-${Date.now().toString(36).toUpperCase()}`;

        try {
            await bankingApi.billPay({ amount, biller });
        } catch (err) {
            console.error('Bill pay backend sync error:', err);
        }

        const newTx = {
            id: refId,
            name: `Bill Payment — ${biller}`,
            date: dateStr,
            amount: -amount,
            type: 'debit',
            category: 'Utilities',
            status: 'Completed',
        };

        setBankingData((prev) => ({
            ...prev,
            balance: prev.balance - amount,
            transactions: [newTx, ...prev.transactions],
        }));

        refreshAccountState();
    }, [refreshAccountState]);

    const handleConfirmLogout = async () => {
        setIsLogoutModalOpen(false);
        await logout();
        if (onBack) onBack();
    };

    return (
        <div className="dashboard-page">
            <Sidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onBack={onBack}
                onRequestLogout={() => setIsLogoutModalOpen(true)}
            />

            {activeTab === 'home' && (
                <HomeView
                    user={user}
                    bankingData={bankingData}
                    onOpenDeposit={() => setIsDepositOpen(true)}
                    onOpenBillPay={() => setIsBillPayOpen(true)}
                    onNavigateTab={setActiveTab}
                    isMasked={isMasked}
                    setIsMasked={setIsMasked}
                />
            )}

            {activeTab === 'cards' && (
                <CardsView
                    bankingData={bankingData}
                    setBankingData={setBankingData}
                />
            )}

            {activeTab === 'transfers' && (
                <TransfersView
                    user={user}
                    bankingData={bankingData}
                    setBankingData={setBankingData}
                    onOpenDeposit={() => setIsDepositOpen(true)}
                    onTransferSuccess={(rec) => setTransferReceipt(rec)}
                    onRefreshAccount={refreshAccountState}
                />
            )}

            {activeTab === 'statements' && (
                <StatementsView
                    bankingData={bankingData}
                    onOpenDeposit={() => setIsDepositOpen(true)}
                />
            )}

            {activeTab === 'settings' && (
                <SettingsView
                    user={user}
                    bankingData={bankingData}
                    setBankingData={setBankingData}
                />
            )}

            <AssistantPanel
                user={user}
                bankingData={bankingData}
                setBankingData={setBankingData}
                isMasked={isMasked}
                setIsMasked={setIsMasked}
                onVoiceTransferConfirm={(payload) => setVoiceTransferModal(payload)}
                setTransferReceipt={setTransferReceipt}
                onNavigateTab={setActiveTab}
                voiceAssistantRef={voiceAssistantRef}
                onRefreshAccount={refreshAccountState}
            />

            {/* Floating Voice Assistant Mic Button */}
            <FloatingVoiceButton
                onClick={() => {
                    if (voiceAssistantRef.current) {
                        voiceAssistantRef.current.toggleListening();
                    }
                }}
                isListening={voiceAssistantRef.current?.isListening}
            />

            {/* Voice Action Confirmation Modal (Transfer / Bill Pay / Deposit) */}
            <VoiceActionConfirmModal
                actionData={voiceTransferModal}
                onClose={() => setVoiceTransferModal(null)}
                onConfirm={() => {
                    setVoiceTransferModal(null);
                    if (voiceAssistantRef.current) {
                        voiceAssistantRef.current.sendQuery('yes');
                    }
                }}
                onCancel={() => {
                    setVoiceTransferModal(null);
                    if (voiceAssistantRef.current) {
                        voiceAssistantRef.current.sendQuery('no');
                    }
                }}
            />

            {/* Modals */}
            <DepositModal
                isOpen={isDepositOpen}
                onClose={() => setIsDepositOpen(false)}
                onDepositSuccess={handleDepositSuccess}
            />

            <PayBillsModal
                isOpen={isBillPayOpen}
                onClose={() => setIsBillPayOpen(false)}
                balance={bankingData.balance}
                onPaySuccess={handleBillPaySuccess}
            />

            <TransferReceiptModal
                receipt={transferReceipt}
                onClose={() => setTransferReceipt(null)}
            />

            <ConfirmLogoutModal
                isOpen={isLogoutModalOpen}
                onClose={() => setIsLogoutModalOpen(false)}
                onConfirm={handleConfirmLogout}
            />
        </div>
    );
}
