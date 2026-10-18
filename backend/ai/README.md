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
