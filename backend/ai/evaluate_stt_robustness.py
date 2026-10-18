"""
How much does speech-recognition noise hurt LLM 1?  Uses data/stt_evaluation.csv (made by your
stt_dataset script): runs LLM 1 on the clean reference_text and on the noisy_transcript and
reports intent agreement per WER level / accent / speaker, plus the measured WER.

Run:  python evaluate_stt_robustness.py
(Real Whisper WER needs recorded audio + reference text; this file only has text.)
"""
import pandas as pd

from nlu import NLU


def wer(ref, hyp):
    r, h = ref.lower().split(), hyp.lower().split()
    d = list(range(len(h) + 1))
    for i in range(1, len(r) + 1):
        prev, d[0] = d[0], i
        for j in range(1, len(h) + 1):
            cur = d[j]
            d[j] = min(d[j] + 1, d[j - 1] + 1, prev + (r[i - 1] != h[j - 1]))
            prev = cur
    return d[len(h)] / max(len(r), 1)


df = pd.read_csv("data/stt_evaluation.csv")
nlu = NLU()
ref = nlu.predict_batch(df.reference_text.tolist())
noisy = nlu.predict_batch(df.noisy_transcript.tolist())
df["wer"] = [wer(a, b) for a, b in zip(df.reference_text, df.noisy_transcript)]
df["intent_agrees"] = [a["intent"] == b["intent"] for a, b in zip(ref, noisy)]

print(f"Overall: mean WER {df.wer.mean():.3f} | intent unchanged by noise {df.intent_agrees.mean():.3f}")
for col in ("wer_label", "accent_type", "speaker_type", "query_type"):
    print(f"\n{col}")
    print(df.groupby(col).agg(mean_wer=("wer", "mean"), intent_agreement=("intent_agrees", "mean"),
                              n=("id", "count")).round(3).to_string())
df.to_csv("models/stt_robustness_details.csv", index=False)
