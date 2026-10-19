import React, { useState, useEffect } from 'react';
import {
  Send,
  Wallet,
  ShieldCheck,
  Clock,
  Mic,
  MicOff,
  Activity,
  ArrowUp,
  ArrowRight,
  LogIn,
  LogOut,
  CreditCard,
  FileText,
  Receipt,
  Award,
  CheckCircle,
  ChevronRight,
  Lock,
  Sparkles,
  Sliders,
  Shield,
  Eye,
  EyeOff
} from 'lucide-react';
import './App.css';
import Dashboard from './Dashboard.jsx';
import AuthPage from './Auth.jsx';
import { useAuth } from './AuthContext.jsx';
import VoxaLogo from './components/VoxaLogo.jsx';
import SplitFlapText from './components/SplitFlapText.jsx';
import LogoLoop from './components/LogoLoop.jsx';

function Navbar({ onAuthClick, onRequestLogout, onNavigateDashboard }) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDate = (date) => {
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  };

  const formatTime = (date) => {
    const options = { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true };
    return date.toLocaleTimeString('en-US', options);
  };

  return (
    <header className="navbar-container">
      <div className="navbar-brand-group" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
        <VoxaLogo size={34} />
        <span className="navbar-brand-title">
          VOXABANK <span className="navbar-tag">AI CORE</span>
        </span>
      </div>

      <nav className="navbar-links">
        <a href="#home" className="nav-link">Overview</a>
        <a href="#features" className="nav-link">Features</a>
        <a href="#try-now" className="nav-link">Voice Sandbox</a>
        <a href="#card" className="nav-link">Obsidian Card</a>
        <a href="#security" className="nav-link">Security</a>
      </nav>

      <div className="navbar-actions">
        {isAuthenticated ? (
          <>
            <button
              className="btn-nav-ghost"
              onClick={onNavigateDashboard}
              id="navbar-dashboard-btn"
            >
              Dashboard
            </button>
            <button
              className="btn-nav-primary"
              onClick={onRequestLogout}
              id="navbar-logout-btn"
            >
              <LogOut size={15} /> Sign Out
            </button>
          </>
        ) : (
          <button
            className="btn-nav-primary"
            onClick={onAuthClick}
            id="navbar-signin-btn"
          >
            <LogIn size={15} /> Access Portal
          </button>
        )}
      </div>
    </header>
  );
}

function Hero({ onGetStarted, onAuthClick, onRequestLogout, onNavigateDashboard }) {
  const { isAuthenticated } = useAuth();

  const splitFlapWords = [
    'VOICE BANKING',
    'INSTANT SETTLE',
    'RBI COMPLIANT',
    'ZERO FRAUD',
    'AI POWERED',
    'OBSIDIAN CARD'
  ];

  return (
    <section className="hero-section" id="home">
      <div className="hero-glow-orb"></div>

      <div className="container hero-content">
        <div className="hero-badge-wrap">
          <div className="badge-monochrome">
            <span className="badge-monochrome-dot"></span>
            RBI COMPLIANT • REVOLUTIONARY VOICE BANKING PROTOCOL
          </div>
        </div>

        <h1 className="hero-headline">
          THE SPOKEN ENGINE OF <span className="hero-headline-accent">MODERN FINANCE</span>
        </h1>

        {/* Dynamic Mechanical SplitFlap Display */}
        <div className="hero-splitflap-container">
          <div className="splitflap-label">LIVE SYSTEM CAPABILITY MATRIX</div>
          <SplitFlapText
            words={splitFlapWords}
            flipDuration={0.08}
            cycleDelay={2800}
            fontSize={42}
            tileColor="#09090b"
            textColor="#ffffff"
            tileRadius={6}
            gap={5}
            padTo={14}
            align="center"
          />
        </div>

        <p className="hero-desc">
          Say goodbye to complex banking menus and manual typing. VoxaBank is an institutional-grade,
          monochrome financial terminal powered by sub-second voice AI. Transfer funds, adjust card
          limits, pay utility invoices, and export statements — all with your voice.
        </p>

        <div className="hero-actions">
          <button
            className="btn-primary-action"
            onClick={onGetStarted}
            id="hero-get-started-btn"
          >
            {isAuthenticated ? 'Open Banking Dashboard' : 'Open Obsidian Account'}
            <ArrowRight size={18} />
          </button>
          <a href="#try-now" className="btn-secondary-action">
            <Mic size={17} className="hero-mic-icon" /> Test Voice Sandbox
          </a>
        </div>
      </div>
    </section>
  );
}

function PartnerTicker() {
  const partnerBadges = [
    { title: 'RBI DIRECT PROTOCOL', icon: <ShieldCheck size={16} /> },
    { title: 'NPCI UPI 2.0 GATEWAY', icon: <Activity size={16} /> },
    { title: 'VISA PLATINUM NETWORK', icon: <CreditCard size={16} /> },
    { title: 'AES-256 CRYPTO VAULT', icon: <Lock size={16} /> },
    { title: 'WHISPER AI NLP ENGINE', icon: <Mic size={16} /> },
    { title: 'GROQ ULTRA-LOW LATENCY', icon: <Sparkles size={16} /> },
    { title: 'ISO 27001 AUDITED', icon: <Award size={16} /> },
    { title: 'PCI-DSS LEVEL 1 COMPLIANT', icon: <Shield size={16} /> },
  ];

  const logoItems = partnerBadges.map((badge) => ({
    node: (
      <div className="ticker-item-badge">
        {badge.icon}
        <span>{badge.title}</span>
      </div>
    ),
    ariaLabel: badge.title
  }));

  return (
    <section className="ticker-section" id="security">
      <div className="ticker-label">INSTITUTIONAL GRADE SECURITY & FINANCIAL COMPLIANCE</div>
      <LogoLoop
        logos={logoItems}
        speed={45}
        direction="left"
        gap={20}
        pauseOnHover={true}
        scaleOnHover={false}
        fadeOut={true}
        fadeOutWidth={0.15}
      />
    </section>
  );
}

function VoiceSandbox() {
  const [isListening, setIsListening] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState(
    'Transfer ₹5,000 to Ananya for project split'
  );
  const [parsedIntent, setParsedIntent] = useState({
    action: 'P2P_TRANSFER',
    amount: '₹5,000.00',
    recipient: 'Ananya Sharma',
    latency: '9.4 ms',
    confidence: '99.8%',
    hash: '0x8f7c9e2b14a0',
    status: 'READY_TO_SETTLE'
  });

  const samplePrompts = [
    {
      text: 'Transfer ₹5,000 to Ananya for project split',
      intent: {
        action: 'P2P_TRANSFER',
        amount: '₹5,000.00',
        recipient: 'Ananya Sharma',
        latency: '9.4 ms',
        confidence: '99.8%',
        hash: '0x8f7c9e2b14a0',
        status: 'READY_TO_SETTLE'
      }
    },
    {
      text: 'Check my available account balance',
      intent: {
        action: 'BALANCE_INQUIRY',
        amount: '₹142,850.50',
        recipient: 'Primary Account (•••• 7812)',
        latency: '8.1 ms',
        confidence: '99.9%',
        hash: '0x3c99a41e97d2',
        status: 'AUTHENTICATED'
      }
    },
    {
      text: 'Freeze my Obsidian Platinum Card',
      intent: {
        action: 'CARD_LOCK',
        amount: 'N/A',
        recipient: 'Obsidian Debit (•••• 8842)',
        latency: '11.2 ms',
        confidence: '100.0%',
        hash: '0x0d21ff9931bb',
        status: 'CARD_SUSPENDED'
      }
    },
    {
      text: 'Pay electricity bill of ₹2,450 to BESCOM',
      intent: {
        action: 'BILL_PAY',
        amount: '₹2,450.00',
        recipient: 'BESCOM Bangalore Electric',
        latency: '10.3 ms',
        confidence: '99.6%',
        hash: '0xaa412e091560',
        status: 'INVOICE_MATCHED'
      }
    }
  ];

  const handleSelectPrompt = (item) => {
    setSelectedPrompt(item.text);
    setParsedIntent(item.intent);
    setIsListening(true);
    setTimeout(() => {
      setIsListening(false);
    }, 1800);
  };

  const toggleListening = () => {
    setIsListening(!isListening);
  };

  return (
    <section className="sandbox-section" id="try-now">
      <div className="container">
        <div className="section-header-centered">
          <span className="section-eyebrow">NEURAL VOICE INTERACTION SIMULATOR</span>
          <h2 className="section-title">Zero Gestures. Absolute Precision.</h2>
          <p className="section-subtitle">
            Experience our sub-15ms spoken natural language processor. Tap the microphone or click
            any quick prompt chip to simulate live neural voice comprehension and instantaneous execution.
          </p>
        </div>

        <div className="sandbox-console">
          {/* Mic stage and prompt input */}
          <div className="sandbox-card">
            <div className="mic-stage">
              <button
                className={`mic-pulse-button ${isListening ? 'listening' : ''}`}
                onClick={toggleListening}
                aria-label="Toggle voice listener"
              >
                {isListening ? <MicOff size={40} /> : <Mic size={40} />}
              </button>

              <div className="equalizer-wrap">
                {isListening ? (
                  <>
                    <span className="eq-bar"></span>
                    <span className="eq-bar"></span>
                    <span className="eq-bar"></span>
                    <span className="eq-bar"></span>
                    <span className="eq-bar"></span>
                    <span className="eq-bar"></span>
                  </>
                ) : (
                  <Activity size={24} style={{ color: '#52525b' }} />
                )}
              </div>
            </div>

            <div className="transcript-prompt-box">
              {isListening ? (
                <span style={{ color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="badge-monochrome-dot"></span>
                  Listening... "{selectedPrompt}"
                </span>
              ) : (
                <span>"{selectedPrompt}"</span>
              )}
            </div>

            <div className="quick-voice-prompts">
              <span className="prompt-chips-label">Simulate Spoken Commands:</span>
              <div className="chips-row">
                {samplePrompts.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="prompt-chip"
                    onClick={() => handleSelectPrompt(p)}
                  >
                    {p.text}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Terminal / JSON response feedback */}
          <div className="sandbox-terminal">
            <div>
              <div className="terminal-header">
                <span className="terminal-status">
                  <span className="badge-monochrome-dot"></span>
                  VOXABANK_NLU_KERNEL v2.4
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: '#71717a' }}>
                  SSL 256-BIT
                </span>
              </div>

              <div className="terminal-body">
                <div className="response-bubble">
                  {parsedIntent.action === 'P2P_TRANSFER' && (
                    <p>
                      "Confirmed. Prepared transfer of <strong>{parsedIntent.amount}</strong> to{' '}
                      <strong>{parsedIntent.recipient}</strong>. Awaiting your biometric authorization."
                    </p>
                  )}
                  {parsedIntent.action === 'BALANCE_INQUIRY' && (
                    <p>
                      "Your primary account has an available balance of{' '}
                      <strong>{parsedIntent.amount}</strong>. Zero pending holds."
                    </p>
                  )}
                  {parsedIntent.action === 'CARD_LOCK' && (
                    <p>
                      "Obsidian Card <strong>•••• 8842</strong> has been securely suspended. All POS and
                      online gateways are immediately blocked."
                    </p>
                  )}
                  {parsedIntent.action === 'BILL_PAY' && (
                    <p>
                      "Invoice verified for <strong>{parsedIntent.recipient}</strong>. Total due{' '}
                      <strong>{parsedIntent.amount}</strong>. Scheduled for instant settlement."
                    </p>
                  )}
                </div>

                <div className="terminal-meta-grid">
                  <div className="meta-field">
                    <span className="meta-key">ACTION</span>
                    <span className="meta-val">{parsedIntent.action}</span>
                  </div>
                  <div className="meta-field">
                    <span className="meta-key">NLU LATENCY</span>
                    <span className="meta-val">{parsedIntent.latency}</span>
                  </div>
                  <div className="meta-field">
                    <span className="meta-key">CONFIDENCE</span>
                    <span className="meta-val">{parsedIntent.confidence}</span>
                  </div>
                  <div className="meta-field">
                    <span className="meta-key">AUDIT HASH</span>
                    <span className="meta-val">{parsedIntent.hash}</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid #18181b' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: '#a1a1aa' }}>
                STATUS: {parsedIntent.status}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ComprehensiveFeatures() {
  const completeFeatures = [
    {
      num: '01',
      title: 'Voice-Driven Banking Core',
      icon: <Mic size={26} />,
      desc: 'Execute account transfers, inquiry checks, and complex statement filtering using natural spoken language with zero latency.',
      tags: ['Whisper AI', 'Intent Matching', 'Sub-15ms Response']
    },
    {
      num: '02',
      title: 'P2P Instant Ledger & UPI',
      icon: <Send size={26} />,
      desc: 'Seamless peer-to-peer transfers with integrated user directory lookup, contact validation, and instant recipient ledger updates.',
      tags: ['Verified Directory', '₹0 Wire Fee', '24/7 Settle']
    },
    {
      num: '03',
      title: 'Obsidian Virtual Debit Card',
      icon: <CreditCard size={26} />,
      desc: 'Full programmatic card controls. Instant toggle freeze/unfreeze, contactless tap limits, dynamic CVV, and domestic/international locks.',
      tags: ['Instant Freeze', 'Dynamic CVV', 'Spending Caps']
    },
    {
      num: '04',
      title: 'Utility Bill Pay & Deposits',
      icon: <Receipt size={26} />,
      desc: 'Pay electricity, water, and broadband invoices instantly with automatic balance debiting, plus 0% fee deposit top-ups anytime.',
      tags: ['BESCOM/Airtel', 'Instant Receipts', 'Zero Surcharge']
    },
    {
      num: '05',
      title: 'Audit Trail & CSV Export',
      icon: <FileText size={26} />,
      desc: 'Comprehensive historical reporting. Filter transactions by date, category, or amount, and export cryptographic CSV tax statements.',
      tags: ['Instant CSV', 'Tax Analytics', 'Audit Trail']
    },
    {
      num: '06',
      title: 'RBI Grounded Security Shield',
      icon: <ShieldCheck size={26} />,
      desc: 'Engineered with bank-grade security protocols adhering strictly to RBI digital banking norms, automatic timeout, and encryption.',
      tags: ['RBI Norms', 'AES-256 GCM', 'Biometric Lock']
    }
  ];

  return (
    <section className="features-section" id="features">
      <div className="container">
        <div className="section-header-centered">
          <span className="section-eyebrow">ALL-INCLUSIVE ARCHITECTURE</span>
          <h2 className="section-title">The Complete Financial Suite</h2>
          <p className="section-subtitle">
            Every feature of our modern banking ecosystem engineered into a unified, high-performance
            monochrome interface. No hidden menus. No bloat.
          </p>
        </div>

        <div className="features-grid-complete">
          {completeFeatures.map((item, idx) => (
            <div key={idx} className="feature-box">
              <div>
                <div className="feature-top">
                  <div className="feature-icon-monochrome">{item.icon}</div>
                  <span className="feature-number">{item.num}</span>
                </div>
                <h3 className="feature-heading">{item.title}</h3>
                <p className="feature-body-text">{item.desc}</p>
              </div>

              <div className="feature-tag-list">
                {item.tags.map((tag, tIdx) => (
                  <span key={tIdx} className="feature-micro-tag">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ObsidianCardShowcase() {
  const [isFrozen, setIsFrozen] = useState(false);
  const [contactless, setContactless] = useState(true);
  const [international, setInternational] = useState(false);
  const [onlineSpend, setOnlineSpend] = useState(true);

  return (
    <section className="card-showcase-section" id="card">
      <div className="container">
        <div className="card-showcase-grid">
          {/* Left: Card visual */}
          <div className="card-visual-wrapper">
            <div className={`obsidian-card ${isFrozen ? 'card-frozen' : ''}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '0.05em', color: '#ffffff' }}>
                  VOXABANK
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: isFrozen ? '#ef4444' : '#a1a1aa' }}>
                  {isFrozen ? 'CARD FROZEN' : 'ACTIVE PLATINUM'}
                </span>
              </div>

              <div className="card-hologram-chip"></div>

              <div>
                <div className="card-number-embossed">
                  4912 •••• •••• 8842
                </div>
                <div className="card-details-row" style={{ marginTop: '1.25rem' }}>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: '#71717a', textTransform: 'uppercase' }}>Cardholder</div>
                    <div className="card-holder-name">ALEXANDER R. VANCE</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: '#71717a', textTransform: 'uppercase' }}>Expires</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: '#d4d4d8' }}>09/29</div>
                  </div>
                  <div className="card-network-logo">VISA</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Interactive controls */}
          <div className="card-control-box">
            <div>
              <span className="section-eyebrow">PROGRAMMATIC CARD CONTROLS</span>
              <h3 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.03em', marginTop: '0.3rem' }}>
                Instant Security Toggles
              </h3>
              <p style={{ fontSize: '0.92rem', color: '#a1a1aa', marginTop: '0.5rem', lineHeight: '1.6' }}>
                Toggle card controls via voice or live switches. Changes take effect across global POS and online networks in under 200 milliseconds.
              </p>
            </div>

            <div>
              <div className="control-toggle-row">
                <div className="control-info">
                  <h4>Freeze Obsidian Card</h4>
                  <p>Immediately blocks all transactions and POS debits.</p>
                </div>
                <div
                  className={`toggle-switch-demo ${isFrozen ? '' : 'off'}`}
                  onClick={() => setIsFrozen(!isFrozen)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="toggle-thumb"></div>
                </div>
              </div>

              <div className="control-toggle-row">
                <div className="control-info">
                  <h4>Contactless Tap & Pay</h4>
                  <p>Allow NFC tap payments up to ₹5,000 without PIN.</p>
                </div>
                <div
                  className={`toggle-switch-demo ${contactless ? '' : 'off'}`}
                  onClick={() => setContactless(!contactless)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="toggle-thumb"></div>
                </div>
              </div>

              <div className="control-toggle-row">
                <div className="control-info">
                  <h4>International Usage</h4>
                  <p>Authorize global currencies and cross-border settlement.</p>
                </div>
                <div
                  className={`toggle-switch-demo ${international ? '' : 'off'}`}
                  onClick={() => setInternational(!international)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="toggle-thumb"></div>
                </div>
              </div>

              <div className="control-toggle-row">
                <div className="control-info">
                  <h4>E-Commerce & Online Spend</h4>
                  <p>Allow payment gateways and web merchant transactions.</p>
                </div>
                <div
                  className={`toggle-switch-demo ${onlineSpend ? '' : 'off'}`}
                  onClick={() => setOnlineSpend(!onlineSpend)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="toggle-thumb"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function InstitutionalMetrics() {
  return (
    <section className="metrics-section">
      <div className="container">
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-big-num">&lt;11ms</div>
            <div className="metric-label">Neural NLU Latency</div>
          </div>
          <div className="metric-card">
            <div className="metric-big-num">99.99%</div>
            <div className="metric-label">Core Ledger Uptime</div>
          </div>
          <div className="metric-card">
            <div className="metric-big-num">₹0</div>
            <div className="metric-label">P2P Wire & Transfer Surcharge</div>
          </div>
          <div className="metric-card">
            <div className="metric-big-num">256-bit</div>
            <div className="metric-label">Hardware-Sealed AES Vault</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer({ onGoToDashboard }) {
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  return (
    <footer className="render-footer-section">
      {/* Warm Ambient Spotlight Glow */}
      <div className="render-footer-glow" />

      <div className="render-footer-container">
        {/* Main CTA Centerpiece */}
        <div className="render-cta-hero">
          <h2 className="render-cta-title">
            Ready to <span className="render-cta-italic">bank?</span>
          </h2>
          <p className="render-cta-subtitle">
            Experience the institutional spoken banking terminal. All ledgers synced in real time.
          </p>
          <button
            type="button"
            className="render-cta-button"
            onClick={onGoToDashboard}
            id="footer-go-to-dashboard-btn"
          >
            <span>Go to dashboard</span>
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Divider Line */}
        <div className="render-footer-divider" />

        {/* 3-Column Info Bar */}
        <div className="render-footer-bar">
          <div className="render-bar-col left">
            &copy; {new Date().getFullYear()} VoxaBank AI
          </div>
          <div className="render-bar-col center">
            Dreamt by mind, built by algorithms <span className="render-star">✦</span>
          </div>
          <div className="render-bar-col right">
            <button type="button" className="render-back-to-top" onClick={scrollToTop}>
              Back to top &uarr;
            </button>
          </div>
        </div>
      </div>

      {/* Giant Bottom Watermark Typography */}
      <div className="render-watermark-container" aria-hidden="true">
        <span className="render-watermark-text">VOXABANK</span>
      </div>
    </footer>
  );
}



function ConfirmLogoutModal({ isOpen, onClose, onConfirm }) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card confirm-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-modal-icon">
          <LogOut size={28} />
        </div>
        <h3 className="confirm-modal-title">Sign Out of Voxa</h3>
        <p className="confirm-modal-desc">
          Are you sure you want to terminate your secure session? Your cryptographic connection will be
          safely closed until your next authentication.
        </p>
        <div className="confirm-modal-actions">
          <button type="button" className="btn-modal-cancel" onClick={onClose}>
            Stay Connected
          </button>
          <button
            type="button"
            className="btn-modal-confirm-logout"
            onClick={onConfirm}
            id="app-confirm-logout-btn"
          >
            <LogOut size={16} />
            <span>Confirm Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [view, setView] = useState('home'); // 'home' | 'auth' | 'dashboard'
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Route to dashboard on successful login / session restore
  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        setView((prev) => (prev === 'auth' || prev === 'home' ? 'dashboard' : prev));
      } else {
        setView((prev) => (prev === 'dashboard' ? 'home' : prev));
      }
    }
  }, [isAuthenticated, isLoading]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  const handleConfirmLogout = async () => {
    setShowLogoutModal(false);
    await logout();
    setView('home');
  };

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#000000',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 44,
              height: 44,
              border: '3px solid rgba(255, 255, 255, 0.1)',
              borderTopColor: '#ffffff',
              borderRadius: '50%',
              animation: 'spin 0.7s linear infinite',
              margin: '0 auto 1.25rem',
            }}
          />
          <p style={{ color: '#a1a1aa', fontSize: '0.88rem', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
            INITIALIZING VOXA KERNEL…
          </p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (view === 'auth' && !isAuthenticated) {
    return <AuthPage onBack={() => setView('home')} />;
  }

  if (view === 'dashboard' && isAuthenticated) {
    return <Dashboard key={user?.id || 'dashboard'} onBack={() => setView('home')} />;
  }

  return (
    <>
      <Navbar
        onAuthClick={() => setView('auth')}
        onRequestLogout={() => setShowLogoutModal(true)}
        onNavigateDashboard={() => setView('dashboard')}
      />
      <Hero
        onGetStarted={() => (isAuthenticated ? setView('dashboard') : setView('auth'))}
      />
      <PartnerTicker />
      <VoiceSandbox />
      <ComprehensiveFeatures />
      <ObsidianCardShowcase />
      <InstitutionalMetrics />
      <Footer onGoToDashboard={() => (isAuthenticated ? setView('dashboard') : setView('auth'))} />

      <ConfirmLogoutModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleConfirmLogout}
      />
    </>
  );
}

export default App;
