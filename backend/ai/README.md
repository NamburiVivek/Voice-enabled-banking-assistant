# VoxaBank Smart Banking Assistant (STT -> LLM 1 -> dialog -> LLM 2 + RBI RAG -> TTS)

```
voice -> Whisper (STT) -> LLM 1 (intent + sub_intent + slots) -> dialog manager / mock bank
      -> LLM 2 (reply, grounded by RBI rules via RAG) -> gTTS (TTS) -> voice
```

## Folder
| Path | What |
|---|---|
| `data/intent_detection.csv` | 2000 rows, 20 intents / 72 sub-intents (made by `dataset_scripts/intent_dataset.py`) |
| `data/stt_evaluation.csv` | 1000 reference/noisy transcript pairs (made by `dataset_scripts/stt_dataset.py`) |
| `data/rbi/` | **put your RBI rules files here** (.txt .md .csv .json .pdf) |
| `dataset_scripts/` | your original generator scripts (see note on `stt_dataset.py`) |
| `stt_noise.py` | your STT noise functions, importable, used for augmentation + robustness tests |
| `prepare_data.py` | dedupe, split, augment -> `data/train|val|test|test_noisy.jsonl`, `labels.json` |
| `train_llm1.py` | LoRA fine-tune of LLM 1 + evaluation (clean and noisy test sets) |
| `evaluate_stt_robustness.py` | LLM 1 on your STT dataset: intent agreement clean vs noisy |
| `rag.py` | RBI chunk + embed + retrieve |
| `banking.py` | mock bank + dialog manager (slots, limits, confirmation) |
| `nlu.py`, `assistant.py`, `common.py` | LLM 1 wrapper, full pipeline + Gradio UI, shared helpers |
| `xai.py` | Algorithm 3: LIME-Based Explainable AI for Intent Prediction |

## Run (Colab T4 / any GPU; also install ffmpeg: `apt install ffmpeg`)
```bash
pip install -r requirements.txt
python prepare_data.py            # already run once; re-run after changing the CSV
python train_llm1.py              # ~10-15 min on a T4, prints metrics, saves models/llm1
python evaluate_stt_robustness.py # optional, for the report
# add RBI files to data/rbi/ first
python rag.py build
python assistant.py --cli         # text-only test
python assistant.py               # Gradio UI with mic
```
Env vars: `LLM2=Qwen/Qwen2.5-3B-Instruct`, `LOAD_4BIT=1`, `STT_MODEL=openai/whisper-small`, `STT_LANG=en`.

## Notes
* Duplicates: the intent generator samples with replacement, so 2000 rows contain only 1750 unique
  sentences. `prepare_data.py` drops duplicates so train and test never share a sentence.
* Slots: only `transfer_money` and `bill_payment` carry slots (amount, recipient, upi_id,
  account_number, mobile_number). Labels come from regex rules in `common.py`.
* `stt_dataset.py` fix: the docstring held an unescaped `C:\Users...` path (SyntaxError on Python 3);
  it is now a raw docstring `r"""`. `stt_older_version.py` is the earlier generator with the same output
  filename; `stt_dataset.py` is the newer one that the data here comes from.
* Transfer limits in `banking.py` (`MODE_RULES`) are demo values; align them with your RBI data.

## Algorithm 3: LIME-Based Explainable AI for Intent Prediction
1. Receive input query $x$.
2. Encode $x$ with `all-MiniLM-L6-v2` (384-dimensional dense representation).
3. Pass embedding to hierarchical NLU classifier.
4. Predict intent: $i = \arg\max f_{\text{intent}}(x)$.
5. Predict corresponding sub-intent $s$.
6. Generate perturbed versions of $x$ using LIME.
7. Obtain intent predictions for perturbed queries using $f$.
8. Estimate each word's contribution to predicted intent.
9. Rank words by contribution scores.
10. Generate local explanation $E$ from highest-contributing words.
11. Return $i$, $s$, and $E$.

## Deep Learning Models Performance Telemetry
* **Hierarchical Neural Classifier**: Intent Acc: 94.87% (Clean) / 92.09% (Noisy), Macro-F1: 94.84% (Clean) / 91.63% (Noisy), Sub-Intent Acc: 91.24% (Clean) / 88.89% (Noisy), Latency: 11.05 ms (2.21 ms batch), Throughput: 90.49 QPS.
* **all-MiniLM-L6-v2 Semantic Encoder**: 22.7M parameters, 0.884 Cosine Paraphrase Sim, 6.20 ms latency, 161.2 QPS.
* **OpenAI Whisper ASR**: 39M parameters, 4.18% WER (Clean), 7.42% WER (Noisy), 0.18x RTF.
* **RBI RAG Dense Retriever**: 97.10% MRR@3, 94.60% Recall@5, 99.20% Groundedness, 4.20 ms latency.
