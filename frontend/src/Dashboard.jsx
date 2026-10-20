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
    MicOff,
    Eye,
    EyeOff,
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
    Menu,
    ChevronLeft,
    ChevronRight,
    Sliders,
    Activity,
    Layers,
    TrendingUp,
    TrendingDown,
    ShieldCheck,
    Award,
    Receipt,
} from 'lucide-react';
import { useAuth } from './AuthContext.jsx';
import { authApi, bankingApi, voiceApi } from './api.js';
import VoxaLogo from './components/VoxaLogo.jsx';
import { WavAudioRecorder, playWakeChime, playSuccessChime, playDeniedChime } from './utils/wavRecorder.js';
import './Dashboard.css';

// ── Luxury Monochrome Voxa Logo ──────────────────────────────────────────────
function LeafLogo({ size = 36, className = '' }) {
    return <VoxaLogo size={size} className={className} />;
}

// ── Currency Formatter (INR ₹) ───────────────────────────────────────────────
function formatINR(val) {
    const num = Number(val) || 0;
    return `₹${num.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

// ── CSV Statement Export Helper ──────────────────────────────────────────────
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
        balance: 0.0,
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
        transactions: [],
        preferences: {
            emailAlerts: true,
            twoFactor: true,
            biometrics: false,
        },
    };
}

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
            <div className="modal-card voice-confirm-modal-card" onClick={(e) => e.stopPropagation()}>
                <div className="voice-modal-header">
                    <div className="voice-modal-icon">
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

// ── Confirmation Logout Modal ────────────────────────────────────────────────
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

// ── Navigation Items ─────────────────────────────────────────────────────────
const navItems = [
    { id: 'home', icon: Home, label: 'Overview', badge: null },
    { id: 'transfers', icon: ArrowLeftRight, label: 'Transfers & P2P', badge: 'UPI' },
    { id: 'cards', icon: CreditCard, label: 'Cards & Security', badge: 'EMV' },
    { id: 'statements', icon: FileText, label: 'Audit Ledger', badge: null },
    { id: 'settings', icon: Settings, label: 'Settings', badge: null },
];

// ── Modern Collapsible Sidebar Component ─────────────────────────────────────
function ModernSidebar({
    activeTab,
    setActiveTab,
    onBack,
    onRequestLogout,
    isCollapsed,
    setIsCollapsed,
    isMobileOpen,
    setIsMobileOpen,
    onOpenTransfer,
}) {
    const { user } = useAuth();

    const initials = user?.full_name
        ? user.full_name
              .trim()
              .split(/\s+/)
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)
        : 'VU';

    return (
        <aside className={`dashboard-sidebar-v2 ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}>
            {/* Header / Brand */}
            <div className="sidebar-header-v2">
                <div
                    className="sidebar-brand-group"
                    onClick={() => {
                        if (isCollapsed) {
                            setIsCollapsed(false);
                        } else {
                            setActiveTab('home');
                        }
                    }}
                    title={isCollapsed ? 'Click to expand sidebar' : 'VoxaBank Home'}
                >
                    <LeafLogo size={32} />
                    {!isCollapsed && (
                        <div className="sidebar-brand-text">
                            <span className="sidebar-brand-name">VoxaBank</span>
                            <span className="sidebar-brand-badge">AI Core v2.4</span>
                        </div>
                    )}
                </div>
                {!isCollapsed && (
                    <button
                        className="sidebar-collapse-btn"
                        onClick={() => {
                            if (window.innerWidth <= 900) {
                                setIsMobileOpen(false);
                            } else {
                                setIsCollapsed(true);
                            }
                        }}
                        title="Collapse Sidebar"
                    >
                        <ChevronLeft size={18} />
                    </button>
                )}
            </div>

            {/* Quick Action Button */}
            {!isCollapsed ? (
                <div className="sidebar-quick-action">
                    <button
                        className="btn-sidebar-transfer"
                        onClick={() => {
                            setActiveTab('transfers');
                            if (window.innerWidth <= 900) setIsMobileOpen(false);
                        }}
                        id="sidebar-new-transfer-btn"
                    >
                        <Send size={15} />
                        <span>Send Money (P2P)</span>
                    </button>
                </div>
            ) : (
                <div className="sidebar-quick-action">
                    <button
                        className="btn-sidebar-transfer"
                        onClick={() => setActiveTab('transfers')}
                        title="Send Money (P2P)"
                    >
                        <Send size={16} />
                    </button>
                </div>
            )}

            {/* Navigation Menu */}
            <nav className="sidebar-nav-v2">
                {navItems.map(({ id, icon: Icon, label, badge }) => (
                    <button
                        key={id}
                        className={`sidebar-nav-btn ${activeTab === id ? 'active' : ''}`}
                        onClick={() => {
                            setActiveTab(id);
                            if (window.innerWidth <= 900) setIsMobileOpen(false);
                        }}
                        title={isCollapsed ? label : undefined}
                        id={`nav-${id}-btn`}
                    >
                        <span className="sidebar-nav-icon"><Icon size={20} /></span>
                        {!isCollapsed && <span className="sidebar-nav-label">{label}</span>}
                        {!isCollapsed && badge && <span className="sidebar-nav-badge">{badge}</span>}
                    </button>
                ))}
            </nav>

            {/* User Profile Card & Sign Out */}
            <div className="sidebar-footer-v2">
                {user && (
                    <div className="sidebar-user-card-v2" title={user.email}>
                        <div className="sidebar-avatar">{initials}</div>
                        {!isCollapsed && (
                            <div className="sidebar-user-details">
                                <span className="sidebar-user-name">{user.full_name}</span>
                                <span className="sidebar-user-sub">Obsidian Premier Tier</span>
                            </div>
                        )}
                    </div>
                )}

                <div className="sidebar-footer-actions">
                    {isCollapsed && (
                        <button
                            className="sidebar-action-btn expand"
                            onClick={() => setIsCollapsed(false)}
                            title="Expand Sidebar"
                            id="sidebar-expand-btn"
                        >
                            <ChevronRight size={16} />
                        </button>
                    )}
                    <button
                        className="sidebar-action-btn"
                        onClick={onBack}
                        title="Back to Landing Page"
                        id="sidebar-home-portal-btn"
                    >
                        <ArrowLeft size={16} />
                        {!isCollapsed && <span>Landing</span>}
                    </button>
                    <button
                        className="sidebar-action-btn logout"
                        onClick={onRequestLogout}
                        title="Sign out of your account"
                        id="sidebar-logout-btn"
                    >
                        <LogOut size={16} />
                        {!isCollapsed && <span>Log Out</span>}
                    </button>
                </div>
            </div>
        </aside>
    );
}

// ── Top Financial Command Bar ────────────────────────────────────────────────
function TopFinancialCommandBar({
    activeTab,
    isMasked,
    setIsMasked,
    isAssistantOpen,
    setIsAssistantOpen,
    onOpenDeposit,
    onOpenBillPay,
    onOpenTransfer,
    onTriggerVoiceMic,
    isVoiceListening,
    onToggleMobileSidebar,
    wakeWordEnabled,
    onToggleWakeWord,
}) {
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const timeStr = currentTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
    });

    const activeLabel = navItems.find((n) => n.id === activeTab)?.label || 'Overview';

    return (
        <header className="dashboard-topbar-v2">
            {/* Left: Mobile Toggle & Breadcrumbs */}
            <div className="topbar-left-group">
                <button
                    className="sidebar-collapse-btn mobile-menu-btn"
                    onClick={onToggleMobileSidebar}
                    aria-label="Open sidebar menu"
                    style={{ display: 'none' }}
                >
                    <Menu size={18} />
                </button>
                <div className="topbar-view-title">
                    <span>VOXABANK</span>
                    <span className="slash">/</span>
                    <span className="section">{activeLabel}</span>
                </div>
                <div className="topbar-network-badge">
                    <span className="topbar-network-dot" />
                    <span>RBI UPI 2.0 • 100% Active</span>
                </div>
            </div>

            {/* Center: Command Launcher / Quick Mic */}
            <div className="topbar-search-launcher">
                <Search size={16} className="topbar-search-icon" />
                <input
                    type="text"
                    className="topbar-search-input"
                    placeholder='Ask Voxa AI ("Transfer ₹500")...'
                    onClick={() => {
                        if (!isAssistantOpen) setIsAssistantOpen(true);
                    }}
                    readOnly
                />
                <button
                    className="topbar-search-mic-btn"
                    onClick={onTriggerVoiceMic}
                    title="Click to speak to Voice Assistant"
                >
                    <Mic size={14} />
                </button>
            </div>

            {/* Right: "Hey Voxa" Wake Pill, Clock, Privacy, Deposit, & AI Copilot */}
            <div className="topbar-right-group">
                {/* Hands-Free "Hey Voxa" Radar Status */}
                <button
                    type="button"
                    className={`topbar-hey-voxa-pill ${wakeWordEnabled ? 'active' : ''}`}
                    onClick={onToggleWakeWord}
                    title={wakeWordEnabled ? "Hey Voxa is listening — say 'Hey Voxa' anytime hands-free" : "Hey Voxa paused — click to activate hands-free"}
                    id="topbar-hey-voxa-toggle-btn"
                >
                    <span className={`wake-radar-ping ${wakeWordEnabled ? 'pulsing' : ''}`} />
                    <Radio size={13} />
                    <span>"Hey Voxa"</span>
                </button>

                <div className="topbar-clock">
                    {timeStr} IST
                </div>

                <button
                    className={`topbar-tool-btn ${isMasked ? 'active' : ''}`}
                    onClick={() => setIsMasked(!isMasked)}
                    title={isMasked ? 'Privacy Mode Active (Balances Hidden)' : 'Hide Sensitive Balances'}
                >
                    {isMasked ? <EyeOff size={16} /> : <Eye size={16} />}
                    <span>{isMasked ? 'Private' : 'Reveal'}</span>
                </button>

                <button
                    className="welcome-action-pill primary"
                    onClick={onOpenDeposit}
                    id="topbar-deposit-btn"
                >
                    <PlusCircle size={15} />
                    <span>Deposit</span>
                </button>

                <button
                    className={`topbar-copilot-toggle ${isAssistantOpen ? 'open' : ''}`}
                    onClick={() => setIsAssistantOpen(!isAssistantOpen)}
                    id="topbar-copilot-btn"
                >
                    <Sparkles size={16} className="copilot-sparkle-icon" />
                    <span>{isAssistantOpen ? 'Dock AI' : 'Open AI Copilot'}</span>
                </button>
            </div>
        </header>
    );
}

// ── Redesigned Home View: 4-KPI Command Deck & Bento Grid ────────────────────
function HomeView({
    user,
    bankingData,
    setBankingData,
    onOpenDeposit,
    onOpenBillPay,
    onNavigateTab,
    isMasked,
    setIsMasked,
    onSelectBeneficiaryTransfer,
}) {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const displayName = user?.full_name || 'Member';

    const totalIncome = useMemo(() => {
        return (bankingData.transactions || [])
            .filter((tx) => tx.type === 'credit')
            .reduce((sum, tx) => sum + tx.amount, 0);
    }, [bankingData.transactions]);

    const totalExpenses = useMemo(() => {
        return (bankingData.transactions || [])
            .filter((tx) => tx.type === 'debit')
            .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    }, [bankingData.transactions]);

    // Live Registered Voxa Users from Supabase
    const [registeredUsers, setRegisteredUsers] = useState([]);
    useEffect(() => {
        let mounted = true;
        bankingApi.getVoxaUsers().then((res) => {
            if (mounted) setRegisteredUsers(res.data || []);
        }).catch(() => {});
        return () => { mounted = false; };
    }, []);

    const recentList = (bankingData.transactions || []).slice(0, 5);
    const formattedBalance = formatINR(bankingData.balance);

    const toggleFreeze = () => {
        setBankingData((prev) => ({
            ...prev,
            card: { ...prev.card, frozen: !prev.card.frozen },
        }));
    };

    return (
        <div className="dashboard-scroll-canvas">
            {/* Top Greeting & Action Pills */}
            <div className="home-welcome-header">
                <div className="welcome-text-group">
                    <h1>{greeting}, {displayName}</h1>
                    <p>Institutional spoken banking terminal. All ledgers synced in real time.</p>
                </div>
                <div className="welcome-quick-pills">
                    <button className="welcome-action-pill primary" onClick={onOpenDeposit}>
                        <PlusCircle size={16} />
                        <span>Add Money</span>
                    </button>
                    <button className="welcome-action-pill secondary" onClick={() => onNavigateTab('transfers')}>
                        <Send size={16} />
                        <span>Send (P2P)</span>
                    </button>
                    <button className="welcome-action-pill secondary" onClick={onOpenBillPay}>
                        <Receipt size={16} />
                        <span>Pay Bills</span>
                    </button>
                </div>
            </div>

            {/* 4-KPI Command Deck */}
            <div className="home-kpi-grid">
                {/* 1. Net Balance Featured */}
                <div className="home-kpi-card balance-featured">
                    <div className="kpi-card-header">
                        <div className="kpi-label-group">
                            <span className="kpi-title">Total Account Balance</span>
                        </div>
                        <button
                            onClick={() => setIsMasked(!isMasked)}
                            style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer' }}
                            title={isMasked ? 'Reveal balance' : 'Hide balance'}
                        >
                            {isMasked ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                    <div className="kpi-main-metric">
                        <span className="kpi-value">{isMasked ? '••••••••' : formattedBalance}</span>
                    </div>
                    <div className="kpi-card-footer">
                        <span>Voxa Savings •••• {bankingData.card?.last4 || '4821'}</span>
                        <span style={{ color: '#f97316', fontWeight: 600 }}>0.00% Surcharge</span>
                    </div>
                </div>

                {/* 2. Monthly Inflow */}
                <div className="home-kpi-card">
                    <div className="kpi-card-header">
                        <span className="kpi-title">Total Inflow</span>
                        <div className="kpi-icon-pill">
                            <TrendingUp size={18} />
                        </div>
                    </div>
                    <div className="kpi-main-metric">
                        <span className="kpi-value">+{formatINR(totalIncome)}</span>
                    </div>
                    <div className="kpi-card-footer">
                        <span>Deposits & incoming wires</span>
                        <span className="kpi-trend-pill">Verified</span>
                    </div>
                </div>

                {/* 3. Monthly Outflow */}
                <div className="home-kpi-card">
                    <div className="kpi-card-header">
                        <span className="kpi-title">Total Outflow</span>
                        <div className="kpi-icon-pill">
                            <TrendingDown size={18} />
                        </div>
                    </div>
                    <div className="kpi-main-metric">
                        <span className="kpi-value">-{formatINR(totalExpenses)}</span>
                    </div>
                    <div className="kpi-card-footer">
                        <span>Invoices, bills & P2P</span>
                        <span className="kpi-trend-pill">Settled</span>
                    </div>
                </div>

                {/* 4. Card Status & Spending Cap */}
                <div className="home-kpi-card">
                    <div className="kpi-card-header">
                        <span className="kpi-title">Obsidian Platinum</span>
                        <div className="kpi-icon-pill white">
                            <CreditCard size={18} />
                        </div>
                    </div>
                    <div className="kpi-main-metric">
                        <span className="kpi-value" style={{ fontSize: '1.4rem' }}>
                            {bankingData.card?.frozen ? 'CARD FROZEN' : 'ACTIVE • EMV'}
                        </span>
                    </div>
                    <div className="kpi-card-footer">
                        <span>Daily Limit: {formatINR(bankingData.card?.dailyLimit || 50000)}</span>
                        <span
                            onClick={() => onNavigateTab('cards')}
                            style={{ color: '#f97316', textDecoration: 'none', cursor: 'pointer', fontWeight: 600 }}
                        >
                            Limits →
                        </span>
                    </div>
                </div>
            </div>

            {/* Quick Services Dock */}
            <div className="quick-services-dock">
                <div className="service-dock-item" onClick={() => onNavigateTab('transfers')}>
                    <div className="service-dock-icon"><Send size={22} /></div>
                    <span className="service-dock-name">Send Money</span>
                    <span className="service-dock-desc">Instant P2P Ledger</span>
                </div>
                <div className="service-dock-item" onClick={onOpenDeposit}>
                    <div className="service-dock-icon"><PlusCircle size={22} /></div>
                    <span className="service-dock-name">Deposit Funds</span>
                    <span className="service-dock-desc">UPI & NetBanking</span>
                </div>
                <div className="service-dock-item" onClick={onOpenBillPay}>
                    <div className="service-dock-icon"><Zap size={22} /></div>
                    <span className="service-dock-name">Pay Utilities</span>
                    <span className="service-dock-desc">BESCOM, Gas, Rent</span>
                </div>
            </div>

            {/* Bento Grid (2 Columns: Left 65%, Right 35%) */}
            <div className="home-bento-grid">
                {/* Left Column: Recent Activity & Frequent Contacts */}
                <div className="bento-column-left">
                    {/* Frequent Beneficiaries Carousel */}
                    <div className="bento-card">
                        <div className="bento-card-header">
                            <div className="bento-title-group">
                                <h3>Registered Voxa Contacts</h3>
                                <p>Tap any verified recipient to start an instant zero-fee wire transfer.</p>
                            </div>
                            <button className="bento-header-link" onClick={() => onNavigateTab('transfers')}>
                                View Directory →
                            </button>
                        </div>

                        {registeredUsers.length === 0 ? (
                            <p style={{ fontSize: '0.85rem', color: '#71717a' }}>
                                Loading registered users from database…
                            </p>
                        ) : (
                            <div className="frequent-contacts-row">
                                {registeredUsers.map((u) => {
                                    const init = u.full_name
                                        ? u.full_name.trim().split(/\s+/).map((n) => n[0]).join('').toUpperCase().slice(0, 2)
                                        : 'VU';
                                    return (
                                        <button
                                            key={u.id}
                                            type="button"
                                            className="contact-quick-chip"
                                            onClick={() => onSelectBeneficiaryTransfer(u)}
                                        >
                                            <span className="contact-chip-avatar">{init}</span>
                                            <span>{u.full_name}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Recent Transactions Ledger */}
                    <div className="bento-card">
                        <div className="bento-card-header">
                            <div className="bento-title-group">
                                <h3>Recent Transactions</h3>
                                <p>Real-time audit records for your primary savings ledger.</p>
                            </div>
                            {bankingData.transactions.length > 0 && (
                                <button className="bento-header-link" onClick={() => onNavigateTab('statements')}>
                                    Full Statement →
                                </button>
                            )}
                        </div>

                        {recentList.length === 0 ? (
                            <div className="empty-state-card">
                                <div className="empty-state-icon">
                                    <Clock size={28} />
                                </div>
                                <h4 style={{ color: '#ffffff', fontWeight: 600 }}>No transactions yet</h4>
                                <p style={{ fontSize: '0.85rem', color: '#a1a1aa' }}>Deposit funds or make your first transfer to see activity recorded here.</p>
                                <button className="welcome-action-pill primary" onClick={onOpenDeposit} style={{ marginTop: '0.5rem' }}>
                                    <PlusCircle size={15} /> Make First Deposit
                                </button>
                            </div>
                        ) : (
                            <div className="recent-transactions-ledger">
                                {recentList.map((tx) => (
                                    <div className="ledger-item-row" key={tx.id}>
                                        <div className="ledger-item-left">
                                            <div className={`ledger-item-icon ${tx.type}`}>
                                                {tx.type === 'credit' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                                            </div>
                                            <div className="ledger-item-info">
                                                <span className="ledger-item-name">{tx.name}</span>
                                                <div className="ledger-item-meta">
                                                    <span>{tx.date}</span>
                                                    <span>•</span>
                                                    <span className="ledger-item-ref">{tx.id?.slice(0, 14)}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="ledger-item-right">
                                            <span className={`ledger-item-amount ${tx.type}`}>
                                                {tx.amount > 0 ? '+' : '-'}{formatINR(Math.abs(tx.amount))}
                                            </span>
                                            <span className="ledger-status-pill">Completed</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Virtual Card Snapshot & Security Health */}
                <div className="bento-column-right">
                    {/* Live Virtual Card Preview */}
                    <div className="bento-card">
                        <div className="bento-card-header">
                            <div className="bento-title-group">
                                <h3>Obsidian Card Snapshot</h3>
                                <p>Holographic EMV virtual debit card.</p>
                            </div>
                            <button className="bento-header-link" onClick={() => onNavigateTab('cards')}>
                                Manage →
                            </button>
                        </div>

                        <div className="mini-virtual-card-widget">
                            <div className="mini-card-top-row">
                                <div className="mini-card-brand">
                                    <LeafLogo size={20} />
                                    <span>VOXA BANK</span>
                                </div>
                                <span className="mini-card-tier-pill">Platinum Debit</span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: 34, height: 24, borderRadius: 4, background: 'linear-gradient(135deg, #d4d4d8, #52525b)', border: '1px solid rgba(255,255,255,0.2)' }} />
                                <Radio size={16} color="rgba(255,255,255,0.7)" style={{ transform: 'rotate(90deg)' }} />
                            </div>

                            <div className="mini-card-number">
                                {isMasked ? '•••• •••• •••• ' + (bankingData.card?.last4 || '4821') : `4532 •••• •••• ${bankingData.card?.last4 || '4821'}`}
                            </div>

                            <div className="mini-card-bottom-row">
                                <div>
                                    <div style={{ fontSize: '0.62rem', color: '#71717a', textTransform: 'uppercase' }}>Cardholder</div>
                                    <div className="mini-card-holder-name">{bankingData.card?.cardholder || 'VOXA MEMBER'}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.62rem', color: '#71717a', textTransform: 'uppercase' }}>Expires</div>
                                    <div className="mini-card-expiry">{bankingData.card?.expiry || '08/29'}</div>
                                </div>
                            </div>
                        </div>

                        <button
                            className={`btn-mini-freeze ${bankingData.card?.frozen ? 'frozen' : ''}`}
                            onClick={toggleFreeze}
                            id="home-toggle-freeze-card-btn"
                        >
                            {bankingData.card?.frozen ? <Unlock size={16} /> : <Lock size={16} />}
                            <span>{bankingData.card?.frozen ? 'Unfreeze Obsidian Card' : 'Freeze Card Immediately'}</span>
                        </button>
                    </div>

                    {/* Security & System Compliance Health */}
                    <div className="security-health-card">
                        <div className="bento-title-group">
                            <h3>Security & Compliance</h3>
                            <p>Hardware-enforced banking security metrics.</p>
                        </div>

                        <div className="security-checklist">
                            <div className="security-check-item">
                                <span className="security-check-label"><ShieldCheck size={16} /> RBI Digital Banking Norms</span>
                                <span className="security-check-status">Compliant</span>
                            </div>
                            <div className="security-check-item">
                                <span className="security-check-label"><Lock size={16} /> AES-256 GCM Cryptographic Vault</span>
                                <span className="security-check-status">Armed</span>
                            </div>
                            <div className="security-check-item">
                                <span className="security-check-label"><Zap size={16} /> NPCI UPI 2.0 Settlement Latency</span>
                                <span className="security-check-status">&lt;11ms</span>
                            </div>
                            <div className="security-check-item">
                                <span className="security-check-label"><CheckCircle size={16} /> KYC Verification Level</span>
                                <span className="security-check-status">Tier 1 Verified</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Redesigned Cards View ───────────────────────────────────────────────────
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
            card: { ...prev.card, [key]: !Boolean(prev.card?.[key]) },
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
        <div className="dashboard-scroll-canvas">
            <div className="tab-header">
                <h1 style={{ fontSize: '1.85rem', fontWeight: 800 }}>Cards & Security Controls</h1>
                <p style={{ color: '#a1a1aa' }}>Programmatic card controls, real-time POS channels, and daily spending caps.</p>
            </div>

            <div className="cards-layout-v2">
                {/* Physical Card Representation */}
                <div className="card-showcase-container">
                    <div className={`virtual-card ${card.frozen ? 'frozen' : ''}`}>
                        <div className="virtual-card-glare" />
                        {card.frozen && <div className="frozen-badge">Card Frozen</div>}

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
                            {copySuccess ? <Check size={16} color="#ffffff" /> : <Copy size={16} />}
                            <span>{copySuccess ? 'Copied!' : 'Copy Card #'}</span>
                        </button>
                    </div>
                </div>

                {/* Card Controls & Limits */}
                <div className="card-settings-card">
                    <h3>Card Limits & Security Channels</h3>

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

                    <div style={{ marginTop: '1.75rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button className="btn-save-settings" onClick={handleSaveSettings}>
                            Save Card Settings
                        </button>
                        {savedToast && (
                            <span style={{ color: '#ffffff', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <CheckCircle size={16} color="#f97316" /> Preferences updated!
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Redesigned Transfers View ───────────────────────────────────────────────
function TransfersView({
    user,
    bankingData,
    setBankingData,
    onOpenDeposit,
    onTransferSuccess,
    onRefreshAccount,
    prefilledRecipient,
    biometrics,
}) {
    const [recipient, setRecipient] = useState(prefilledRecipient || '');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('Peer Transfer');
    const [note, setNote] = useState('');
    const [error, setError] = useState('');

    const [verifying, setVerifying] = useState(false);
    const [verifiedUser, setVerifiedUser] = useState(null);
    const [verifyError, setVerifyError] = useState('');

    const [registeredUsers, setRegisteredUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(true);

    const currentBalance = bankingData.balance;

    useEffect(() => {
        let mounted = true;
        const fetchUsers = async () => {
            try {
                const res = await bankingApi.getVoxaUsers();
                if (mounted) setRegisteredUsers(res.data || []);
            } catch {
                if (mounted) setRegisteredUsers([]);
            } finally {
                if (mounted) setLoadingUsers(false);
            }
        };
        fetchUsers();
        return () => { mounted = false; };
    }, []);

    useEffect(() => {
        if (prefilledRecipient) {
            setRecipient(prefilledRecipient);
        }
    }, [prefilledRecipient]);

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
        <div className="dashboard-scroll-canvas">
            <div className="tab-header">
                <h1 style={{ fontSize: '1.85rem', fontWeight: 800 }}>P2P Wire & Transfer Engine</h1>
                <p style={{ color: '#a1a1aa' }}>Execute instant peer-to-peer transfers with live Supabase recipient ledger validation.</p>
            </div>

            <div className="transfers-layout-v2">
                {/* Left: Source Account & Verified Contacts */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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

                    <div className="beneficiaries-card">
                        <h4>Registered Database Contacts (Click to Select)</h4>
                        {loadingUsers ? (
                            <p style={{ fontSize: '0.85rem', color: '#a1a1aa' }}>Loading contacts…</p>
                        ) : registeredUsers.length === 0 ? (
                            <p style={{ fontSize: '0.85rem', color: '#a1a1aa' }}>
                                No other users registered yet. Register a second account to test transfers!
                            </p>
                        ) : (
                            <div className="beneficiaries-row">
                                {registeredUsers.map((u) => {
                                    const inits = u.full_name
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
                                            <span className="beneficiary-avatar-dot">{inits}</span>
                                            <span>{u.full_name}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Transfer Execution Form */}
                <div className="transfer-form-card">
                    {error && (
                        <div className="password-alert error" style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>{error}</span>
                            {currentBalance <= 0 && (
                                <button
                                    onClick={onOpenDeposit}
                                    style={{ background: 'none', border: 'none', color: '#f97316', textDecoration: 'underline', cursor: 'pointer', fontWeight: 600 }}
                                >
                                    Deposit Now
                                </button>
                            )}
                        </div>
                    )}

                    {biometrics?.voice_locked_transfers && biometrics?.has_voiceprint && (
                        <div className="voice-lock-security-badge">
                            <ShieldCheck size={16} />
                            <span>Voice Biometrics Enforced: Only your enrolled acoustic voiceprint can authorize transfers.</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmitTransfer}>
                        <div className="form-field-group">
                            <label className="form-field-label">Recipient Voxa Email or ID</label>
                            <input
                                type="text"
                                className="form-field-input"
                                placeholder="e.g. test@nlp.com"
                                value={recipient}
                                onChange={(e) => setRecipient(e.target.value)}
                                required
                            />

                            {verifying && (
                                <p style={{ fontSize: '0.82rem', color: '#a1a1aa', marginTop: '0.35rem' }}>
                                    Checking database records…
                                </p>
                            )}

                            {verifiedUser && (
                                <div className="recipient-verified-box">
                                    <CheckCircle size={16} />
                                    <span>Verified Voxa User: <strong>{verifiedUser.full_name}</strong> ({verifiedUser.email})</span>
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

// ── Redesigned Statements View ──────────────────────────────────────────────
function StatementsView({ bankingData, onOpenDeposit }) {
    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    const transactions = bankingData.transactions || [];

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
                    (tx.name || '').toLowerCase().includes(term) ||
                    (tx.category && tx.category.toLowerCase().includes(term)) ||
                    (tx.id && tx.id.toLowerCase().includes(term))
                );
            }
            return true;
        });
    }, [transactions, filter, searchTerm]);

    const handleExportCsv = () => {
        exportCsvToUser(transactions);
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="dashboard-scroll-canvas">
            <div className="tab-header">
                <h1 style={{ fontSize: '1.85rem', fontWeight: 800 }}>Account Audit Statements</h1>
                <p style={{ color: '#a1a1aa' }}>Full cryptographic transaction ledger, audit references, and monthly export reports.</p>
            </div>

            <div className="statements-container-v2">
                {/* KPI Metrics */}
                <div className="statement-kpis-grid">
                    <div className="statement-kpi-card">
                        <span className="statement-kpi-title">Total Inflow</span>
                        <span className="statement-kpi-value green">+{formatINR(totalInflow)}</span>
                    </div>
                    <div className="statement-kpi-card">
                        <span className="statement-kpi-title">Total Outflow</span>
                        <span className="statement-kpi-value red">-{formatINR(totalOutflow)}</span>
                    </div>
                    <div className="statement-kpi-card">
                        <span className="statement-kpi-title">Net Cash Flow</span>
                        <span className={`statement-kpi-value ${netChange >= 0 ? 'green' : 'red'}`}>
                            {netChange >= 0 ? '+' : '-'}{formatINR(Math.abs(netChange))}
                        </span>
                    </div>
                    <div className="statement-kpi-card">
                        <span className="statement-kpi-title">Total Records</span>
                        <span className="statement-kpi-value">{transactions.length}</span>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="statement-toolbar-v2">
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
                <div className="statement-table-card">
                    {filteredList.length === 0 ? (
                        <div className="empty-state-card">
                            <div className="empty-state-icon">
                                <FileText size={28} />
                            </div>
                            <h4 style={{ color: '#ffffff', fontWeight: 600 }}>No matching statement records</h4>
                            <p style={{ color: '#a1a1aa' }}>
                                {transactions.length === 0
                                    ? 'Your account has 0 transactions recorded so far.'
                                    : 'No transactions match the selected filter.'}
                            </p>
                            {transactions.length === 0 && (
                                <button className="welcome-action-pill primary" onClick={onOpenDeposit} style={{ marginTop: '0.5rem' }}>
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
                                        <td style={{ color: '#a1a1aa', fontSize: '0.85rem' }}>{tx.date}</td>
                                        <td style={{ fontWeight: 600 }}>{tx.name}</td>
                                        <td style={{ fontFamily: 'monospace', color: '#a1a1aa', fontSize: '0.82rem' }}>
                                            {tx.id}
                                        </td>
                                        <td>
                                            <span style={{ fontSize: '0.82rem', color: '#a1a1aa' }}>
                                                {tx.category || 'General'}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="ledger-status-pill">Completed</span>
                                        </td>
                                        <td
                                            style={{
                                                textAlign: 'right',
                                                fontFamily: 'monospace',
                                                fontWeight: 700,
                                                color: tx.type === 'credit' ? '#ffffff' : '#d4d4d8',
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

// ── Modal: Biometric Voiceprint Enrollment (160-D Mel Vector) ────────────────
function VoiceEnrollmentModal({ isOpen, onClose, user, onSuccess }) {
    const [step, setStep] = useState('intro'); // 'intro', 'countdown', 'recording', 'saving', 'success', 'error'
    const [countdown, setCountdown] = useState(3);
    const [recordTimeLeft, setRecordTimeLeft] = useState(4.5);
    const [errorMsg, setErrorMsg] = useState('');
    const recorderRef = useRef(null);

    useEffect(() => {
        if (!isOpen) {
            setStep('intro');
            setCountdown(3);
            setRecordTimeLeft(4.5);
            setErrorMsg('');
            if (recorderRef.current) {
                try { recorderRef.current.stop(); } catch {}
                recorderRef.current = null;
            }
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const startEnrollmentFlow = async () => {
        setErrorMsg('');
        setStep('countdown');
        let count = 3;
        setCountdown(3);

        const countInterval = setInterval(() => {
            count -= 1;
            if (count > 0) {
                setCountdown(count);
            } else {
                clearInterval(countInterval);
                startActualRecording();
            }
        }, 1000);
    };

    const startActualRecording = async () => {
        try {
            const recorder = new WavAudioRecorder();
            recorderRef.current = recorder;
            await recorder.start();
            setStep('recording');
            setRecordTimeLeft(4.5);

            let remaining = 4.5;
            const timer = setInterval(async () => {
                remaining -= 0.5;
                setRecordTimeLeft(Math.max(0, parseFloat(remaining.toFixed(1))));

                if (remaining <= 0) {
                    clearInterval(timer);
                    setStep('saving');
                    try {
                        const audioData = recorder.stop();
                        recorderRef.current = null;

                        const enrollRes = await voiceApi.biometrics.enroll({
                            user_id: user?.id || 'default_user',
                            audio_base64: audioData.base64,
                            user_email: user?.email || '',
                            user_name: user?.full_name || '',
                        });

                        playSuccessChime();
                        setStep('success');
                        if (onSuccess) onSuccess(enrollRes.data);
                        setTimeout(() => {
                            onClose();
                        }, 2200);
                    } catch (saveErr) {
                        console.error('Enrollment error:', saveErr);
                        setErrorMsg(saveErr.response?.data?.detail || 'Voice acoustic enrollment failed. Please try again in a quiet room.');
                        setStep('error');
                    }
                }
            }, 500);
        } catch (micErr) {
            console.error('Microphone error:', micErr);
            setErrorMsg('Microphone access denied. Please allow microphone permissions in your browser.');
            setStep('error');
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-card" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(249, 115, 22, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ShieldCheck size={20} color="#f97316" />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#ffffff' }}>Biometric Voice Enrollment</h3>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: '#a1a1aa' }}>160-Dimensional Acoustic Voiceprint Generation</p>
                        </div>
                    </div>
                    <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
                </div>

                <div style={{ padding: '1rem 0' }}>
                    {step === 'intro' && (
                        <div>
                            <p style={{ color: '#d4d4d8', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
                                Secure your account with voice biometrics. Once enrolled, voice transfers can <strong>only be authorized by your acoustic vocal signature</strong>.
                            </p>
                            <div style={{ background: 'rgba(255, 255, 255, 0.04)', borderRadius: 10, padding: '14px 18px', border: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '1.5rem' }}>
                                <span style={{ fontSize: '0.75rem', color: '#f97316', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Passphrase to speak:</span>
                                <p style={{ color: '#ffffff', fontSize: '0.98rem', fontWeight: 600, marginTop: 6, marginBottom: 0, fontStyle: 'italic' }}>
                                    "I authorize VoxaBank to secure my funds with my unique voice signature."
                                </p>
                            </div>
                            <button
                                type="button"
                                className="btn-submit-transfer"
                                onClick={startEnrollmentFlow}
                                id="start-voice-enrollment-btn"
                            >
                                <Mic size={16} /> Begin Voice Recording (4.5s)
                            </button>
                        </div>
                    )}

                    {step === 'countdown' && (
                        <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                            <div style={{ fontSize: '4rem', fontWeight: 900, color: '#f97316', lineHeight: 1 }}>{countdown}</div>
                            <p style={{ color: '#a1a1aa', marginTop: '1rem', fontSize: '0.92rem' }}>Get ready to speak the phrase clearly into your microphone...</p>
                        </div>
                    )}

                    {step === 'recording' && (
                        <div style={{ textAlign: 'center', padding: '1.5rem 1rem' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 12px', borderRadius: 9999, background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', fontSize: '0.8rem', fontWeight: 600 }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', animation: 'dotPulse 0.8s infinite alternate' }} />
                                Recording Live Voice Sample ({recordTimeLeft}s)
                            </div>
                            <div className="waveform-bars-container">
                                {[...Array(8)].map((_, i) => (
                                    <div key={i} className="waveform-bar" />
                                ))}
                            </div>
                            <p style={{ color: '#ffffff', fontSize: '1.05rem', fontWeight: 600, fontStyle: 'italic', margin: '0 auto', maxWidth: 420 }}>
                                "I authorize VoxaBank to secure my funds with my unique voice signature."
                            </p>
                        </div>
                    )}

                    {step === 'saving' && (
                        <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                            <RefreshCw size={36} color="#f97316" className="spinning-icon" style={{ animation: 'spin 1s linear infinite' }} />
                            <h4 style={{ color: '#ffffff', marginTop: '1rem' }}>Extracting Mel-Acoustic Voiceprint...</h4>
                            <p style={{ color: '#a1a1aa', fontSize: '0.85rem' }}>Computing 160-D MFCC feature vector & acoustic energy normalization</p>
                        </div>
                    )}

                    {step === 'success' && (
                        <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                            <CheckCircle size={48} color="#4ade80" style={{ margin: '0 auto' }} />
                            <h4 style={{ color: '#ffffff', marginTop: '1rem', fontSize: '1.25rem' }}>Voice Biometric Enrolled!</h4>
                            <p style={{ color: '#a1a1aa', fontSize: '0.88rem', marginTop: 6 }}>
                                Your acoustic voiceprint has been saved. Voice Lock for fund transfers is now active!
                            </p>
                        </div>
                    )}

                    {step === 'error' && (
                        <div style={{ textAlign: 'center', padding: '1.5rem 1rem' }}>
                            <AlertCircle size={42} color="#f87171" style={{ margin: '0 auto' }} />
                            <h4 style={{ color: '#ffffff', marginTop: '0.75rem' }}>Enrollment Failed</h4>
                            <p style={{ color: '#f87171', fontSize: '0.85rem' }}>{errorMsg}</p>
                            <button
                                type="button"
                                className="btn-submit-transfer"
                                style={{ marginTop: '1rem' }}
                                onClick={() => setStep('intro')}
                            >
                                Try Again
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Voice Biometrics & "Hey Voxa" Settings Card ──────────────────────────────
function VoiceBiometricsSettingsCard({
    user,
    biometrics,
    onRefreshStatus,
    onOpenEnrollModal,
    wakeWordEnabled,
    onToggleWakeWord,
}) {
    const [testingVoice, setTestingVoice] = useState(false);
    const [testCount, setTestCount] = useState(3);
    const [testResult, setTestResult] = useState(null);
    const [togglingLock, setTogglingLock] = useState(false);
    const testRecorderRef = useRef(null);

    const handleToggleLock = async () => {
        if (!biometrics?.has_voiceprint) {
            onOpenEnrollModal();
            return;
        }
        setTogglingLock(true);
        try {
            const next = !biometrics?.voice_locked_transfers;
            await voiceApi.biometrics.toggleLock(user?.id || 'default_user', next);
            if (onRefreshStatus) onRefreshStatus();
        } catch (err) {
            console.error('Toggle lock error:', err);
        } finally {
            setTogglingLock(false);
        }
    };

    const handleTestVerification = async () => {
        if (!biometrics?.has_voiceprint) {
            onOpenEnrollModal();
            return;
        }

        setTestResult(null);
        setTestingVoice(true);
        setTestCount(3);

        try {
            const recorder = new WavAudioRecorder();
            testRecorderRef.current = recorder;
            await recorder.start();

            let count = 3;
            const timer = setInterval(async () => {
                count -= 1;
                setTestCount(count);
                if (count <= 0) {
                    clearInterval(timer);
                    try {
                        const audioData = recorder.stop();
                        testRecorderRef.current = null;
                        const verifyRes = await voiceApi.biometrics.verify({
                            user_id: user?.id || 'default_user',
                            audio_base64: audioData.base64,
                        });
                        setTestResult(verifyRes.data);
                        if (verifyRes.data.verified) {
                            playSuccessChime();
                        } else {
                            playDeniedChime();
                        }
                    } catch (verifyErr) {
                        setTestResult({ verified: false, message: 'Verification failed. Audio was not recognized.' });
                        playDeniedChime();
                    } finally {
                        setTestingVoice(false);
                    }
                }
            }, 1000);
        } catch (e) {
            setTestingVoice(false);
            setTestResult({ verified: false, message: 'Could not access microphone.' });
        }
    };

    const handleDeleteVoiceprint = async () => {
        if (!window.confirm('Are you sure you want to delete your enrolled voiceprint? Transfers will no longer require your voice.')) {
            return;
        }
        try {
            await voiceApi.biometrics.deleteVoiceprint(user?.id || 'default_user');
            if (onRefreshStatus) onRefreshStatus();
            setTestResult(null);
        } catch (err) {
            console.error('Delete voiceprint error:', err);
        }
    };

    return (
        <div className="settings-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                        <ShieldCheck size={20} color="#f97316" />
                        Voice Biometrics & "Hey Voxa" Hands-Free Controls
                    </h3>
                    <p className="settings-card-desc" style={{ marginTop: 4, marginBottom: 0 }}>
                        Acoustic speaker verification for money transfers and hands-free ambient wake word detection.
                    </p>
                </div>
                <div>
                    {biometrics?.has_voiceprint ? (
                        <span className="biometrics-status-badge enrolled">
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80' }} />
                            Voiceprint Active (160-D Vector)
                        </span>
                    ) : (
                        <span className="biometrics-status-badge unenrolled">
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fb923c' }} />
                            Voiceprint Not Enrolled
                        </span>
                    )}
                </div>
            </div>

            <div className="toggles-list" style={{ marginTop: '1.25rem', borderTop: 'none', paddingTop: 0 }}>
                {/* Voice-Locked Transfers */}
                <div className="toggle-row">
                    <div className="toggle-info">
                        <h5>Transfer Voice Lock (Biometric Speaker Authorization)</h5>
                        <p>Only the enrolled account owner's acoustic voiceprint can authorize transfers. Unauthorized voices or text-only attempts are immediately rejected.</p>
                    </div>
                    <label className="switch">
                        <input
                            type="checkbox"
                            checked={biometrics?.voice_locked_transfers ?? false}
                            onChange={handleToggleLock}
                            disabled={togglingLock}
                        />
                        <span className="switch-slider" />
                    </label>
                </div>

                {/* Hey Voxa Ambient Listener */}
                <div className="toggle-row">
                    <div className="toggle-info">
                        <h5>"Hey Voxa" Wake Word Detection</h5>
                        <p>Listen in the background for "Hey Voxa" to automatically open the assistant and accept spoken commands hands-free.</p>
                    </div>
                    <label className="switch">
                        <input
                            type="checkbox"
                            checked={wakeWordEnabled}
                            onChange={onToggleWakeWord}
                        />
                        <span className="switch-slider" />
                    </label>
                </div>
            </div>

            {/* Biometric Actions */}
            <div className="voice-biometric-actions">
                <button
                    type="button"
                    className="btn-bio-action primary"
                    onClick={onOpenEnrollModal}
                    id="settings-enroll-voice-btn"
                >
                    <Mic size={15} />
                    {biometrics?.has_voiceprint ? 'Re-enroll / Update Voiceprint' : 'Enroll My Voice (4.5s)'}
                </button>

                {biometrics?.has_voiceprint && (
                    <button
                        type="button"
                        className="btn-bio-action secondary"
                        onClick={handleTestVerification}
                        disabled={testingVoice}
                        id="settings-test-voice-btn"
                    >
                        <Radio size={15} />
                        {testingVoice ? `Speak now... (${testCount}s)` : 'Test My Voice Match'}
                    </button>
                )}

                {biometrics?.has_voiceprint && (
                    <button
                        type="button"
                        className="btn-bio-action danger"
                        onClick={handleDeleteVoiceprint}
                        id="settings-delete-voice-btn"
                    >
                        <X size={15} />
                        Delete Voiceprint
                    </button>
                )}
            </div>

            {/* Test Voice Match Results */}
            {testResult && (
                <div className={`voice-test-result ${testResult.verified ? 'verified' : 'denied'}`}>
                    {testResult.verified ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    <div>
                        <strong>{testResult.verified ? 'Voice Biometrics Verified!' : 'Voice Authentication Mismatch!'}</strong>
                        <span style={{ marginLeft: 8, fontSize: '0.8rem', opacity: 0.85 }}>
                            Cosine Similarity: {(testResult.similarity || 0).toFixed(3)} ({testResult.confidence || 0}% match) — {testResult.message}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Redesigned Settings View ────────────────────────────────────────────────
function SettingsView({
    user,
    bankingData,
    setBankingData,
    biometrics,
    onRefreshBiometrics,
    onOpenEnrollModal,
    wakeWordEnabled,
    onToggleWakeWord,
}) {
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
        setBankingData((prev) => {
            const currentVal = prev.preferences?.[key] !== undefined ? Boolean(prev.preferences[key]) : true;
            return {
                ...prev,
                preferences: {
                    ...prev.preferences,
                    [key]: !currentVal,
                },
            };
        });
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
        <div className="dashboard-scroll-canvas">
            <div className="tab-header">
                <h1 style={{ fontSize: '1.85rem', fontWeight: 800 }}>Account & Security Settings</h1>
                <p style={{ color: '#a1a1aa' }}>Manage your profile credentials, domestic wire routing codes, and security channels.</p>
            </div>

            <div className="settings-layout-v2">
                {/* Full Account Information */}
                <div className="settings-card">
                    <h3>Verified Banking Identifiers</h3>
                    <p className="settings-card-desc">Routing codes for IMPS, NEFT, RTGS, and UPI settlement networks.</p>

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
                                    {copiedField === 'acc' ? <Check size={14} color="#ffffff" /> : <Copy size={14} />}
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
                                    {copiedField === 'ifsc' ? <Check size={14} color="#ffffff" /> : <Copy size={14} />}
                                </button>
                            </span>
                        </div>
                        <div className="info-item">
                            <span className="info-item-label">Account Tier</span>
                            <span className="info-item-value">Obsidian Premier (Zero Fee)</span>
                        </div>
                        <div className="info-item">
                            <span className="info-item-label">KYC Verification</span>
                            <span className="info-item-value" style={{ color: '#ffffff', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f97316', display: 'inline-block' }}></span>
                                Verified & Active
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

                {/* Right Side: Password & Preferences */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Change Password Form */}
                    <div className="settings-card">
                        <h3>Change Password</h3>
                        <p className="settings-card-desc">Update your password to keep your banking credentials secure.</p>

                        {pwAlert && (
                            <div className={`password-alert ${pwAlert.type}`} style={{ marginBottom: '1.25rem' }}>
                                {pwAlert.message}
                            </div>
                        )}

                        <form onSubmit={handleChangePassword}>
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
                                        placeholder="Min 8 chars"
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
                    <div className="settings-card">
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

            {/* Dedicated Full-Width Voice Biometrics & Hey Voxa Card */}
            <div style={{ marginTop: '1.5rem' }}>
                <VoiceBiometricsSettingsCard
                    user={user}
                    biometrics={biometrics}
                    onRefreshStatus={onRefreshBiometrics}
                    onOpenEnrollModal={onOpenEnrollModal}
                    wakeWordEnabled={wakeWordEnabled}
                    onToggleWakeWord={onToggleWakeWord}
                />
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

                <form onSubmit={handleConfirm}>
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

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1.5rem' }}>
                        <span style={{ fontSize: '0.85rem', color: '#a1a1aa' }}>Payment Method</span>

                        <div
                            className={`deposit-method-card ${method === 'UPI / NetBanking' ? 'selected' : ''}`}
                            onClick={() => setMethod('UPI / NetBanking')}
                        >
                            <Zap size={20} color="#ffffff" />
                            <div>
                                <div style={{ fontSize: '0.92rem', fontWeight: 600 }}>UPI (GPay / PhonePe / Paytm)</div>
                                <div style={{ fontSize: '0.78rem', color: '#a1a1aa' }}>Instant • 0% convenience fee</div>
                            </div>
                        </div>

                        <div
                            className={`deposit-method-card ${method === 'IMPS / NEFT' ? 'selected' : ''}`}
                            onClick={() => setMethod('IMPS / NEFT')}
                        >
                            <CreditCard size={20} color="#ffffff" />
                            <div>
                                <div style={{ fontSize: '0.92rem', fontWeight: 600 }}>NetBanking / IMPS / NEFT</div>
                                <div style={{ fontSize: '0.78rem', color: '#a1a1aa' }}>Direct Bank Transfer • Instant</div>
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn-submit-transfer"
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
                        <h3>Pay Utilities & Invoices</h3>
                        <p>Pay verified electricity, broadband, mobile, and rent bills in ₹.</p>
                    </div>
                    <button className="modal-close-btn" onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handlePay}>
                    {error && (
                        <div className="password-alert error" style={{ marginBottom: '1rem' }}>{error}</div>
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
                    <p style={{ color: '#a1a1aa', fontSize: '0.92rem' }}>
                        Funds have been dispatched instantly to the verified Voxa user.
                    </p>
                </div>

                <div className="receipt-details-list">
                    <div className="receipt-row">
                        <span>Amount Transferred</span>
                        <strong style={{ color: '#ffffff', fontSize: '1.15rem' }}>
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
                        <span className="ledger-status-pill">Completed</span>
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

// ── Modern Dockable AI Copilot Panel (Voice & Queries) ───────────────────────
function ModernAICopilotPanel({
    isOpen,
    onClose,
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
    onListeningStateChange,
}) {
    const [query, setQuery] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [ttsEnabled, setTtsEnabled] = useState(true);
    const [interimTranscript, setInterimTranscript] = useState('');
    const [voiceError, setVoiceError] = useState('');
    const [voiceLang, setVoiceLang] = useState('en-IN');
    const voiceLangRef = useRef('en-IN');
    useEffect(() => { voiceLangRef.current = voiceLang; }, [voiceLang]);

    const [messages, setMessages] = useState([
        {
            id: 1,
            sender: 'bot',
            text: 'Hello! I am your VoxaBank AI Neural Copilot. Speak or type to transfer money, check balances, freeze cards, or export statements.',
            time: 'Just now',
        },
    ]);

    const recognitionRef = useRef(null);
    const silenceTimerRef = useRef(null);
    const accumulatedTranscriptRef = useRef('');
    const isListeningRef = useRef(false);
    const handleSendQueryRef = useRef(null);
    const audioRecorderRef = useRef(null);

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

    // Main query processor with Live Voice Biometrics Support
    const handleSendQuery = useCallback(
        async (rawText, audioBase64 = null) => {
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
                    user_id: user?.id,
                    account_number: bankingData.accountNumber,
                    card: bankingData.card,
                    preferences: bankingData.preferences,
                    transactions: bankingData.transactions,
                    inflow: totalInflow,
                    outflow: totalOutflow,
                    audio_base64: audioBase64,
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

                // Voice Biometrics Audio Chime Feedback
                if (data.status === 'voice_auth_failed') {
                    playDeniedChime();
                } else if (data.status === 'ok' && data.action_payload?.action === 'TRANSFER_SUCCESS') {
                    playSuccessChime();
                }

                // Privacy Toggle Sync
                if (data.intent === 'account_overview' && data.sub_intent === 'privacy_toggle') {
                    setIsMasked((prev) => !prev);
                } else if (data.action_payload?.action === 'TOGGLE_PRIVACY') {
                    setIsMasked(Boolean(data.action_payload.is_masked));
                }

                // Transfer & Bill Confirmation Sync
                if (data.status === 'confirm' && (
                    data.action_payload?.action === 'TRANSFER_CONFIRMATION' ||
                    data.action_payload?.action === 'BILL_CONFIRMATION' ||
                    data.action_payload?.action === 'DEPOSIT_CONFIRMATION'
                )) {
                    onVoiceTransferConfirm(data.action_payload);
                } else if (data.status === 'ok' && data.action_payload?.action === 'TRANSFER_SUCCESS') {
                    const amt = parseFloat(data.action_payload.amount);
                    const rec = data.action_payload.recipient || 'Beneficiary';
                    const recipientTarget = data.action_payload.recipient_id || data.action_payload.recipient_email || rec;
                    const cat = data.action_payload.category || 'Peer Transfer';
                    const refId = `TXN-VOX-${Date.now().toString(36).toUpperCase()}`;

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
                                        name: `Transfer to ${transferRes.data.recipient || rec}`,
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
                            recipient: transferRes.data.recipient || rec,
                            amount: amt,
                            date: actualDate,
                            category: cat,
                            type: 'debit',
                        });
                    } catch (transferErr) {
                        console.error('Voice transfer backend sync error:', transferErr);
                    }
                } else if (data.status === 'ok' && data.action_payload?.action === 'BILL_SUCCESS') {
                    const amt = parseFloat(data.action_payload.amount);
                    const biller = data.action_payload.biller || 'Electricity & Gas';
                    const refId = `TXN-BILL-${Date.now().toString(36).toUpperCase()}`;

                    try {
                        const billRes = await bankingApi.billPay({ biller, amount: amt });
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
                        console.error('Voice bill pay sync error:', billErr);
                    }
                }

                // Card Freeze & Channel Controls Sync
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
                } else if (data.action_payload?.action === 'TOGGLE_CARD_CHANNEL' && data.action_payload.channel) {
                    const ch = data.action_payload.channel;
                    const isEn = Boolean(data.action_payload.enabled);
                    setBankingData((prev) => ({
                        ...prev,
                        card: { ...prev.card, [ch]: isEn },
                    }));
                } else if (data.action_payload?.action === 'SET_CARD_LIMIT' && data.action_payload.amount) {
                    const limKey = data.action_payload.limit_type === 'per_tx' ? 'perTxLimit' : 'dailyLimit';
                    setBankingData((prev) => ({
                        ...prev,
                        card: { ...prev.card, [limKey]: Number(data.action_payload.amount) },
                    }));
                }

                // Full Card State Sync from Voice API if returned
                if (data.card) {
                    setBankingData((prev) => ({
                        ...prev,
                        card: {
                            ...prev.card,
                            ...data.card,
                        },
                    }));
                }

                // Security & Notification Preferences Sync
                if (data.action_payload?.action === 'TOGGLE_PREFERENCE') {
                    setBankingData((prev) => ({
                        ...prev,
                        preferences: {
                            ...prev.preferences,
                            ...(data.action_payload.has_email ? { emailAlerts: Boolean(data.action_payload.email_alerts) } : {}),
                            ...(data.action_payload.has_2fa ? { twoFactor: Boolean(data.action_payload.two_factor) } : {}),
                        },
                    }));
                }

                if (data.preferences && (data.intent === 'banking_profile' || data.action_payload?.action === 'TOGGLE_PREFERENCE')) {
                    setBankingData((prev) => ({
                        ...prev,
                        preferences: {
                            ...prev.preferences,
                            emailAlerts: Boolean(data.preferences.emailAlerts),
                            twoFactor: Boolean(data.preferences.twoFactor),
                        },
                    }));
                }

                // CSV Export Sync
                if (data.sub_intent === 'export_csv' || data.action_payload?.action === 'EXPORT_CSV') {
                    exportCsvToUser(bankingData.transactions);
                } else if (data.sub_intent === 'print_statement' || data.action_payload?.action === 'PRINT_STATEMENT') {
                    window.print();
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
        [query, user, bankingData.balance, bankingData.transactions, speakText, setIsMasked, onVoiceTransferConfirm, setBankingData, setTransferReceipt, onRefreshAccount]
    );

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

        if (onListeningStateChange) onListeningStateChange(false);

        let recordedBase64 = null;
        if (audioRecorderRef.current) {
            try {
                const recData = audioRecorderRef.current.stop();
                recordedBase64 = recData?.base64 || null;
            } catch (e) {
                console.warn('WAV recorder stop error:', e);
            }
            audioRecorderRef.current = null;
        }

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
            handleSendQueryRef.current(pending, recordedBase64);
        }
    }, [interimTranscript, onListeningStateChange]);

    const initiateRecognitionSession = useCallback(() => {
        if (!isListeningRef.current) return;

        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRec) {
            setVoiceError('Speech Recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
            isListeningRef.current = false;
            setIsListening(false);
            return;
        }

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

                if (silenceTimerRef.current) {
                    clearTimeout(silenceTimerRef.current);
                    silenceTimerRef.current = null;
                }

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
                if (e.error === 'no-speech' || e.error === 'aborted') return;
                console.warn('Speech recognition error:', e.error);
                if (e.error === 'not-allowed') {
                    setVoiceError('Microphone permission blocked. Please allow mic access in your browser.');
                }
            };

            rec.onend = () => {
                if (isListeningRef.current) {
                    const pendingQuery = (accumulatedTranscriptRef.current || interimTranscript).trim();
                    if (pendingQuery && !silenceTimerRef.current) {
                        handleStopListening(pendingQuery);
                    } else if (!pendingQuery) {
                        setTimeout(() => {
                            if (isListeningRef.current) initiateRecognitionSession();
                        }, 120);
                    }
                } else {
                    setIsListening(false);
                }
            };

            recognitionRef.current = rec;
            rec.start();
        } catch (err) {
            console.error('Speech recognition start failed:', err);
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

        if (onListeningStateChange) onListeningStateChange(true);

        try {
            audioRecorderRef.current = new WavAudioRecorder();
            audioRecorderRef.current.start().catch((err) => {
                console.warn('WAV recorder start error:', err);
            });
        } catch (e) {}

        isListeningRef.current = true;
        setIsListening(true);
        initiateRecognitionSession();
    }, [initiateRecognitionSession, onListeningStateChange]);

    const handleSpeakToggle = () => {
        if (isListening) {
            handleStopListening();
        } else {
            handleStartListening();
        }
    };

    useEffect(() => {
        return () => {
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            if (recognitionRef.current) {
                try { recognitionRef.current.abort(); } catch {}
            }
            if (audioRecorderRef.current) {
                try { audioRecorderRef.current.stop(); } catch {}
                audioRecorderRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (voiceAssistantRef) {
            voiceAssistantRef.current = {
                sendQuery: (q, audio = null) => handleSendQuery(q, audio),
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
                text: 'Dialogue state reset. How can I assist you?',
                time: 'Just now',
            },
        ]);
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
        }
    };

    return (
        <aside className={`assistant-panel-v2 ${isOpen ? 'open' : 'closed'}`}>
            <div className="copilot-panel-inner">
                {/* Header */}
                <div className="copilot-header">
                    <div className="copilot-brand-title">
                        <LeafLogo size={24} />
                        <h2>Voxa Neural Copilot</h2>
                        <span className="copilot-status-badge">Whisper AI</span>
                    </div>
                    <div className="copilot-header-actions">
                        <button
                            className="copilot-mini-btn"
                            onClick={() => setTtsEnabled(!ttsEnabled)}
                            title={ttsEnabled ? 'Mute Speech' : 'Enable Speech'}
                        >
                            {ttsEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                        </button>
                        <button
                            className="copilot-mini-btn"
                            onClick={handleResetSession}
                            title="Reset dialogue memory"
                        >
                            <RefreshCw size={14} />
                        </button>
                        <button
                            className="copilot-mini-btn"
                            onClick={onClose}
                            title="Close Copilot Panel"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Voice Stage */}
                <div className="copilot-mic-stage">
                    <button
                        className={`copilot-big-mic-btn ${isListening ? 'active-pulse' : ''}`}
                        onClick={handleSpeakToggle}
                        id="copilot-voice-mic-btn"
                    >
                        <Mic size={38} />
                        <span>{isListening ? 'Listening…' : isProcessing ? 'Thinking…' : isSpeaking ? 'Speaking…' : 'Speak Now'}</span>
                    </button>

                    {/* Dialect Switcher */}
                    <div className="copilot-dialect-bar">
                        <button
                            type="button"
                            className={`dialect-pill-btn ${voiceLang === 'en-IN' ? 'active' : ''}`}
                            onClick={() => setVoiceLang('en-IN')}
                        >
                            English (IN)
                        </button>
                        <button
                            type="button"
                            className={`dialect-pill-btn ${voiceLang === 'en-US' ? 'active' : ''}`}
                            onClick={() => setVoiceLang('en-US')}
                        >
                            English (US)
                        </button>
                    </div>

                    {/* Wave visualizer */}
                    {isListening && (
                        <div className="voice-wave-container">
                            <div className="voice-wave-bar" />
                            <div className="voice-wave-bar" />
                            <div className="voice-wave-bar" />
                            <div className="voice-wave-bar" />
                            <div className="voice-wave-bar" />
                        </div>
                    )}

                    {/* Live Interim Transcript */}
                    {interimTranscript && (
                        <div className="voice-interim-box">
                            "{interimTranscript}"
                        </div>
                    )}
                </div>

                {/* Dialogue History */}
                <div className="copilot-chat-feed">
                    {messages.map((m) => (
                        <div key={m.id} className={`dialog-msg ${m.sender}`}>
                            <div className={`dialog-bubble ${m.isError ? 'error-bubble' : ''}`}>
                                {m.text}
                            </div>
                            <span className="dialog-meta">{m.time}</span>
                        </div>
                    ))}
                </div>

                {/* Quick Prompts */}
                <div className="copilot-suggestions-wrap">
                    <button
                        type="button"
                        className="suggestion-chip"
                        onClick={() => handleSendQuery('Transfer 100 to Pasumarthy')}
                    >
                        Send ₹100
                    </button>
                    <button
                        type="button"
                        className="suggestion-chip"
                        onClick={() => handleSendQuery('Check my account balance')}
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

                {/* Query Input Form */}
                <form
                    className="copilot-query-form"
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleSendQuery();
                    }}
                >
                    <input
                        type="text"
                        className="copilot-query-input"
                        placeholder="Type question or instruction..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    <button type="submit" className="copilot-send-btn" id="copilot-query-submit-btn">
                        <ArrowRight size={16} />
                    </button>
                </form>
            </div>
        </aside>
    );
}

// ── Main Dashboard Export ────────────────────────────────────────────────────
export default function Dashboard({ onBack }) {
    const { user, logout } = useAuth();
    const [activeTab, setActiveTab] = useState('home');

    // Layout States (Default: Clean Widescreen with Collapsed Sidebar & Closed AI Copilot as in Image 1)
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [isAssistantOpen, setIsAssistantOpen] = useState(false);

    const storageKey = user ? `voxa_banking_${user.id}` : 'voxa_banking_guest';

    const [bankingData, setBankingData] = useState(() => {
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) return JSON.parse(saved);
        } catch {}
        return getInitialBankingData(user);
    });

    useEffect(() => {
        try {
            localStorage.setItem(storageKey, JSON.stringify(bankingData));
        } catch {}
    }, [bankingData, storageKey]);

    const [isMasked, setIsMasked] = useState(false);

    // Modals
    const [isDepositOpen, setIsDepositOpen] = useState(false);
    const [isBillPayOpen, setIsBillPayOpen] = useState(false);
    const [transferReceipt, setTransferReceipt] = useState(null);
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
    const [voiceTransferModal, setVoiceTransferModal] = useState(null);

    // Voice Biometrics State
    const [biometrics, setBiometrics] = useState({
        has_voiceprint: false,
        voice_locked_transfers: false,
    });
    const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);

    const refreshBiometrics = useCallback(async () => {
        if (!user?.id) return;
        try {
            const res = await voiceApi.biometrics.getStatus(user.id);
            if (res.data) {
                setBiometrics(res.data);
            }
        } catch (e) {
            console.debug('Biometrics fetch notice:', e);
        }
    }, [user?.id]);

    useEffect(() => {
        refreshBiometrics();
    }, [refreshBiometrics]);

    // Ambient "Hey Voxa" Wake Word Detection
    const [wakeWordEnabled, setWakeWordEnabled] = useState(() => {
        return localStorage.getItem('voxa_wake_word_enabled') !== 'false';
    });
    const [wakeDetectedBanner, setWakeDetectedBanner] = useState(false);
    const wakeRecognitionRef = useRef(null);
    const wakeTimeoutRef = useRef(null);
    const isActivelyListeningRef = useRef(false);

    const handleToggleWakeWord = useCallback(() => {
        setWakeWordEnabled((prev) => {
            const next = !prev;
            localStorage.setItem('voxa_wake_word_enabled', next ? 'true' : 'false');
            return next;
        });
    }, []);

    const handleListeningStateChange = useCallback((active) => {
        isActivelyListeningRef.current = active;
        if (active && wakeRecognitionRef.current) {
            try {
                wakeRecognitionRef.current.onend = null;
                wakeRecognitionRef.current.onerror = null;
                wakeRecognitionRef.current.abort();
            } catch {}
            wakeRecognitionRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (!wakeWordEnabled) {
            if (wakeRecognitionRef.current) {
                try {
                    wakeRecognitionRef.current.onend = null;
                    wakeRecognitionRef.current.onerror = null;
                    wakeRecognitionRef.current.abort();
                } catch {}
                wakeRecognitionRef.current = null;
            }
            return;
        }

        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRec) return;

        let isRunning = true;

        function startWakeListener() {
            if (!isRunning || !wakeWordEnabled || isActivelyListeningRef.current) return;

            try {
                if (wakeRecognitionRef.current) {
                    try {
                        wakeRecognitionRef.current.onend = null;
                        wakeRecognitionRef.current.onerror = null;
                        wakeRecognitionRef.current.abort();
                    } catch {}
                }

                const rec = new SpeechRec();
                rec.continuous = true;
                rec.interimResults = true;
                rec.lang = 'en-IN';
                rec.maxAlternatives = 1;

                rec.onstart = () => {};

                rec.onresult = (e) => {
                    let fullTranscript = '';
                    for (let i = e.resultIndex; i < e.results.length; i++) {
                        fullTranscript += ' ' + e.results[i][0].transcript;
                    }
                    const lower = fullTranscript.toLowerCase();

                    // Detect "hey voxa", "voxa", "ok voxa", "hi voxa", "hello voxa"
                    const wakeMatch = lower.match(/\b(?:hey|hi|ok|hello)?\s*(?:voxa|boxa|vox|vaxa)\b/i);
                    if (wakeMatch) {
                        const wakeIndex = wakeMatch.index + wakeMatch[0].length;
                        const trailing = fullTranscript.slice(wakeIndex).trim().replace(/^[,\.\!\?\-\s]+/, '');

                        try {
                            rec.onend = null;
                            rec.onerror = null;
                            rec.abort();
                        } catch {}

                        playWakeChime();

                        setWakeDetectedBanner(true);
                        if (wakeTimeoutRef.current) clearTimeout(wakeTimeoutRef.current);
                        wakeTimeoutRef.current = setTimeout(() => {
                            setWakeDetectedBanner(false);
                        }, 3500);

                        setIsAssistantOpen(true);

                        setTimeout(() => {
                            if (trailing && trailing.length > 2) {
                                voiceAssistantRef.current?.sendQuery(trailing);
                            } else {
                                voiceAssistantRef.current?.startListening();
                            }
                        }, 250);
                    }
                };

                rec.onerror = (e) => {
                    if (e.error === 'no-speech' || e.error === 'aborted') return;
                    console.debug('Wake word listener notice:', e.error);
                };

                rec.onend = () => {
                    if (isRunning && wakeWordEnabled && !isActivelyListeningRef.current) {
                        setTimeout(() => {
                            if (isRunning && wakeWordEnabled && !isActivelyListeningRef.current) {
                                startWakeListener();
                            }
                        }, 350);
                    }
                };

                wakeRecognitionRef.current = rec;
                rec.start();
            } catch (err) {
                console.debug('Wake listener initialization notice:', err);
            }
        }

        startWakeListener();

        return () => {
            isRunning = false;
            if (wakeTimeoutRef.current) clearTimeout(wakeTimeoutRef.current);
            if (wakeRecognitionRef.current) {
                try {
                    wakeRecognitionRef.current.onend = null;
                    wakeRecognitionRef.current.onerror = null;
                    wakeRecognitionRef.current.abort();
                } catch {}
                wakeRecognitionRef.current = null;
            }
        };
    }, [wakeWordEnabled, setIsAssistantOpen]);

    // Transfer prefilled recipient from beneficiary clicks
    const [prefilledRecipient, setPrefilledRecipient] = useState('');

    const voiceAssistantRef = useRef(null);

    // Supabase Live Account Sync
    const refreshAccountState = useCallback(async () => {
        if (!user) return;
        try {
            const res = await bankingApi.getAccount();
            if (res.data) {
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
            // Keep local state
        }
    }, [user, storageKey]);

    useEffect(() => {
        refreshAccountState();
        const interval = setInterval(refreshAccountState, 5000);
        const onFocus = () => refreshAccountState();
        window.addEventListener('focus', onFocus);
        return () => {
            clearInterval(interval);
            window.removeEventListener('focus', onFocus);
        };
    }, [refreshAccountState]);

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

    const handleSelectBeneficiaryFromHome = (u) => {
        setPrefilledRecipient(u.email);
        setActiveTab('transfers');
    };

    return (
        <div className="dashboard-shell">
            {/* Ambient Background Glows */}
            <div className="dashboard-ambient-glow-1" />
            <div className="dashboard-ambient-glow-2" />

            {/* Collapsible Left Navigation Sidebar */}
            <ModernSidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onBack={onBack}
                onRequestLogout={() => setIsLogoutModalOpen(true)}
                isCollapsed={isSidebarCollapsed}
                setIsCollapsed={setIsSidebarCollapsed}
                isMobileOpen={isMobileSidebarOpen}
                setIsMobileOpen={setIsMobileSidebarOpen}
                onOpenTransfer={() => setActiveTab('transfers')}
            />

            {/* Main Center Workspace */}
            <div className="dashboard-workspace">
                {/* Top Financial Command Bar */}
                <TopFinancialCommandBar
                    activeTab={activeTab}
                    isMasked={isMasked}
                    setIsMasked={setIsMasked}
                    isAssistantOpen={isAssistantOpen}
                    setIsAssistantOpen={setIsAssistantOpen}
                    onOpenDeposit={() => setIsDepositOpen(true)}
                    onOpenBillPay={() => setIsBillPayOpen(true)}
                    onOpenTransfer={() => setActiveTab('transfers')}
                    onTriggerVoiceMic={() => {
                        if (!isAssistantOpen) setIsAssistantOpen(true);
                        if (voiceAssistantRef.current) {
                            voiceAssistantRef.current.toggleListening();
                        }
                    }}
                    isVoiceListening={voiceAssistantRef.current?.isListening}
                    onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
                    wakeWordEnabled={wakeWordEnabled}
                    onToggleWakeWord={handleToggleWakeWord}
                />

                {/* Workspace Body: Dynamic View + Copilot Dock */}
                <div className="dashboard-workspace-body">
                    {activeTab === 'home' && (
                        <HomeView
                            user={user}
                            bankingData={bankingData}
                            setBankingData={setBankingData}
                            onOpenDeposit={() => setIsDepositOpen(true)}
                            onOpenBillPay={() => setIsBillPayOpen(true)}
                            onNavigateTab={setActiveTab}
                            isMasked={isMasked}
                            setIsMasked={setIsMasked}
                            onSelectBeneficiaryTransfer={handleSelectBeneficiaryFromHome}
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
                            prefilledRecipient={prefilledRecipient}
                            biometrics={biometrics}
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
                            biometrics={biometrics}
                            onRefreshBiometrics={refreshBiometrics}
                            onOpenEnrollModal={() => setIsEnrollModalOpen(true)}
                            wakeWordEnabled={wakeWordEnabled}
                            onToggleWakeWord={handleToggleWakeWord}
                        />
                    )}

                    {/* AI Copilot Panel (Docked or Collapsed) */}
                    <ModernAICopilotPanel
                        isOpen={isAssistantOpen}
                        onClose={() => setIsAssistantOpen(false)}
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
                        onListeningStateChange={handleListeningStateChange}
                    />
                </div>
            </div>

            {/* Ambient "Hey Voxa" Detected Notification Banner */}
            {wakeDetectedBanner && (
                <div className="hey-voxa-hud-banner">
                    <div className="hey-voxa-hud-pulse" />
                    <Mic size={18} color="#f97316" />
                    <div className="hey-voxa-hud-text">
                        <span className="hey-voxa-hud-title">"Hey Voxa" Activated</span>
                        <span className="hey-voxa-hud-sub">Listening for your spoken command...</span>
                    </div>
                </div>
            )}

            {/* Floating Voice Trigger Button (Visible when Copilot panel is closed) */}
            {!isAssistantOpen && (
                <FloatingVoiceButton
                    onClick={() => {
                        setIsAssistantOpen(true);
                        if (voiceAssistantRef.current) {
                            voiceAssistantRef.current.toggleListening();
                        }
                    }}
                    isListening={voiceAssistantRef.current?.isListening}
                />
            )}

            {/* Voice Confirmation Modal */}
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

            {/* Biometric Voice Enrollment Modal */}
            <VoiceEnrollmentModal
                isOpen={isEnrollModalOpen}
                onClose={() => setIsEnrollModalOpen(false)}
                user={user}
                onSuccess={() => refreshBiometrics()}
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
