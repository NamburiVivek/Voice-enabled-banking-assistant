"""STT-noise functions taken unchanged from dataset_scripts/stt_dataset.py (importable, no side effects).
make_noisy(ref, accent, speaker, wer_target) -> noisy transcript."""
import random
import re

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


