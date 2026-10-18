r"""
Standalone CSV generator for VoxaBank STT Evaluation Dataset.
Run this script once: python generate_stt_dataset.py
Output: C:\Users\Abhi\OneDrive\Desktop\NLP\datasets\stt_evaluation.csv
"""

import csv
import random
import re
from collections import Counter

random.seed(42)

# ── Template bank ────────────────────────────────────────────────────────────
TEMPLATES = {
    "balance": [
        "I want to check my account balance",
        "What is my current balance",
        "Can you tell me my savings account balance",
        "Please show me the balance in my account",
        "How much money do I have in my account",
        "What is the available balance in my account",
        "Check balance for account number {account}",
        "Show me the balance of my current account",
        "I need to know my bank balance right now",
        "Tell me my total account balance please",
        "What is my balance in the savings account",
        "Can you display the balance for account {account}",
        "My account balance please",
        "Give me an update on my balance",
        "I would like to see my account balance",
        "How much is remaining in my account",
        "What is the closing balance of my account",
        "Show balance for my joint account",
        "Is my salary credited to my account",
        "Has my salary of {amount} rupees been credited",
        "What is the minimum balance for my account",
        "Show me the balance after my last transaction",
        "My current account balance is how much",
        "Can you check the balance in my FD account",
        "I want to know the balance in my recurring deposit",
    ],
    "transfer": [
        "Transfer {amount} rupees to {name}",
        "I want to transfer {amount} rupees to account {account}",
        "Please send {amount} to {name} via NEFT",
        "Send {amount} rupees to {name} using IMPS",
        "Transfer money to {name} immediately",
        "I need to transfer {amount} rupees urgently",
        "Transfer {amount} rupees from my savings to current account",
        "Do an RTGS transfer of {amount} rupees to {account}",
        "Send {amount} rupees to UPI ID {upi}",
        "Please transfer {amount} to account number {account}",
        "I want to do a fund transfer of {amount} rupees",
        "Transfer {amount} to {name} today",
        "Can you initiate a transfer of {amount} rupees to {name}",
        "Move {amount} rupees from savings to my FD",
        "Transfer funds to {account} account",
        "I need to send money to {name} right now",
        "Please do a NEFT transfer to {name}",
        "Send {amount} rupees using UPI to {upi}",
        "Transfer {amount} rupees to my wife's account",
        "I want to send {amount} to {name}'s account number {account}",
        "Do an immediate transfer of {amount} rupees",
        "Transfer money urgently to {name}",
        "I need to pay {name} {amount} rupees now",
        "Send {amount} rupees to beneficiary {name}",
        "Please initiate IMPS of {amount} rupees to {account}",
    ],
    "payment": [
        "Pay my electricity bill of {amount} rupees",
        "I want to pay my credit card bill",
        "Pay {amount} rupees towards my loan EMI",
        "Make payment for my water bill",
        "Pay my phone bill of {amount} rupees",
        "I need to pay my insurance premium of {amount}",
        "Pay my DTH subscription of {amount} rupees",
        "Make a payment of {amount} to {name}",
        "Pay the school fees of {amount} rupees",
        "I want to pay my internet bill",
        "Clear my credit card outstanding of {amount} rupees",
        "Pay {amount} rupees to {name} for rent",
        "Make payment towards my home loan EMI",
        "Pay gas bill of {amount} rupees",
        "I want to clear my outstanding dues",
        "Pay {amount} rupees to merchant {name}",
        "Make UPI payment of {amount} to {upi}",
        "Pay my mobile recharge of {amount} rupees",
        "I want to pay property tax of {amount} rupees",
        "Pay hospital bill of {amount} rupees",
        "Make a bill payment for electricity",
        "Pay my LIC premium of {amount} rupees",
        "I need to pay {name} for {amount} rupees",
        "Clear my outstanding balance of {amount}",
        "Pay subscription fee of {amount} rupees",
    ],
    "loan": [
        "What is my loan outstanding balance",
        "I want to apply for a personal loan of {amount} rupees",
        "Can I get a home loan of {amount} rupees",
        "What is the EMI for a loan of {amount} rupees",
        "Show me my loan account details",
        "I want to foreclose my personal loan",
        "What is the interest rate on home loan",
        "Apply for a car loan of {amount} rupees",
        "How many EMIs are remaining for my loan",
        "I want to prepay my home loan",
        "What is the processing fee for personal loan",
        "Can I get a gold loan against my ornaments",
        "Apply for education loan of {amount} rupees",
        "What documents are required for home loan",
        "I need a loan of {amount} rupees urgently",
        "What is my loan account number",
        "Reduce my EMI amount for personal loan",
        "I want to increase my loan tenure",
        "Can I apply for a top-up loan",
        "What is the outstanding principal on my loan",
        "How to apply for mudra loan",
        "I need a business loan of {amount} rupees",
        "What is the penalty for late EMI payment",
        "Give me the loan statement for the last year",
        "I want to know about home loan eligibility",
    ],
    "general": [
        "What are the banking hours",
        "How do I open a new savings account",
        "What documents are required to open an account",
        "How do I update my mobile number",
        "I want to change my ATM PIN",
        "How do I block my credit card",
        "What is the process to get a new debit card",
        "I want to update my KYC details",
        "How do I register for internet banking",
        "What is the minimum balance required",
        "How to close my savings account",
        "I want to link my Aadhaar to my account",
        "How do I activate mobile banking",
        "What is the branch IFSC code",
        "I need a bank statement for the last six months",
        "How do I generate account statement",
        "What is the customer care number",
        "How to reset my net banking password",
        "I want to add a nominee to my account",
        "What are the charges for NEFT transfer",
        "How do I update my address in bank records",
        "I want to know about locker facility",
        "What is the process to get a passbook",
        "How do I check my transaction history",
        "I want to enable international transactions on my card",
    ],
    "fraud": [
        "I received a suspicious call asking for my OTP",
        "Someone has done an unauthorized transaction from my account",
        "I think my debit card has been cloned",
        "Please block my account immediately there is fraud",
        "I received a phishing email from someone pretending to be the bank",
        "My ATM card has been swallowed by the machine",
        "I did not authorize this transaction of {amount} rupees",
        "Someone is trying to hack my net banking account",
        "I lost my debit card please block it immediately",
        "There is a suspicious transaction on my account",
        "I got an OTP which I did not request please help",
        "My credit card has been used without my knowledge",
        "Someone called me pretending to be bank staff and asked for my details",
        "I have been cheated online please help",
        "My account shows a debit of {amount} that I did not do",
        "Please freeze my account there is unauthorized access",
        "I received a fake UPI payment request",
        "Someone is using my mobile banking without my permission",
        "I clicked on a suspicious link and now I am worried",
        "Please help me report a cyber fraud immediately",
        "I got a message saying I won a lottery through the bank",
        "Someone asked for my card details on phone",
        "My account has been compromised please help",
        "I want to report a failed ATM transaction where money was deducted",
        "I received a fraudulent SMS asking to update my KYC",
    ],
    "scheme": [
        "Tell me about the fixed deposit interest rates",
        "What are the current savings schemes available",
        "I want to open a recurring deposit account",
        "Tell me about the senior citizen savings scheme",
        "What is the interest rate on fixed deposit for {amount} rupees",
        "How do I invest in mutual funds through the bank",
        "Tell me about the Sukanya Samriddhi scheme",
        "What is the PPF interest rate this quarter",
        "I want to invest in the National Savings Certificate",
        "Tell me about the bank's tax saving FD scheme",
        "What are the benefits of the premium savings account",
        "I want to know about the monthly income scheme",
        "Tell me about the Kisan Vikas Patra scheme",
        "What is the minimum amount for fixed deposit",
        "How to open a PPF account",
        "Tell me about the sweep in fixed deposit",
        "I want to invest {amount} rupees in a recurring deposit",
        "What are the tax benefits on home loan",
        "Tell me about the salary account benefits",
        "What is the interest rate for recurring deposit",
        "I want to know about children savings schemes",
        "Tell me about the bank's health insurance schemes",
        "What is the auto-sweep facility",
        "I want to open a tax saver fixed deposit",
        "Tell me about government backed savings schemes",
    ],
}

NAMES = [
    "Ramesh","Sunita","Arjun","Priya","Vijay","Meena","Suresh",
    "Kavita","Rajan","Deepa","Anil","Pooja","Manoj","Reena",
    "Sanjay","Geeta","Rakesh","Anita","Vivek","Nisha","Harish",
    "Lalita","Dinesh","Usha","Bharat","Shanti","Naresh","Kamla",
    "Girish","Savita","Pramod","Sudha","Vinod","Asha","Gopal",
]
AMOUNTS = [
    "five hundred","one thousand","two thousand","five thousand",
    "ten thousand","twenty thousand","fifty thousand","one lakh",
    "two lakh","five lakh","ten lakh","two hundred","three thousand",
    "fifteen thousand","twenty-five thousand","seven thousand",
    "twelve thousand","thirty thousand","forty thousand",
]
ACCOUNTS = [
    "9876543210","1234567890","5432167890","9012345678",
    "6789012345","3456789012","8901234567","2345678901",
    "4567890123","7890123456","0123456789","1357924680",
]
UPIS = [
    "ramesh@upi","sunita@okaxis","arjun@ybl","priya@paytm",
    "vijay@oksbi","meena@ibl","suresh@upi","kavita@okicici",
    "rajan@upi","deepa@ybl","anil@okaxis","pooja@paytm",
]

def fill(text):
    text = text.replace("{name}",    random.choice(NAMES))
    text = text.replace("{amount}",  random.choice(AMOUNTS))
    text = text.replace("{account}", random.choice(ACCOUNTS))
    text = text.replace("{upi}",     random.choice(UPIS))
    return text

ACCENT_SUBS = {
    "north_indian": [
        (r"\bthe\b","da"),(r"\bthis\b","dis"),(r"\bthat\b","dat"),
        (r"\bthree\b","tree"),(r"\bwhat\b","vat"),(r"\bwhere\b","vere"),
        (r"\bwhen\b","ven"),(r"\bwhy\b","vai"),(r"\bwith\b","vit"),
        (r"\bthank\b","tank"),(r"\bthought\b","tot"),(r"\bthen\b","den"),
        (r"\bthere\b","dare"),(r"\bthose\b","dose"),
    ],
    "south_indian": [
        (r"\bthe\b","dha"),(r"\bis\b","ees"),(r"\bare\b","arr"),
        (r"\brupees\b","roopees"),(r"\bbank\b","baink"),
        (r"\bplease\b","pleese"),(r"\bhave\b","haave"),
        (r"\bmy\b","mai"),(r"\bcan\b","kaan"),(r"\bwill\b","weel"),
        (r"\bnow\b","nao"),(r"\bhow\b","hao"),
    ],
    "east_indian": [
        (r"\bthe\b","tha"),(r"\bis\b","iz"),(r"\bdo\b","doo"),
        (r"\bI\b","Ai"),(r"\bwant\b","wannt"),
        (r"\bcheck\b","chaeck"),(r"\bbalance\b","baalance"),
        (r"\bgive\b","geeve"),(r"\bget\b","gat"),
    ],
    "west_indian": [
        (r"\bthe\b","te"),(r"\btransfer\b","tansfer"),
        (r"\bamount\b","amountt"),(r"\bpay\b","pae"),
        (r"\brupees\b","roopeez"),(r"\bmy\b","mhy"),
        (r"\bblock\b","blok"),(r"\bcard\b","kaad"),
    ],
    "neutral": [],
}

MISHEAR_PAIRS = [
    ("balance","ballance"),("balance","valence"),("balance","balence"),
    ("transfer","tranfer"),("transfer","transfers"),("transfer","transfar"),
    ("payment","payement"),("payment","paiment"),("payment","paymant"),
    ("account","acount"),("account","acccount"),("account","acounnt"),
    ("rupees","ruppes"),("rupees","ruppees"),("rupees","rupeis"),
    ("thousand","tousand"),("thousand","thouusand"),("thousand","thousan"),
    ("hundred","hunderd"),("hundred","hundread"),("hundred","hundered"),
    ("savings","savvings"),("savings","saving"),("savings","saavings"),
    ("immediately","immediatley"),("immediately","immedietly"),
    ("electricity","electicity"),("electricity","electrisity"),
    ("unauthorized","unautharized"),("unauthorized","unautherized"),
    ("transaction","transaaction"),("transaction","transction"),
    ("suspicious","suspecious"),("suspicious","suspicous"),("suspicious","suspishus"),
    ("insurance","insurence"),("insurance","inshurence"),("insurance","insuranc"),
    ("interest","intrest"),("interest","intarest"),("interest","interst"),
    ("deposit","depposit"),("deposit","deopsit"),("deposit","depositt"),
    ("certificate","certficate"),("certificate","certifcate"),
    ("premium","premeum"),("premium","primeum"),
    ("government","goverment"),("government","governmant"),
    ("available","availble"),("available","availabel"),
    ("activate","actiwate"),("activate","activait"),
    ("international","internaational"),("international","internationnal"),
    ("foreclose","forclose"),("foreclose","forecloze"),
    ("outstanding","oustanding"),("outstanding","outstandin"),
    ("nominee","nomenee"),("nominee","nomenie"),
    ("eligible","eligble"),("eligible","elgible"),
    ("statement","statment"),("statement","statament"),
    ("generate","genrate"),("generate","generrate"),
    ("subscription","subscrpition"),("subscription","subscripshun"),
    ("phishing","fishing"),("phishing","phissing"),
    ("compromised","comprimised"),("compromised","compramised"),
    ("investment","investement"),("investment","investmant"),
    ("minimum","minimun"),("minimum","minumum"),
    ("remaining","remaning"),("remaining","remining"),
    ("document","documment"),("document","documant"),
    ("blocked","bloked"),("blocked","blocced"),
    ("credit","cradit"),("credit","creditt"),
    ("debit","debot"),("debit","debitt"),
    ("password","pasword"),("password","passward"),
    ("mobile","moble"),("mobile","mobille"),
    ("internet","internt"),("internet","internett"),
    ("salary","sallary"),("salary","selary"),
    ("property","proprty"),("property","propertty"),
    ("hospital","hopsital"),("hospital","hospittal"),
    ("education","educashun"),("education","educaation"),
    ("personal","persnal"),("personal","personnal"),
    ("register","registar"),("register","registter"),
    ("banking","bankin"),("banking","bankking"),
    ("history","histery"),("history","histroy"),
    ("locker","lokker"),("locker","locker"),
    ("passbook","pasbook"),("passbook","passbbok"),
    ("customer","custmer"),("customer","customr"),
    ("branch","braanch"),("branch","brunch"),
    ("enable","enabel"),("enable","ennabel"),
    ("fraudulent","fradulent"),("fraudulent","fraudlent"),
    ("lottery","lotary"),("lottery","lottary"),
    ("cyber","syber"),("cyber","cybar"),
    ("beneficiary","beneficary"),("beneficiary","beneficiery"),
    ("processing","procesing"),("processing","proccessing"),
    ("prepay","preepay"),("prepay","preppay"),
    ("penalty","penality"),("penalty","penallty"),
    ("ornaments","ornamants"),("ornaments","ornamnts"),
    ("principal","principel"),("principal","principl"),
    ("tenure","tenuer"),("tenure","tennure"),
    ("foreclose","forclose"),("eligible","eligeble"),
    ("knowledge","knolwedge"),("knowledge","knowlege"),
    ("permission","permision"),("permission","permissoin"),
    ("pretending","prentending"),("pretending","pretendng"),
    ("immediately","immidiately"),("urgently","urgantely"),
    ("swallowed","swalowed"),("cloned","cloaned"),
    ("compromised","comproised"),("initiate","initaite"),
    ("beneficiary","benficiary"),("authorize","autharize"),
]

NUMBER_CONFUSIONS = {
    "five hundred":       ["500","five hunderd","five hunded","5 hundred","fife hundred"],
    "one thousand":       ["1000","one tousand","1 thousand","one thousnd","won thousand"],
    "two thousand":       ["2000","two tousand","2000 rupees","two thousnd","to thousand"],
    "five thousand":      ["5000","five tousand","5 thousand","fife thousand"],
    "ten thousand":       ["10000","ten tousand","10 thousand","ten thousnd","tan thousand"],
    "twenty thousand":    ["20000","twenty tousand","20 thousand","twenty thousnd"],
    "fifty thousand":     ["50000","fifty tousand","50 thousand","fifty thousnd"],
    "one lakh":           ["100000","one lac","1 lakh","one laakh","wan lakh"],
    "two lakh":           ["200000","two lac","2 lakh","too lakh"],
    "five lakh":          ["500000","five lac","5 lakh","fife lakh"],
    "ten lakh":           ["1000000","ten lac","10 lakh","tan lakh"],
    "two hundred":        ["200","two hunderd","2 hundred","too hundred"],
    "three thousand":     ["3000","three tousand","3 thousand","tree thousand"],
    "fifteen thousand":   ["15000","fifteen tousand","15 thousand","fiften thousand"],
    "twenty-five thousand":["25000","twentyfive thousand","25 thousand","twenty five thousnd"],
    "seven thousand":     ["7000","seven tousand","7 thousand","sevan thousand"],
    "twelve thousand":    ["12000","twelve tousand","12 thousand","tweleve thousand"],
    "thirty thousand":    ["30000","thirty tousand","30 thousand","tirty thousand"],
    "forty thousand":     ["40000","forty tousand","40 thousand","fourty thousand"],
}

FILLERS  = [
    "please please","umm","uh","ya","haan","okay okay","actually",
    "like","you know","basically","I mean","arey","bhai","na","ji",
    "theek hai","please","hello","yes yes",
]
SMALL_WORDS = {"to","a","an","the","my","me","for","of","i","in","is","it","do","be","at"}


def apply_accent(text, accent):
    for pat, rep in ACCENT_SUBS.get(accent, []):
        if random.random() < 0.55:
            text = re.sub(pat, rep, text)
    return text


def apply_mishear(text, prob):
    words, result, i = text.split(), [], 0
    while i < len(words):
        if i < len(words) - 1:
            bg = (words[i] + " " + words[i+1]).lower()
            opts = [r for (o, r) in MISHEAR_PAIRS if o == bg]
            if opts and random.random() < prob:
                result.append(random.choice(opts)); i += 2; continue
        wl = words[i].lower().rstrip("'s,.")
        opts = [r for (o, r) in MISHEAR_PAIRS if o == wl]
        if opts and random.random() < prob:
            result.append(random.choice(opts))
        else:
            result.append(words[i])
        i += 1
    return " ".join(result)


def apply_numbers(text):
    for orig, variants in NUMBER_CONFUSIONS.items():
        if orig in text.lower() and random.random() < 0.5:
            text = re.sub(re.escape(orig), random.choice(variants), text, flags=re.IGNORECASE)
    return text


def drop_words(text, prob):
    return " ".join(
        w for w in text.split()
        if not (w.lower() in SMALL_WORDS and random.random() < prob)
    )


def dup_word(text, prob):
    if random.random() < prob:
        ws = text.split()
        if len(ws) > 2:
            idx = random.randint(0, len(ws) - 1)
            ws.insert(idx + 1, ws[idx])
            return " ".join(ws)
    return text


def insert_filler(text, prob):
    if random.random() < prob:
        ws = text.split()
        pos = random.randint(max(0, len(ws) // 2), len(ws))
        ws.insert(pos, random.choice(FILLERS))
        return " ".join(ws)
    return text


def make_noisy(ref, accent, speaker, wer_target):
    t = apply_accent(ref, accent)
    mp = {"low": 0.15, "medium": 0.45, "high": 0.80}[wer_target]
    t  = apply_mishear(t, mp)
    t  = apply_numbers(t)
    dp = {"low": 0.08, "medium": 0.22, "high": 0.40}[wer_target]
    t  = drop_words(t, dp)
    t  = dup_word(t,  {"low": 0.05, "medium": 0.12, "high": 0.20}[wer_target])
    t  = insert_filler(t, {"low": 0.05, "medium": 0.18, "high": 0.35}[wer_target])
    if speaker == "elderly" and random.random() < 0.15:
        parts = t.split()
        if len(parts) > 3:
            t = t + " " + " ".join(parts[:2])
    if speaker == "child" and random.random() < 0.25:
        ws = t.split()
        t  = " ".join(ws[:max(3, len(ws) // 2)])
    return t.strip()


def compute_wer_label(ref, hyp):
    r, h = ref.lower().split(), hyp.lower().split()
    d = [[0] * (len(h)+1) for _ in range(len(r)+1)]
    for i in range(len(r)+1): d[i][0] = i
    for j in range(len(h)+1): d[0][j] = j
    for i in range(1, len(r)+1):
        for j in range(1, len(h)+1):
            cost = 0 if r[i-1] == h[j-1] else 1
            d[i][j] = min(d[i-1][j]+1, d[i][j-1]+1, d[i-1][j-1]+cost)
    wer = d[len(r)][len(h)] / max(len(r), 1)
    return "low" if wer <= 0.10 else ("medium" if wer <= 0.30 else "high")


# ── Generation ────────────────────────────────────────────────────────────────
QUERY_TYPES   = list(TEMPLATES.keys())
ACCENT_TYPES  = ["north_indian","south_indian","east_indian","west_indian","neutral"]
SPEAKER_TYPES = ["elderly","young","female","male","child"]

WER_TARGETS = (["low"]*400) + (["medium"]*350) + (["high"]*250)
random.shuffle(WER_TARGETS)

rows = []
for idx in range(1000):
    qt  = random.choice(QUERY_TYPES)
    spk = random.choice(SPEAKER_TYPES)
    acc = random.choice(ACCENT_TYPES)
    wt  = WER_TARGETS[idx]

    ref = fill(random.choice(TEMPLATES[qt]))
    nsy = make_noisy(ref, acc, spk, wt)

    rows.append({
        "id":               idx + 1,
        "reference_text":   ref,
        "noisy_transcript": nsy,
        "wer_label":        compute_wer_label(ref, nsy),
        "speaker_type":     spk,
        "accent_type":      acc,
        "query_type":       qt,
    })

# ── Write CSV ─────────────────────────────────────────────────────────────────
OUT    = r"C:\Users\Abhi\OneDrive\Desktop\NLP\datasets\stt_evaluation.csv"
FIELDS = ["id","reference_text","noisy_transcript","wer_label",
          "speaker_type","accent_type","query_type"]

with open(OUT, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=FIELDS)
    writer.writeheader()
    writer.writerows(rows)

# ── Report ────────────────────────────────────────────────────────────────────
wc = Counter(r["wer_label"]    for r in rows)
sc = Counter(r["speaker_type"] for r in rows)
ac = Counter(r["accent_type"]  for r in rows)
qc = Counter(r["query_type"]   for r in rows)

print(f"\n{'='*57}")
print("  VoxaBank STT Evaluation Dataset — Generation Report")
print(f"{'='*57}")
print(f"  Total rows  : {len(rows)}")
print(f"\n  WER Label distribution:")
for k, v in sorted(wc.items()):
    bar = "█" * (v // 10)
    print(f"    {k:<8}: {v:>4}  {bar}")
print(f"\n  Speaker Type distribution:")
for k, v in sorted(sc.items()):
    print(f"    {k:<12}: {v}")
print(f"\n  Accent Type distribution:")
for k, v in sorted(ac.items()):
    print(f"    {k:<15}: {v}")
print(f"\n  Query Type distribution:")
for k, v in sorted(qc.items()):
    print(f"    {k:<12}: {v}")
print(f"\n  Sample rows:")
for r in rows[:5]:
    print(f"\n  [{r['id']:>4}] REF  : {r['reference_text']}")
    print(f"         NOISY: {r['noisy_transcript']}")
    print(f"         WER={r['wer_label']:<6} SPK={r['speaker_type']:<8} ACC={r['accent_type']:<15} Q={r['query_type']}")
print(f"\n{'='*57}")
print("DONE: 1000 rows written to stt_evaluation.csv")
