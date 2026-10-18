"""
Builds train/val/test jsonl for LLM 1 from data/intent_detection.csv
(columns: id,text,intent,sub_intent  -- the file made by your intent_dataset script).

 * removes duplicate sentences (your generator samples with replacement -> duplicates would leak
   between train and test)
 * adds an out_of_scope class
 * stratified split by (intent, sub_intent)
 * train augmentation: random amounts / amounts spoken in words / names for money intents,
   plus STT-style noisy copies made with YOUR noise functions (stt_noise.py)
 * writes test.jsonl (clean) and test_noisy.jsonl (STT-style noise) for robustness numbers

Run:  python prepare_data.py
"""
import json
import os
import random

import pandas as pd
from num2words import num2words
from sklearn.model_selection import train_test_split

import stt_noise
from common import build_prompt, find_amount_span, slots_for_intent

random.seed(42)
SRC, OUT = "data/intent_detection.csv", "data"
NAMES = ["Ravi", "Priya", "Amit", "Sneha", "Karthik", "Anita", "Suresh", "Divya", "Rahul", "Meena"]
SMALL = [100, 200, 500, 750, 1000, 1500, 2000, 2500, 5000, 7500, 10000, 15000, 25000, 50000]
BIG = [200000, 300000, 500000, 750000, 1000000, 2500000]
ACCENTS = ["north_indian", "south_indian", "east_indian", "west_indian", "neutral"]
SPEAKERS = ["elderly", "young", "female", "male", "child"]

OOS = [
    "what's the weather today", "tell me a joke", "who won the cricket match yesterday",
    "play some music", "what is the capital of France", "book a movie ticket for tonight",
    "order me a pizza", "how tall is Mount Everest", "set an alarm for six in the morning",
    "tell me a story", "what's the latest news", "translate hello to Tamil",
    "how do I cook biryani", "who is the prime minister of India", "sing a song for me",
    "recommend a good book", "what time is it in London", "turn on the lights",
    "how far is the moon", "what's your favourite colour", "mujhe ek joke sunao",
    "aaj mausam kaisa hai", "gaana chalao", "cricket score kya hai", "pizza order karo",
    "how do I lose weight fast", "who is the richest man in the world", "what is two plus two",
    "open youtube", "call my mother", "what is the best phone under 20000",
    "write a poem about rain", "is it going to rain tomorrow", "kaun si movie dekhni chahiye",
    "how do I fix my laptop", "tell me about the solar system", "what is machine learning",
    "send a whatsapp message to my friend", "book a cab to the airport", "hello how are you",
]


def swap_amount(text, new_text):
    span = find_amount_span(text)
    if not span or span[2] == 0:
        return None
    return text[:span[1]] + new_text + text[span[2]:]


def variants(text, intent, sub):
    """Yield (text, slots) augmentations for a training sentence."""
    base = slots_for_intent(intent, text)
    out = [(text, base)]
    if "amount" in base:
        pool = BIG if sub == "rtgs_transfer" else SMALL
        for new in random.sample(pool, 3):
            t = swap_amount(text, str(new))
            if t:
                out.append((t, {**base, "amount": new}))
        new = random.choice(pool)
        t = swap_amount(text, num2words(new, lang="en_IN").replace(",", ""))
        if t:  # spoken form; label stays numeric (what Whisper often produces)
            out.append((t, {**base, "amount": new}))
    if base.get("recipient", "").istitle():
        for nm in random.sample(NAMES, 2):
            out.append((text.replace(base["recipient"], nm), {**base, "recipient": nm}))
    return out


def noisy(text, slots):
    wer = random.choices(["low", "medium", "high"], weights=[0.4, 0.4, 0.2])[0]
    n = stt_noise.make_noisy(text, random.choice(ACCENTS), random.choice(SPEAKERS), wer)
    # keep label consistent: amount must still be recoverable, other slot values must survive
    if "amount" in slots:
        got = find_amount_span(n)
        if not got or got[0] != slots["amount"]:
            return None
    if not all(str(v).lower() in n.lower() for k, v in slots.items() if k != "amount"):
        return None
    return n


def row(text, intent, sub, slots):
    target = json.dumps({"intent": intent, "sub_intent": sub, **slots}, ensure_ascii=False)
    return {"text": text, "intent": intent, "sub_intent": sub, "slots": slots,
            "prompt": build_prompt(text), "completion": " " + target}


def write(rows, name):
    with open(f"{OUT}/{name}.jsonl", "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"{name:<12}{len(rows)}")


def main():
    df = pd.read_csv(SRC)[["text", "intent", "sub_intent"]].dropna()
    n0 = len(df)
    df = df.drop_duplicates("text").reset_index(drop=True)
    print(f"{n0} rows -> {len(df)} unique sentences")
    df = pd.concat([df, pd.DataFrame({"text": OOS, "intent": "out_of_scope", "sub_intent": "none"})],
                   ignore_index=True)
    df["key"] = df.intent + "/" + df.sub_intent

    trainval, test = train_test_split(df, test_size=0.2, stratify=df.key, random_state=42)
    train, val = train_test_split(trainval, test_size=0.125, stratify=trainval.key, random_state=42)

    labels = {}
    for _, r in df.iterrows():
        labels.setdefault(r.intent, set()).add(r.sub_intent)
    json.dump({k: sorted(v) for k, v in labels.items()}, open(f"{OUT}/labels.json", "w"), indent=1)

    rows, seen = [], set()
    for _, r in train.iterrows():
        for t, s in variants(r.text, r.intent, r.sub_intent):
            if t not in seen:
                seen.add(t); rows.append(row(t, r.intent, r.sub_intent, s))
            n = noisy(t, s)
            if n and n not in seen:
                seen.add(n); rows.append(row(n, r.intent, r.sub_intent, s))
    random.shuffle(rows)
    write(rows, "train")

    def plain(d):
        return [row(r.text, r.intent, r.sub_intent, slots_for_intent(r.intent, r.text)) for _, r in d.iterrows()]

    write(plain(val), "val")
    write(plain(test), "test")
    nrows = []
    for r in plain(test):  # same sentences, STT-style noise (fixed seed -> reproducible)
        n = noisy(r["text"], r["slots"]) or r["text"]
        nrows.append(row(n, r["intent"], r["sub_intent"], r["slots"]))
    write(nrows, "test_noisy")
    print(f"{len(labels)} intents (incl. out_of_scope), {df.key.nunique()} intent/sub_intent classes")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    main()
