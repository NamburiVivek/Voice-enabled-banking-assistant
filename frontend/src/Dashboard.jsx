import React, { useState } from 'react';
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
} from 'lucide-react';
import './Dashboard.css';

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

const navItems = [
    { icon: Home, label: 'Home', active: true },
    { icon: CreditCard, label: 'Cards' },
    { icon: ArrowLeftRight, label: 'Transfers' },
    { icon: FileText, label: 'Statements' },
    { icon: Settings, label: 'Settings' },
];

const quickActions = [
    { icon: Send, label: 'Send Money' },
    { icon: PlusCircle, label: 'Add Money' },
    { icon: FileText, label: 'Pay Bills' },
    { icon: CreditCard, label: 'Cards' },
];

const transactions = [
    { icon: ShoppingBag, name: 'Amazon Shopping', date: 'Today, 10:24 AM', amount: -84.5, type: 'debit' },
    { icon: ArrowDownLeft, name: 'Salary Credit', date: 'Yesterday, 9:00 AM', amount: 3200.0, type: 'credit' },
    { icon: Coffee, name: 'Blue Bottle Coffee', date: 'Yesterday, 8:12 AM', amount: -6.75, type: 'debit' },
    { icon: Smartphone, name: 'Mobile Recharge', date: 'Mon, 4:45 PM', amount: -25.0, type: 'debit' },
];

function Sidebar({ onBack }) {
    return (
        <aside className="dashboard-sidebar">
            <div className="sidebar-top">
                <LeafLogo size={36} />
                <span className="sidebar-brand">Voxa</span>
            </div>

            <nav className="sidebar-nav">
                {navItems.map(({ icon: Icon, label, active }) => (
                    <button key={label} className={`sidebar-nav-item ${active ? 'active' : ''}`}>
                        <Icon size={20} />
                        <span>{label}</span>
                    </button>
                ))}
            </nav>

            <button className="dashboard-back" onClick={onBack}>
                <ArrowLeft size={18} />
                <span>Back</span>
            </button>
        </aside>
    );
}

function BalanceCard() {
    const [visible, setVisible] = useState(false);

    return (
        <div className="balance-card glass glass-card">
            <div className="balance-card-header">
                <span className="balance-label">Total Balance</span>
                <button className="balance-toggle" onClick={() => setVisible(!visible)}>
                    {visible ? <Eye size={18} /> : <EyeOff size={18} />}
                </button>
            </div>
            <div className="balance-amount">{visible ? '$12,480.32' : '••••••••'}</div>
            <div className="balance-sub">
                <span>Voxa Checking •••• 4821</span>
            </div>
        </div>
    );
}

function QuickActions() {
    return (
        <div className="quick-actions">
            {quickActions.map(({ icon: Icon, label }) => (
                <button key={label} className="quick-action-btn glass">
                    <span className="quick-action-icon">
                        <Icon size={22} />
                    </span>
                    <span>{label}</span>
                </button>
            ))}
        </div>
    );
}

function TransactionsList() {
    return (
        <div className="transactions-card glass glass-card">
            <div className="transactions-header">
                <h3>Recent Transactions</h3>
                <a href="#" className="view-all-link">View all</a>
            </div>
            <div className="transactions-list">
                {transactions.map((tx, i) => (
                    <div className="transaction-row" key={i}>
                        <div className={`transaction-icon ${tx.type}`}>
                            <tx.icon size={18} />
                        </div>
                        <div className="transaction-info">
                            <span className="transaction-name">{tx.name}</span>
                            <span className="transaction-date">{tx.date}</span>
                        </div>
                        <div className={`transaction-amount ${tx.type}`}>
                            {tx.amount > 0 ? '+' : '-'}${Math.abs(tx.amount).toFixed(2)}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function MainContent() {
    return (
        <main className="dashboard-main-content">
            <div className="dashboard-greeting">
                <h1>Good to see you</h1>
                <p>Here's what's happening with your money today.</p>
            </div>

            <BalanceCard />
            <QuickActions />
            <TransactionsList />
        </main>
    );
}

function AssistantPanel() {
    const [isTyping, setIsTyping] = useState(false);
    const [query, setQuery] = useState('');

    const handleSend = (e) => {
        e.preventDefault();
        if (!query.trim()) return;
        // UI only — no backend wired up yet
        setQuery('');
    };

    return (
        <aside className="assistant-panel">
            <div className="dashboard-card glass glass-card">
                <LeafLogo size={48} />
                <h2 className="dashboard-brand">Voxa Bank AI</h2>

                <button className="dashboard-speak-btn">
                    <Mic size={36} />
                    <span>Speak Now</span>
                </button>

                {!isTyping ? (
                    <button className="dashboard-type-btn glass-pill" onClick={() => setIsTyping(true)}>
                        <span>Type your Queries</span>
                        <ArrowRight size={18} />
                    </button>
                ) : (
                    <form className="query-input-form" onSubmit={handleSend}>
                        <input
                            type="text"
                            className="query-input"
                            placeholder="Ask Voxa anything..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            autoFocus
                        />
                        <button type="submit" className="query-send-btn">
                            <ArrowRight size={18} />
                        </button>
                    </form>
                )}
            </div>
        </aside>
    );
}

function Dashboard({ onBack }) {
    return (
        <div className="dashboard-page">
            <Sidebar onBack={onBack} />
            <MainContent />
            <AssistantPanel />
        </div>
    );
}

export default Dashboard;
