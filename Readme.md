# 🎙️ VoxaBank — Voice-Enabled AI Banking Assistant

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI%200.115-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React%2019%20+%20Vite-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![PyTorch](https://img.shields.io/badge/AI-PyTorch%20%7C%20Transformers%20%7C%20PEFT-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white)](https://pytorch.org/)
[![Supabase](https://img.shields.io/badge/Database-Supabase%20%28PostgreSQL%29-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](#license)

**VoxaBank** is a state-of-the-art, voice-first intelligent banking platform. It combines automated Speech Recognition (STT), high-efficiency Natural Language Understanding (NLU), multi-turn dialog state tracking, and Retrieval-Augmented Generation (RAG) strictly grounded in official **Reserve Bank of India (RBI)** regulations.

Users can execute financial transactions, control virtual debit cards, pay utility bills, query live ledger balances, and receive context-aware regulatory advice through voice commands or interactive chat.

---

## 📑 Table of Contents

- [System Architecture](#-system-architecture)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [Project Directory Structure](#-project-directory-structure)
- [Database Schema (Supabase)](#-database-schema-supabase)
- [Environment Configuration](#-environment-configuration)
- [Installation & Local Setup](#-installation--local-setup)
- [Running the AI Pipeline Standalone](#-running-the-ai-pipeline-standalone)
- [REST API Reference](#-rest-api-reference)
- [AI & NLU Pipeline Details](#-ai--nlu-pipeline-details)
- [Security & Compliance](#-security--compliance)
- [License](#-license)

---

## 🏛️ System Architecture

```
                                  VOICE / TEXT INPUT
                                          │
                                          ▼
                         ┌─────────────────────────────────┐
                         │      Speech-to-Text (STT)       │
                         │   Whisper / Web Speech Engine   │
                         └────────────────┬────────────────┘
                                          │ Transcribed Text
                                          ▼
                         ┌─────────────────────────────────┐
                         │   High-Efficiency NLU (LLM 1)   │
                         │  • Intent Detection (20 Intents)│
                         │  • Sub-Intents (72 Sub-types)   │
                         │  • Regex & Entity Slot Filling  │
                         └────────────────┬────────────────┘
                                          │ {intent, sub_intent, slots}
                                          ▼
                         ┌─────────────────────────────────┐
                         │    Intelligent Dialog Manager   │
                         │  • Two-turn Confirmation (Y/N)  │
                         │  • Pronoun / Anaphora Resolver  │
                         │  • Live Balance & Ledger Guard  │
                         └──────────────┬───┬──────────────┘
                                        │   │
                  Action Execution / Tx │   │ Regulatory / Banking Rules
                                        │   │
                                        │   ▼
                                        │ ┌───────────────────────────┐
                                        │ │    RBI RAG Retriever      │
                                        │ │ • Sentence-Transformers   │
                                        │ │ • Vector Knowledge Index  │
                                        │ └─────────────┬─────────────┘
                                        │               │
                                        ▼               ▼
                         ┌─────────────────────────────────┐
                         │ Grounded Conversational Gen     │
                         │  • Zero-Hallucination Responder │
                         │  • Causal LLM 2 / Qwen2.5 Engine│
                         └────────────────┬────────────────┘
                                          │ Synthesized Text
                                          ▼
                         ┌─────────────────────────────────┐
                         │      Text-to-Speech (TTS)       │
                         │       gTTS / Web Speech API     │
                         └────────────────┬────────────────┘
                                          │
                                          ▼
                                   SPOKEN RESPONSE
```

---

## ✨ Key Features

### 🎙️ Conversational Voice Banking
- **Speech-to-Text & Text-to-Speech**: Full bidirectional voice support with ambient noise resilience.
- **Multi-Turn Context Tracking**: Handles confirmations (*"Send 500 to Vivek"* ➔ *"Confirm transfer of ₹500 to Vivek via UPI?"* ➔ *"Yes"*), mid-confirmation amount changes (*"make it 700 instead"*), and balance inquiries.
- **Anaphora Resolution**: Contextual pronoun awareness (*"Send another ₹200 to him"*, *"Repeat last transfer"*).

### 💳 Virtual Debit Card Management
- **Instant Freeze / Unfreeze**: One-click lock to block ATM, POS, and online transactions.
- **Granular Channel Toggles**: Independently control Domestic, International/Forex, Online E-Commerce, and ATM cash withdrawals.
- **Dynamic Limit Sliders**: Real-time spending limits from ₹5,000 to ₹2,00,000.

### 💸 Real-Time P2P Fund Transfers & Verification
- **Verified Recipient Lookup**: Auto-verifies recipients across registered users via Email, Name, or Voxa UUID.
- **Self-Transfer Prevention**: Built-in guardrails blocking self-transfers.
- **Multi-rail Payment Support**: Handles UPI, IMPS, NEFT, and RTGS with transaction limits matching RBI standards.
- **Instant Digital Receipts**: Auto-generated reference IDs with ledger synchronization.

### ⚡ Utility Bill Payments & Deposits
- **Utility Biller Integrations**: Electricity & Gas, Broadband Fiber, Mobile Postpaid, Rent & Property.
- **Zero-Fee Deposits**: Top-up savings balance instantly via UPI, NetBanking, IMPS, or NEFT.

### 📊 Financial Statements & Cash Flow Analytics
- **Live Ledger Reconciliation**: Server-backed audit log ensuring consistent balances across incognito tabs, devices, and sessions.
- **KPI Metrics**: Real-time monthly Inflow, Outflow, and Net Cash Flow summaries.
- **CSV & Print Export**: RFC-compliant CSV transaction download and dedicated print-friendly statement layout.

### 🛡️ RBI Grounded Regulatory Guidance
- Grounded Q&A for RBI customer protection rules, unauthorized electronic transactions, Zero Liability criteria, and Banking Ombudsman timelines.

---

## 🛠️ Tech Stack

| Domain | Technologies |
|---|---|
| **Backend API** | FastAPI, Uvicorn, Pydantic v2, Pydantic Settings, SlowAPI |
| **Authentication** | JWT (Python-Jose), Passlib (Bcrypt), OAuth2 Password Bearer |
| **Database** | Supabase (PostgreSQL with Row Level Security & Triggers), asyncpg |
| **Frontend** | React 19, Vite, React Router DOM v7, Axios, Lucide React |
| **Styling** | Custom Vanilla CSS (Modern Dark Glassmorphism Design System) |
| **Speech Processing** | OpenAI Whisper, gTTS, Web Speech Recognition & Synthesis API |
| **NLP & AI Engine** | PyTorch, Hugging Face Transformers, PEFT (LoRA), Sentence-Transformers |
| **Deployment** | Vercel Serverless (`vercel.json`), Docker-compatible |

---

## 📂 Project Directory Structure

```text
Voice-enabled-banking-assistant/
├── Readme.md                          # Root Project Documentation
├── vercel.json                        # Vercel deployment configuration
├── pyrightconfig.json                 # Python type checker configuration
│
├── backend/
│   ├── main.py                        # FastAPI entry point & global middleware
│   ├── config.py                      # Pydantic environment configuration
│   ├── database.py                    # Supabase client singleton
│   ├── dependencies.py                # Security & auth dependencies
│   ├── schemas.py                     # Request / Response Pydantic models
│   ├── security.py                    # JWT token creation & bcrypt password hashing
│   ├── supabase_schema.sql            # Supabase database setup & audit log schema
│   ├── requirements.txt               # Backend Python dependencies
│   ├── run_server.bat                 # Windows quickstart batch script
│   │
│   ├── routers/
│   │   ├── auth.py                    # Register, login, refresh, profile routes
│   │   ├── banking.py                 # P2P transfers, deposits, bills, ledger sync
│   │   └── voice.py                   # Voice assistant dialog endpoint
│   │
│   └── ai/
│       ├── assistant.py               # Complete pipeline: NLU + Dialog + RAG + TTS
│       ├── banking.py                 # Dialog manager, slot rules & MockBank state
│       ├── nlu.py                     # Intent & entity extraction engine
│       ├── rag.py                     # Vector index builder & RBI retriever
│       ├── common.py                  # Normalization, regexes & slot extractors
│       ├── stt_noise.py               # Acoustic noise augmentation module
│       ├── prepare_data.py            # Train/validation/test data preprocessor
│       ├── train_llm1.py              # LoRA fine-tuning script for NLU
│       ├── evaluate_stt_robustness.py # Robustness benchmarking on noisy transcripts
│       ├── requirements.txt           # AI & ML specific dependencies
│       └── data/
│           ├── intent_detection.csv   # 2,000 labeled intent/sub-intent dataset
│           ├── stt_evaluation.csv     # Reference and noisy transcript evaluation pairs
│           └── rbi/                   # RBI regulatory circulars (.txt, .pdf, .md)
│
└── frontend/
    ├── index.html                     # HTML root template
    ├── package.json                   # NPM dependencies and scripts
    ├── vite.config.js                 # Vite build settings
    └── src/
        ├── main.jsx                   # React root entry
        ├── App.jsx                    # Routing & auth guard wrapper
        ├── App.css                    # App layout styles
        ├── Auth.jsx                   # Login & registration screen
        ├── Auth.css                   # Glassmorphism auth styling
        ├── AuthContext.jsx            # User state & authentication provider
        ├── Dashboard.jsx              # Main banking dashboard & voice modal
        ├── Dashboard.css              # Dashboard component styling
        ├── api.js                     # Axios client with JWT auto-refresh interceptors
        └── index.css                  # Core design tokens and reset styles
```

---

## 🗄️ Database Schema (Supabase)

Initialize the PostgreSQL schema by executing `backend/supabase_schema.sql` in the **Supabase SQL Editor**:

```sql
-- 1. Users Table
CREATE TABLE IF NOT EXISTS public.users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name     TEXT NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 80),
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_active     BOOLEAN DEFAULT TRUE,
    is_verified   BOOLEAN DEFAULT FALSE,
    created_at    TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at    TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Audit & Ledger Table (Powers persistent transaction balance)
CREATE TABLE IF NOT EXISTS public.audit_log (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID REFERENCES public.users(id) ON DELETE SET NULL,
    event_type  TEXT NOT NULL, -- TRANSFER_DEBIT, TRANSFER_CREDIT, DEPOSIT, BILL_PAY, etc.
    ip_address  TEXT,
    user_agent  TEXT,
    metadata    JSONB,
    created_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
```

---

## ⚙️ Environment Configuration

### 1. Backend Configuration (`backend/.env`)

Copy `backend/.env.example` to `backend/.env` and update the parameters:

```env
DEBUG=False
APP_NAME="Voxa Bank AI"
APP_VERSION="1.0.0"

# Generate with: python -c "import secrets; print(secrets.token_hex(32))"
JWT_SECRET_KEY=your_64_character_hex_secret_key_here
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Supabase Credentials (from Dashboard -> Settings -> API)
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_public_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_secret_key
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT_ID.supabase.co:5432/postgres

# CORS Origins (JSON formatted array)
ALLOWED_ORIGINS=["http://localhost:5173","http://localhost:3000"]

# Rate Limiting
RATE_LIMIT_GLOBAL="60/minute"
RATE_LIMIT_LOGIN="5/minute"
RATE_LIMIT_REGISTER="3/minute"
```

### 2. Frontend Configuration (`frontend/.env`)

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000/api
```

---

## 🚀 Installation & Local Setup

### Prerequisites
- **Python 3.10+**
- **Node.js 18+ & npm**
- **FFmpeg** (Required for Whisper audio decoding)
  - *Ubuntu/Debian*: `sudo apt install ffmpeg`
  - *Windows*: `winget install Gyan.FFmpeg` or `choco install ffmpeg`
  - *macOS*: `brew install ffmpeg`

---

### Step 1: Set Up Backend

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On Linux / macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start backend development server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The backend API will be available at: `http://localhost:8000`  
Interactive Swagger Docs: `http://localhost:8000/api/docs` *(When `DEBUG=True`)*

---

### Step 2: Set Up Frontend

```bash
cd ../frontend

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```

The frontend dashboard will run at: `http://localhost:5173`

---

## 🧠 Running the AI Pipeline Standalone

The AI pipeline inside `backend/ai/` can run independently as a CLI test tool or as an interactive Gradio web app:

```bash
cd backend/ai

# Install AI dependencies
pip install -r requirements.txt

# 1. Build or re-index the RBI RAG Vector Database
python rag.py build

# 2. Run CLI interactive mode
python assistant.py --cli

# 3. Run Gradio Voice Testing Interface (Microphone + Audio response)
python assistant.py
```

---

## 📡 REST API Reference

### 🔐 Authentication (`/api/auth`)

| Method | Endpoint | Description | Auth Required |
|---|---|---|:---:|
| `POST` | `/api/auth/register` | Register new account with name, email & password | No |
| `POST` | `/api/auth/login` | Authenticate user & issue JWT Access + Refresh token | No |
| `POST` | `/api/auth/refresh` | Rotate access token using valid refresh token | No |
| `GET` | `/api/auth/me` | Fetch authenticated user profile & verification status | Yes |
| `POST` | `/api/auth/logout` | Invalidate active session | Yes |

### 💳 Banking Operations (`/api/banking`)

| Method | Endpoint | Description | Auth Required |
|---|---|---|:---:|
| `POST` | `/api/banking/verify-recipient` | Verify recipient existence by Email, Name, or UUID | Yes |
| `GET` | `/api/banking/users` | List eligible registered users for P2P transfers | Yes |
| `POST` | `/api/banking/transfer` | Execute peer-to-peer transfer (debts sender, credits recipient) | Yes |
| `POST` | `/api/banking/deposit` | Add funds via UPI, IMPS, NEFT, or NetBanking | Yes |
| `POST` | `/api/banking/bill-pay` | Process utility bill payment | Yes |
| `GET` | `/api/banking/state` | Reconcile live user balance and full ledger transactions | Yes |
| `POST` | `/api/banking/sync-balance` | Initialize or synchronize initial account balance | Yes |

### 🎙️ Voice Assistant (`/api/voice`)

| Method | Endpoint | Description | Auth Required |
|---|---|---|:---:|
| `POST` | `/api/voice/chat` | Process natural speech/text query with NLU, Dialog Manager & RAG | Optional |

#### Example Request: `POST /api/voice/chat`
```json
{
  "query": "Transfer 1500 rupees to Vivek for dinner",
  "session_id": "session_u10293",
  "current_balance": 45000.0,
  "user_name": "Abhishek Sharma"
}
```

#### Example Response:
```json
{
  "transcript": "Transfer 1500 rupees to Vivek for dinner",
  "bot_response": "Confirm Transfer: Send ₹1,500 to Vivek (Food & Dining) via UPI? Say Yes to execute or No to cancel.",
  "intent": "transfer_money",
  "sub_intent": "upi_transfer",
  "status": "confirm",
  "action_payload": {
    "action": "confirm_transfer",
    "amount": 1500,
    "recipient": "Vivek",
    "category": "Food & Dining"
  },
  "updated_balance": 45000.0
}
```

---

## 🔬 AI & NLU Pipeline Details

### 1. Intent Detection Dataset
- Contains **20 primary banking intents** and **72 specific sub-intents**:
  - `check_balance` (*savings, current, fd, rd*)
  - `transfer_money` (*upi, neft, rtgs, imps, repeat_transfer*)
  - `card_management` (*freeze_card, unfreeze_card, set_limits, channel_control*)
  - `bill_payment` (*electricity, gas, broadband, mobile, rent*)
  - `statement_analytics` (*inflow, outflow, download_csv, view_recent*)
  - `rbi_guidelines` (*fraud_liability, transfer_limits, ombudsman_complaint*)
  - `banking_profile` (*ifsc_code, account_details, kyc_status*)

### 2. Speech Noise Augmentation & Robustness
`stt_noise.py` simulates real-world acoustic variations during training and evaluation:
- Acoustic phoneme confusion substitutions
- Number-to-word and word-to-number alternations (*"five hundred"* vs *"500"*)
- Fillers and disfluencies (*"uh"*, *"um"*, *"actually"*, *"bhai"*, *"please"*)
- Indian English & Hinglish colloquialisms (*"send karo"*, *"paise bhejo"*, *"transfer kar do"*)

### 3. Model Training & Evaluation Scripts

```bash
# Preprocess and split intent datasets (deduping & train/val/test split)
python backend/ai/prepare_data.py

# Fine-tune LLM 1 with LoRA adapters
python backend/ai/train_llm1.py

# Benchmark STT transcript robustness on noisy vs clean speech
python backend/ai/evaluate_stt_robustness.py
```

---

## 🔒 Security & Compliance

- **XSS & Injection Protection**: Access tokens are kept strictly in-memory in the client React layer; headers implement `X-Content-Type-Options: nosniff` and strict Content Security Policies (`CSP`).
- **CSRF & Origin Isolation**: Controlled CORS allowlists (`ALLOWED_ORIGINS`) and required `X-Requested-With` request headers.
- **Rate Limiting**: Tiered endpoint throttling via `slowapi` (3 registrations/min, 5 logins/min, 60 requests/min global).
- **Zero-Hallucination Dialog Guard**: The conversational responder is strictly constrained by prompt rules: account facts are drawn exclusively from deterministic execution returns, while policy explanations are restricted to retrieved RBI chunks.
- **Database Isolation**: PostgreSQL Row Level Security (RLS) blocks client direct queries; access is brokered through the backend service layer with strict role permissions.

---

## 👥 Team & Technical Contributions

| Member Name | Contribution (Technical) |
| :--- | :--- |
| **Pasumarthy Abhinav** | Frontend, backend APIs, database and system integration |
| **Namburi Vivek** | Speech-to-Text, Text-to-Speech, speech recognition evaluation; RAG-based banking knowledge retrieval |
| **Rudraraju Ethish** | NLP and AI pipeline; LLM integration; query understanding and response generation |

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
