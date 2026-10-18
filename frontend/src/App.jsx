import React, { useState, useEffect } from 'react';
import { Send, Wallet, ShieldCheck, Clock, Mic, MicOff, Activity, ArrowUp, ArrowRight, LogIn, LogOut } from 'lucide-react';
import './App.css';
import Dashboard from './Dashboard.jsx';
import AuthPage from './Auth.jsx';
import { useAuth } from './AuthContext.jsx';

function Navbar({ onAuthClick, onRequestLogout }) {
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
      <div className="navbar-datetime">
        <div className="datetime-block">
          <span className="datetime-label">Date</span>
          <span className="datetime-value">{formatDate(currentTime)}</span>
        </div>
        <div className="datetime-block">
          <span className="datetime-label">Time</span>
          <span className="datetime-value">{formatTime(currentTime)}</span>
        </div>
      </div>

      <nav className="navbar-links glass glass-pill">
        <a href="#home" className="nav-link">Home</a>
        <a href="#features" className="nav-link">Features</a>
        <a href="#try-now" className="nav-link">Try Now</a>
        <a href="#about" className="nav-link">About Us</a>
        {isAuthenticated ? (
          <button
            className="nav-link"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', font: 'inherit' }}
            onClick={onRequestLogout}
            id="navbar-logout-btn"
          >
            <LogOut size={15} /> Sign Out
          </button>
        ) : (
          <button
            className="nav-link"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', font: 'inherit' }}
            onClick={onAuthClick}
            id="navbar-signin-btn"
          >
            <LogIn size={15} /> Sign In
          </button>
        )}
      </nav>
    </header>
  );
}

function Hero({ onGetStarted, onAuthClick, onRequestLogout }) {
  const { isAuthenticated } = useAuth();
  return (
    <section className="hero-section" id="home">
      <div className="hero-bg-overlay"></div>

      <Navbar onAuthClick={onAuthClick} onRequestLogout={onRequestLogout} />

      <div className="hero-content-container container">
        <div className="hero-text-wrapper">
          <h1 className="title-massive">Voxa Bank AI</h1>
          <p className="subtitle">Why Tap When You Can Talk?</p>
        </div>

        <div className="hero-action-wrapper">
          <button
            className="btn-register glass glass-pill"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            onClick={onGetStarted}
            id="hero-get-started-btn"
          >
            {isAuthenticated ? 'Go to Dashboard' : 'Get Started'} <ArrowRight size={20} />
          </button>
        </div>
      </div>
    </section>
  );
}

function TryNow() {
  const [isListening, setIsListening] = useState(false);

  const toggleListening = () => {
    setIsListening(!isListening);
  };

  return (
    <section className="try-now-section container" id="try-now">
      <div className="try-now-header">
        <h2 className="section-title">Experience Voxa</h2>
        <p className="section-subtitle">Tap the microphone to simulate a banking interaction.</p>
      </div>

      <div className={`glass glass-card try-now-card ${isListening ? 'active' : ''}`}>
        <div className="audio-visualizer">
          {isListening ? (
            <div className="wave-container">
              <span className="bar"></span>
              <span className="bar"></span>
              <span className="bar"></span>
              <span className="bar"></span>
              <span className="bar"></span>
            </div>
          ) : (
            <Activity className="icon-idle" size={48} />
          )}
        </div>

        <div className="transcript-box">
          {isListening ? (
            <p className="typing-effect">"Transfer $500 to my savings account..."</p>
          ) : (
            <p className="placeholder-text">Waiting for your voice...</p>
          )}
        </div>

        <button
          className={`mic-button ${isListening ? 'listening' : ''}`}
          onClick={toggleListening}
        >
          {isListening ? <MicOff size={32} /> : <Mic size={32} />}
        </button>
      </div>
    </section>
  );
}

const featuresList = [
  {
    title: 'Voice Transfers',
    description: 'Send money instantly to anyone using natural voice commands. No more typing account numbers.',
    icon: <Send size={32} />
  },
  {
    title: 'Instant Balance',
    description: 'Ask for your balance or recent transactions and get real-time audio and visual feedback.',
    icon: <Wallet size={32} />
  },
  {
    title: 'Voice Biometrics',
    description: 'Your voice is your password. Military-grade secure authentication using unique vocal traits.',
    icon: <ShieldCheck size={32} />
  },
  {
    title: '24/7 Assistance',
    description: 'Get banking support anytime, anywhere without waiting on hold for a human agent.',
    icon: <Clock size={32} />
  }
];

function Features() {
  return (
    <section className="features-section container" id="features">
      <div className="features-header">
        <h2 className="section-title">Seamless Banking</h2>
        <p className="section-subtitle">Everything you need, just a voice command away.</p>
      </div>

      <div className="features-grid">
        {featuresList.map((feature, index) => (
          <div key={index} className="feature-card glass glass-card">
            <div className="feature-icon-wrapper">
              {feature.icon}
            </div>
            <h3 className="feature-title">{feature.title}</h3>
            <p className="feature-description">{feature.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// const teamMembers = [
//   { name: 'Vivek Namburi', role: 'Backend & NLP Engineer', initials: 'VN' },
//   { name: 'Abhi', role: 'Frontend & UI/UX Engineer', initials: 'AB' },
// ];

// function AboutUs() {
//   return (
//     <section className="features-section container" id="about">
//       <div className="features-header">
//         <h2 className="section-title">About Us</h2>
//         <p className="section-subtitle">
//           We're a team of developers passionate about making banking more accessible through voice AI.
//         </p>
//       </div>
//       <div className="features-grid">
//         {teamMembers.map((member) => (
//           <div key={member.name} className="feature-card glass glass-card" style={{ textAlign: 'center' }}>
//             <div
//               className="feature-icon-wrapper"
//               style={{
//                 width: '64px',
//                 height: '64px',
//                 borderRadius: '50%',
//                 background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
//                 display: 'flex',
//                 alignItems: 'center',
//                 justifyContent: 'center',
//                 fontSize: '1.4rem',
//                 fontWeight: 700,
//                 color: '#fff',
//                 margin: '0 auto',
//               }}
//             >
//               {member.initials}
//             </div>
//             <h3 className="feature-title">{member.name}</h3>
//             <p className="feature-description">{member.role}</p>
//           </div>
//         ))}
//       </div>
//     </section>
//   );
// }

function Footer() {
  return (
    <footer className="footer-section">
      <div className="container footer-content">
        <div className="footer-brand">
          <h2>Voxa Bank AI</h2>
          <p>The future of banking is spoken.</p>
        </div>
        <div className="footer-links">
          <div className="link-column">
            <h4>Product</h4>
            <a href="#">Features</a>
            <a href="#">Security</a>
            <a href="#">Pricing</a>
          </div>
          <div className="link-column">
            <h4>Company</h4>
            <a href="#">About Us</a>
            <a href="#">Careers</a>
            <a href="#">Contact</a>
          </div>
          <div className="link-column">
            <h4>Legal</h4>
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <p>&copy; {new Date().getFullYear()} Voxa Bank AI. All rights reserved.</p>
      </div>
    </footer>
  );
}

function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', toggleVisibility);
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  return (
    <div className={`scroll-to-top ${isVisible ? 'visible' : ''}`} onClick={scrollToTop}>
      <ArrowUp size={24} />
    </div>
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
          Are you sure you want to log out of your Voxa account? Your session will end and you will need to sign back in.
        </p>
        <div className="confirm-modal-actions">
          <button type="button" className="btn-modal-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-modal-confirm-logout"
            onClick={onConfirm}
            id="app-confirm-logout-btn"
          >
            <LogOut size={16} />
            <span>Yes, Log Out</span>
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

  // Route to dashboard on successful login / register / session restore
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

  // Show loading spinner while restoring session
  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 40,
            height: 40,
            border: '3px solid rgba(168, 213, 186, 0.2)',
            borderTopColor: 'var(--color-primary)',
            borderRadius: '50%',
            animation: 'spin 0.7s linear infinite',
            margin: '0 auto 1rem',
          }} />
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Loading Voxa…</p>
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
      <Hero
        onGetStarted={() => isAuthenticated ? setView('dashboard') : setView('auth')}
        onAuthClick={() => setView('auth')}
        onRequestLogout={() => setShowLogoutModal(true)}
      />
      <TryNow />
      <Features />
      <Footer />
      <ScrollToTop />

      <ConfirmLogoutModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleConfirmLogout}
      />
    </>
  );
}

export default App;
