"""
Comprehensive End-to-End Edge Case & Feature Test Suite for VoxaBank Assistant.
Covers:
1. Account Overview & Dynamic Greetings
2. Privacy Toggle & Balance Masking (••••••••)
3. P2P Fund Transfers & Recipient Database Verification
4. Self-Transfer Guard & Overdraft Guard
5. Multi-turn Conversational Slot Filling & Cancellation
6. Alphanumeric UPI IDs & Case-Insensitive Recipient Handling
7. Mode Rules & Limit Enforcement (UPI, IMPS, NEFT, RTGS)
8. Virtual Platinum Debit Card Credentials, CVV & Instant Freeze/Unfreeze
9. Granular Spending Limit Sliders (Daily ₹5k-₹200k, Per-Txn ₹1k-₹100k) & Out-of-Bound Edge Cases
10. Channel Controls (Forex, Domestic, Online, ATM)
11. Deposit Funds (0% fee UPI & NetBanking) with Balance Accrual
12. Utility Bill Payments (Broadband Fiber, Rent & Property, Electricity & Gas, Mobile Postpaid)
13. Statement KPI Metrics, Credit/Debit Filtering & Search
14. RFC-Compliant CSV Ledger Export & Print Layout
15. Profile Identifiers (IFSC VOXA0001824, KYC Active, Tier, 2FA & Email Alerts)
16. RBI Regulatory Inquiries & Out-of-Scope Handling
17. Audio In-Memory Preprocessing & Transcription Robustness (simulated PCM waveforms)
"""
import datetime
import os
import sys
import time

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Ensure offline loading for speed and stability
os.environ["HF_HUB_OFFLINE"] = "1"

import numpy as np
from assistant import Assistant
from banking import MockBank, handle
from common import extract_slots
from nlu import NLU
from rag import RBIRetriever


def run_e2e_tests():
    print("=" * 85)
    print("      VOXABANK ASSISTANT: COMPREHENSIVE END-TO-END & EDGE-CASE TEST SUITE")
    print("=" * 85)

    bot = Assistant(load_stt=True)
    tests_passed = 0
    total_tests = 0

    def assert_test(test_id, category, description, query, expected_in_response, session=None, setup_fn=None):
        nonlocal tests_passed, total_tests
        total_tests += 1
        s = session if session is not None else {}
        if setup_fn:
            setup_fn(bot.bank)

        t0 = time.time()
        resp = bot.reply(query, s)
        elapsed_ms = (time.time() - t0) * 1000

        matched = False
        if isinstance(expected_in_response, list):
            matched = any(exp.lower() in resp.lower() for exp in expected_in_response)
        else:
            matched = expected_in_response.lower() in resp.lower()

        status_str = "PASS" if matched else "FAIL"
        if matched:
            tests_passed += 1

        print(f"\n[{status_str}] Test {test_id:02d} | {category}")
        print(f"       Description: {description}")
        print(f"       User Query:  \"{query}\"")
        print(f"       Bot Answer:  \"{resp}\"")
        print(f"       Latency:     {elapsed_ms:.1f} ms")
        if not matched:
            print(f"       ERROR: Expected substring '{expected_in_response}' not found in response!")
        return s

    print("\n" + "#" * 40 + " CATEGORY 1: DASHBOARD & PRIVACY TOGGLE " + "#" * 40)
    # 1. Dynamic greeting & overview
    assert_test(1, "Dashboard", "Time-adapted greeting and overview summary",
                "Good morning, show my account overview", "Welcome to VoxaBank")

    # 2. Privacy toggle: Mask balance
    assert_test(2, "Privacy", "Toggle privacy mode ON to mask balance with dots",
                "Hide my account balance with dots", "masked (••••••••)")

    # 3. Check balance while masked
    assert_test(3, "Privacy", "Verify balance query returns masked bullets when privacy is ON",
                "What is my current savings balance?", "••••••••")

    # 4. Privacy toggle: Unmask balance
    assert_test(4, "Privacy", "Toggle privacy mode OFF to reveal balance",
                "Unhide my balance", "revealed")

    # 5. Check balance while unmasked
    assert_test(5, "Dashboard", "Verify balance query returns exact INR amount when unmasked",
                "What is my current savings balance?", "50,000")

    print("\n" + "#" * 40 + " CATEGORY 2: P2P TRANSFERS & SAFETY GUARDS " + "#" * 40)
    # 6. Registered Beneficiaries Strip
    assert_test(6, "P2P Transfers", "Display registered beneficiaries avatar chips",
                "Show my registered beneficiaries", "Priya")

    # 7. Recipient DB verification - Valid User
    assert_test(7, "P2P Transfers", "Verify registered recipient in database",
                "Verify recipient Priya before transfer", "Verified! Priya is an active registered")

    # 8. Recipient DB verification - Invalid User (Edge Case)
    assert_test(8, "P2P Transfers", "Reject non-existent recipient verification",
                "Verify recipient unknown_ghost_user", "Verification failed")

    # 9. Self-Transfer Guard (Edge Case)
    assert_test(9, "Safety Guards", "Prevent transfer to own account (myself)",
                "Send 2000 rupees to myself", "Self-transfer guard activated")

    # 10. Self-Transfer Guard alternate phrasing
    assert_test(10, "Safety Guards", "Prevent transfer to own account (my own account)",
                "Transfer 1000 to my own account", "Self-transfer guard activated")

    # 11. Overdraft Guard (Edge Case)
    assert_test(11, "Safety Guards", "Prevent transfer exceeding savings balance",
                "Send 90000 rupees to Ravi via UPI", "Insufficient funds")

    # 12. Full P2P Transfer with Category & Memo -> Confirm -> YES
    s_p2p = {}
    assert_test(12, "P2P Transfers", "Transfer money with category and memo",
                "Transfer 1500 to Priya for dinner bill via UPI", "Confirm Transfer: Send ₹1,500 to Priya (Dining & Food)", s_p2p)
    assert_test(13, "P2P Transfers", "Confirm transfer with YES",
                "yes", "Transfer Successful! Sent ₹1,500 to Priya", s_p2p)

    # 14. Transfer Cancellation -> NO (Edge Case)
    s_cancel = {}
    assert_test(14, "P2P Transfers", "Initiate transfer then cancel with NO",
                "Send 500 to Ravi", "Confirm Transfer", s_cancel)
    assert_test(15, "P2P Transfers", "Cancel pending transaction",
                "no", "Cancelled. No transaction was executed", s_cancel)

    # 16. Multi-turn step-by-step: Amount First, Recipient Second
    s_step1 = {}
    assert_test(16, "Multi-Turn", "Incomplete transfer prompt",
                "transfer money", "Please provide the transfer amount and the recipient name", s_step1)
    assert_test(17, "Multi-Turn", "Provide amount only",
                "5000", "Please provide the recipient name or UPI ID", s_step1)
    assert_test(18, "Multi-Turn", "Provide lowercase recipient name (ethish)",
                "ethish", "Confirm Transfer: Send ₹5,000 to Ethish", s_step1)
    assert_test(19, "Multi-Turn", "Execute multi-turn transfer",
                "yes", "Transfer Successful! Sent ₹5,000 to Ethish", s_step1)

    # 20. Multi-turn step-by-step: Recipient First, Amount Second
    s_step2 = {}
    assert_test(20, "Multi-Turn", "Incomplete transfer prompt",
                "I want to transfer money", "Please provide", s_step2)
    assert_test(21, "Multi-Turn", "Provide recipient only (ethish)",
                "ethish", "Please provide the transfer amount", s_step2)
    assert_test(22, "Multi-Turn", "Provide amount (2000)",
                "2000", "Confirm Transfer: Send ₹2,000 to Ethish", s_step2)
    assert_test(23, "Multi-Turn", "Execute multi-turn transfer",
                "proceed", "Transfer Successful! Sent ₹2,000 to Ethish", s_step2)

    # 24. Alphanumeric UPI VPA (ethish@123)
    s_upi = {}
    assert_test(24, "P2P Transfers", "Direct transfer to alphanumeric UPI ID (ethish@123)",
                "Transfer 1000 to ethish@123", "Confirm Transfer: Send ₹1,000 to ethish@123", s_upi)
    assert_test(25, "P2P Transfers", "Confirm UPI ID transfer",
                "yes", "Transfer Successful! Sent ₹1,000 to ethish@123", s_upi)

    # 26. Multi-turn Abort / Change Topic mid-flow (Edge Case)
    s_switch = {}
    assert_test(26, "Multi-Turn", "Incomplete transfer prompt",
                "transfer money", "Please provide", s_switch)
    assert_test(27, "Multi-Turn", "Switch topic mid-way to balance check",
                "What is my current savings balance?", "balance is", s_switch)

    print("\n" + "#" * 40 + " CATEGORY 3: VIRTUAL PLATINUM DEBIT CARDS " + "#" * 40)
    # 28. Card Showcase & Credentials Visibility
    assert_test(28, "Cards", "Showcase platinum card credentials and CVV",
                "Show my platinum virtual debit card details", "Platinum Virtual Debit Card ending in 8921")

    # 29. Instant Card Freeze -> Confirm -> YES
    s_freeze = {}
    assert_test(29, "Cards", "Request instant card freeze",
                "Freeze my platinum debit card immediately", "Confirm Card Freeze", s_freeze)
    assert_test(30, "Cards", "Confirm card lock",
                "yes", "instantly frozen", s_freeze)

    # 31. Attempt transaction while card is frozen (Edge Case)
    bot.bank.card["is_frozen"] = True
    assert_test(31, "Cards", "Blocked card guard on transfer",
                "Transfer 500 to Ravi via card", "Cannot proceed: Your debit card is currently frozen")

    # 32. Instant Card Unfreeze
    assert_test(32, "Cards", "Instant card unfreeze",
                "Unfreeze my platinum debit card", "unfrozen and ready")

    # 33. Daily Limit Slider - Valid Update
    assert_test(33, "Cards", "Update daily spending limit within bounds (₹50,000)",
                "Set my daily debit card spending limit to 50000 rupees", "Daily spending limit successfully updated to ₹50,000")

    # 34. Daily Limit Slider - Below Minimum ₹5,000 (Edge Case)
    assert_test(34, "Cards", "Reject daily limit below ₹5,000",
                "Set daily card limit to 2000 rupees", "Daily spending limit must be set between ₹5,000 and ₹2,00,000")

    # 35. Daily Limit Slider - Above Maximum ₹2,00,000 (Edge Case)
    assert_test(35, "Cards", "Reject daily limit above ₹2,00,000",
                "Set my daily card spending limit to 300000 rupees", "Daily spending limit must be set between ₹5,000 and ₹2,00,000")

    # 36. Per-Transaction Limit Slider - Valid Update
    assert_test(36, "Cards", "Update per-transaction limit within bounds (₹25,000)",
                "Set my per-transaction card limit to 25000 rupees", "Per-transaction spending limit successfully updated to ₹25,000")

    # 37. Per-Transaction Limit Slider - Below Minimum ₹1,000 (Edge Case)
    assert_test(37, "Cards", "Reject per-transaction limit below ₹1,000",
                "Set per-transaction limit to 500 rupees", "Per-transaction limit must be set between ₹1,000 and ₹1,00,000")

    # 38. Channel Control - International Forex
    assert_test(38, "Cards", "Enable international forex card channel",
                "Enable international forex transactions on my card", "International transactions are now ENABLED")

    # 39. Channel Control - ATM Cash Withdrawal
    assert_test(39, "Cards", "Disable ATM cash withdrawal channel",
                "Disable ATM cash withdrawal on my card", "transactions are now DISABLED")

    print("\n" + "#" * 40 + " CATEGORY 4: DEPOSITS & UTILITY BILL PAYMENTS " + "#" * 40)
    # 40. Deposit via UPI with 0% Fee -> Confirm -> YES
    s_dep = {}
    init_bal = bot.bank.savings
    assert_test(40, "Deposits", "Deposit funds via UPI with 0% processing fee",
                "Deposit 5000 rupees into my account via UPI", "Confirm Deposit: Add ₹5,000 to your VoxaBank savings account via UPI (0% fee)", s_dep)
    assert_test(41, "Deposits", "Execute deposit and verify balance credit",
                "yes", "Deposit Successful! Added ₹5,000 into your savings account", s_dep)
    if bot.bank.savings == init_bal + 5000:
        print("       [State Verification] Balance accurately credited from", init_bal, "to", bot.bank.savings)

    # 42. Utility Bill: Broadband Fiber
    s_bill1 = {}
    assert_test(42, "Bills", "Pay Broadband Fiber bill (Airtel)",
                "Pay broadband fiber bill of 999 rupees", "Confirm Bill Payment: Pay ₹999 for Broadband Fiber", s_bill1)
    assert_test(43, "Bills", "Confirm Broadband bill",
                "yes", "Bill Payment Successful! Paid ₹999 for Broadband Fiber", s_bill1)

    # 44. Utility Bill: Electricity & Gas
    s_bill2 = {}
    assert_test(44, "Bills", "Pay Electricity & Gas bill (BESCOM)",
                "Pay electricity and gas bill of 1850 rupees", "Confirm Bill Payment: Pay ₹1,850 for Electricity & Gas", s_bill2)
    assert_test(45, "Bills", "Confirm Electricity bill",
                "yes", "Bill Payment Successful! Paid ₹1,850 for Electricity & Gas", s_bill2)

    # 45. Utility Bill: Rent & Property
    s_bill3 = {}
    assert_test(46, "Bills", "Pay house rent to landlord",
                "Pay house rent of 15000 to landlord", "Confirm Bill Payment: Pay ₹15,000 for Rent & Property", s_bill3)
    assert_test(47, "Bills", "Confirm Rent bill",
                "yes", "Bill Payment Successful! Paid ₹15,000 for Rent & Property", s_bill3)

    # 48. Bill Payment Overdraft Guard (Edge Case)
    assert_test(48, "Bills", "Prevent bill payment exceeding savings balance",
                "Pay property tax bill of 150000 rupees", "Insufficient balance to pay")

    print("\n" + "#" * 40 + " CATEGORY 5: STATEMENTS, SEARCH & EXPORT " + "#" * 40)
    # 49. Financial KPI Cards
    assert_test(49, "Statements", "Retrieve Monthly Inflow, Outflow & Net Cash Flow",
                "What is my total inflow and outflow this month?", "Monthly Financial KPI Report")

    # 50. RFC-compliant CSV Ledger Export
    assert_test(50, "Statements", "Generate RFC-compliant CSV ledger file",
                "Export my statement as CSV file", "RFC-compliant CSV ledger")

    # 51. Browser Print Layout
    assert_test(51, "Statements", "Format statement preview for print and archiving",
                "Print my bank statement", "Browser-friendly formatted statement preview")

    print("\n" + "#" * 40 + " CATEGORY 6: PROFILE & REGULATORY (RAG) " + "#" * 40)
    # 52. Banking Identifiers & One-click Copy
    assert_test(52, "Profile", "View Account Number and IFSC Code (VOXA0001824)",
                "What is my account number and IFSC code?", "IFSC Code: VOXA0001824")

    # 53. Account Tier & KYC Status
    assert_test(53, "Profile", "View Tier (Premier) and KYC (Verified & Active)",
                "What is my account tier and KYC status?", "KYC Status: Verified & Active")

    # 54. Security Preferences: 2FA Toggle
    assert_test(54, "Profile", "Toggle Two-Factor Authentication (2FA)",
                "Enable two-factor authentication for security", "Two-Factor Authentication (2FA) is now ENABLED")

    # 55. RBI Regulations: DICGC Deposit Insurance
    assert_test(55, "Regulations (RAG)", "Query RBI deposit insurance cover under DICGC",
                "What is the maximum insurance limit for bank deposits under DICGC?", "RBI")

    # 56. RBI Regulations: KYC Periodicity
    assert_test(56, "Regulations (RAG)", "Query periodic KYC updation timeline",
                "How often do I need to update my KYC according to RBI?", "KYC")

    # 57. Out-of-Scope Query (Edge Case)
    assert_test(57, "Out-of-Scope", "Graceful handling of irrelevant questions",
                "What is the weather in Paris today?", ["I can only assist with VoxaBank", "I can help you with your account"])

    print("\n" + "#" * 40 + " CATEGORY 7: IN-MEMORY AUDIO STT ROBUSTNESS " + "#" * 40)
    # 58. Simulated audio waveform input (zero ffmpeg dependency)
    sr = 48000
    t = np.linspace(0, 1.5, int(sr * 1.5))
    dummy_audio = (np.sin(2 * np.pi * 440 * t) * 0.1).astype(np.float32)
    transcription = bot.transcribe((sr, dummy_audio))
    total_tests += 1
    if isinstance(transcription, str):
        tests_passed += 1
        print("\n[PASS] Test 58 | Audio STT")
        print("       Description: Direct raw numpy audio processing without ffmpeg or torchaudio")
        print(f"       Recognized:  \"{transcription}\"")

    # 59. Silence / Empty Audio Handling (Edge Case)
    silent_audio = np.zeros(16000, dtype=np.float32)
    silence_result = bot.transcribe((16000, silent_audio))
    total_tests += 1
    if silence_result == "":
        tests_passed += 1
        print("\n[PASS] Test 59 | Audio STT Edge Case")
        print("       Description: Complete silence handled gracefully (returns empty string)")
        print(f"       Recognized:  \"{silence_result}\"")

    # Summary
    pass_rate = (tests_passed / total_tests) * 100
    print("\n" + "=" * 85)
    print(f"  TEST SUITE COMPLETED: {tests_passed}/{total_tests} Tests Passed ({pass_rate:.1f}%)")
    print("=" * 85)
    return tests_passed == total_tests


if __name__ == "__main__":
    success = run_e2e_tests()
    sys.exit(0 if success else 1)
