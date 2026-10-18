import csv
import random
import os

os.makedirs(r"C:\Users\Abhi\OneDrive\Desktop\NLP\datasets", exist_ok=True)

random.seed(42)

# --- Base templates ---
balance_refs = [
    "What is my current savings account balance?",
    "Can you tell me how much money I have in my account?",
    "Please check my account balance.",
    "I need to know my savings balance right now.",
    "Show me my account balance.",
    "How much do I have in my savings account?",
    "What is the available balance in my account?",
    "Tell me my current balance please.",
    "I want to check my bank balance.",
    "Can you show me my balance?",
    "What is my FD balance?",
    "Check my loan outstanding balance.",
    "How much is left in my recurring deposit?",
    "I want to know my current account balance.",
    "What is the balance remaining in my account?",
]

transfer_refs = [
    "I want to transfer five thousand rupees to my friend.",
    "Please send two thousand rupees to account number 1234567890.",
    "Transfer one lakh rupees using NEFT to this account.",
    "I need to do a UPI transfer of five hundred rupees.",
    "Can you initiate an IMPS transfer for me?",
    "Send money to my sister's account.",
    "I want to do an RTGS transfer of ten lakh rupees.",
    "Please transfer the amount to the given account number.",
    "Help me send money via UPI.",
    "Transfer funds from my savings to my current account.",
    "I want to pay someone using NEFT.",
    "How do I send money to another bank?",
    "Send three thousand rupees to my friend via UPI.",
    "I want to transfer money to a different bank account.",
    "Please help me do an online fund transfer.",
]

payment_refs = [
    "I want to pay my electricity bill.",
    "Help me pay my mobile phone recharge.",
    "Pay my credit card bill of five thousand rupees.",
    "I need to pay my water bill.",
    "Please pay my insurance premium.",
    "How do I pay my broadband bill online?",
    "I want to pay my gas connection bill.",
    "Can you help me pay my DTH recharge?",
    "Pay my LIC premium due this month.",
    "Help me with my utility bill payment.",
    "I want to recharge my Jio number.",
    "Pay my Airtel postpaid bill.",
    "Help me pay my house rent online.",
    "I want to pay my school fees online.",
    "Please process my EMI payment for this month.",
]

loan_refs = [
    "What is the interest rate on home loans?",
    "How do I apply for a personal loan?",
    "Tell me about education loan eligibility.",
    "What is the EMI for a ten lakh home loan?",
    "How can I get a gold loan?",
    "What documents are required for a vehicle loan?",
    "Can I prepay my personal loan?",
    "What is the processing fee for a home loan?",
    "How long does loan approval take?",
    "I want to know about the Mudra loan scheme.",
    "What is the maximum amount for a personal loan?",
    "How do I check my loan status?",
    "What is my current loan outstanding balance?",
    "Can I get a top up loan on my existing home loan?",
    "What is the interest rate for an education loan?",
]

general_refs = [
    "What are your bank branch working hours?",
    "How do I contact customer care?",
    "What is the IFSC code of the main branch?",
    "Where is the nearest ATM?",
    "How do I open a new bank account?",
    "What is the minimum balance requirement?",
    "How do I update my mobile number?",
    "I forgot my net banking password.",
    "How do I link my Aadhaar to my bank account?",
    "What is the annual maintenance charge for my card?",
    "How do I get a duplicate passbook?",
    "What is the cheque clearance time?",
    "How do I place a stop payment on a cheque?",
    "What are the charges for NEFT transactions?",
    "How do I apply for a new debit card?",
]

fraud_refs = [
    "I received a suspicious OTP message, what should I do?",
    "Someone made an unauthorized transaction from my account.",
    "I think my card has been skimmed.",
    "I got a phishing email from someone pretending to be the bank.",
    "My account was hacked, please help.",
    "There is a transaction I did not make in my account.",
    "How do I report fraud to the bank?",
    "My ATM card details were stolen.",
    "I received a call asking for my OTP, is this genuine?",
    "Help, someone transferred money from my account without my permission.",
]

scheme_refs = [
    "Tell me about the Jan Dhan Yojana scheme.",
    "How do I open a Sukanya Samriddhi account?",
    "What is the Atal Pension Yojana?",
    "How can I apply for the PM Mudra Loan?",
    "What is the PMAY housing scheme?",
    "Tell me about the PM Jeevan Jyoti Bima Yojana.",
    "How do I enroll in PM Suraksha Bima Yojana?",
    "What is the interest rate in Sukanya Samriddhi Yojana?",
    "Who is eligible for the Jan Dhan Yojana?",
    "What are the benefits of the Atal Pension Yojana?",
]

all_templates = {
    "balance": balance_refs,
    "transfer": transfer_refs,
    "payment": payment_refs,
    "loan": loan_refs,
    "general": general_refs,
    "fraud": fraud_refs,
    "scheme": scheme_refs,
}

speaker_types = ["elderly", "young", "female", "male", "child"]
accent_types = ["north_indian", "south_indian", "east_indian", "west_indian", "neutral"]

# STT error functions
def apply_stt_errors(text, level):
    """Apply realistic STT errors based on level: low, medium, high"""
    words = text.split()
    result = words[:]

    # Common word substitutions
    substitutions = {
        "the": ["da", "de", ""],
        "three": ["tree", "free", "three"],
        "transfer": ["tranfer", "transfers", "transfer"],
        "balance": ["ballance", "valence", "balance"],
        "account": ["acount", "accoount", "account"],
        "rupees": ["rupee", "ruppees", "rupees", ""],
        "thousand": ["tousand", "thousend", "thousand"],
        "lakh": ["lack", "lac", "lakh"],
        "please": ["pease", "please", "please please"],
        "want": ["vant", "want"],
        "what": ["vat", "what", "wt"],
        "help": ["halp", "help"],
        "check": ["chek", "check"],
        "savings": ["saving", "savings"],
        "payment": ["paymnt", "payment", "pay meant"],
        "electricity": ["electricty", "electicity", "electricity"],
        "insurance": ["insurence", "insurnace", "insurance"],
        "transaction": ["transation", "transaction"],
        "mobile": ["moblie", "mobil", "mobile"],
        "number": ["numbr", "numbar", "number"],
        "apply": ["aply", "applie", "apply"],
        "interest": ["intrest", "interest"],
        "eligible": ["eligble", "eligibel", "eligible"],
    }

    if level == "low":
        # 1-2 errors max
        n_errors = random.randint(0, 2)
        for _ in range(n_errors):
            idx = random.randint(0, len(result) - 1)
            word_lower = result[idx].lower().rstrip(".,?!")
            if word_lower in substitutions:
                result[idx] = random.choice(substitutions[word_lower])
    elif level == "medium":
        # Drop 1-2 small words, substitute 2-3 words
        small_words = {"i", "a", "the", "to", "is", "my", "me", "in", "of"}
        new_result = []
        for w in result:
            if w.lower() in small_words and random.random() < 0.3:
                continue  # drop word
            wl = w.lower().rstrip(".,?!")
            if wl in substitutions and random.random() < 0.4:
                new_result.append(random.choice(substitutions[wl]))
            else:
                new_result.append(w)
        result = new_result if new_result else result
        # occasional repeat
        if random.random() < 0.2 and result:
            idx = random.randint(0, len(result) - 1)
            result.insert(idx, result[idx])
    else:  # high
        # Heavy corruption
        small_words = {"i", "a", "the", "to", "is", "my", "me", "in", "of", "can", "you", "please"}
        new_result = []
        for w in result:
            if w.lower() in small_words and random.random() < 0.5:
                continue
            wl = w.lower().rstrip(".,?!")
            if wl in substitutions and random.random() < 0.6:
                choice = random.choice(substitutions[wl])
                if choice:
                    new_result.append(choice)
            else:
                # Random character corruption
                if random.random() < 0.2 and len(w) > 3:
                    ci = random.randint(1, len(w) - 2)
                    w = w[:ci] + w[ci+1:]
                new_result.append(w)
        result = new_result if new_result else result
        # Add filler words sometimes
        fillers = ["uh", "umm", "err", "hmm"]
        if random.random() < 0.3 and result:
            result.insert(0, random.choice(fillers))

    return " ".join(result).strip()


rows = []
row_id = 1

# Distribution: 1000 rows across 7 query types
query_counts = {
    "balance": 180,
    "transfer": 150,
    "payment": 150,
    "loan": 150,
    "general": 150,
    "fraud": 110,
    "scheme": 110,
}

for qtype, count in query_counts.items():
    templates = all_templates[qtype]
    for i in range(count):
        ref = templates[i % len(templates)]
        # Vary with slight paraphrasing by random prefix/suffix
        prefixes = ["", "Hello, ", "Hi, ", "Excuse me, ", "Please, ", "Can you help me, ", ""]
        suffixes = ["", ".", "?", " Thank you.", " Please help.", ""]
        ref_varied = random.choice(prefixes) + ref + random.choice(suffixes)
        ref_varied = ref_varied.strip()

        wer_label = random.choices(["low", "medium", "high"], weights=[0.4, 0.4, 0.2])[0]
        noisy = apply_stt_errors(ref_varied, wer_label)

        rows.append({
            "id": row_id,
            "reference_text": ref_varied,
            "noisy_transcript": noisy,
            "wer_label": wer_label,
            "speaker_type": random.choice(speaker_types),
            "accent_type": random.choice(accent_types),
            "query_type": qtype,
        })
        row_id += 1

# Shuffle
random.shuffle(rows)
# Re-assign IDs after shuffle
for i, row in enumerate(rows, 1):
    row["id"] = i

output_path = r"C:\Users\Abhi\OneDrive\Desktop\NLP\datasets\stt_evaluation.csv"
fieldnames = ["id", "reference_text", "noisy_transcript", "wer_label", "speaker_type", "accent_type", "query_type"]

with open(output_path, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)

print(f"DONE: {len(rows)} rows written to stt_evaluation.csv")
