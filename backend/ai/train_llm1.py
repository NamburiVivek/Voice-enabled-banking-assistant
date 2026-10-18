"""
Fine-tune LLM 1 (Qwen2.5 Instruct + LoRA): utterance -> {"intent","sub_intent",slots} JSON, then evaluate.

Run:  python prepare_data.py && python train_llm1.py
Use BASE = "Qwen/Qwen2.5-1.5B-Instruct" for higher accuracy (fits a free Colab T4).
"""
import json
import shutil

import torch
from datasets import load_dataset
from peft import LoraConfig, get_peft_model
from sklearn.metrics import accuracy_score, f1_score
from transformers import (AutoModelForCausalLM, AutoTokenizer, DataCollatorForSeq2Seq,
                          Trainer, TrainingArguments)

BASE = "Qwen/Qwen2.5-0.5B-Instruct"
OUT = "models/llm1"

tok = AutoTokenizer.from_pretrained(BASE)
model = AutoModelForCausalLM.from_pretrained(BASE, torch_dtype=torch.float32)
model = get_peft_model(model, LoraConfig(
    r=16, lora_alpha=32, lora_dropout=0.05, task_type="CAUSAL_LM",
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"]))
model.print_trainable_parameters()


def tokenize(ex):
    p = tok(ex["prompt"], add_special_tokens=False)["input_ids"]
    c = tok(ex["completion"], add_special_tokens=False)["input_ids"] + [tok.eos_token_id]
    return {"input_ids": p + c, "attention_mask": [1] * (len(p) + len(c)),
            "labels": [-100] * len(p) + c}  # loss only on the JSON answer


raw = load_dataset("json", data_files={"train": "data/train.jsonl", "val": "data/val.jsonl"})
ds = raw.map(tokenize, remove_columns=raw["train"].column_names)

import math
EPOCHS, BATCH, ACCUM = 3, 4, 4          # effective batch = 16
total_steps = math.ceil(len(ds["train"]) / (BATCH * ACCUM)) * EPOCHS
bf16 = torch.cuda.is_available() and torch.cuda.is_bf16_supported()
args = TrainingArguments(
    output_dir="models/llm1_ckpt", num_train_epochs=EPOCHS, learning_rate=2e-4,
    per_device_train_batch_size=BATCH, gradient_accumulation_steps=ACCUM,
    per_device_eval_batch_size=BATCH,
    warmup_steps=int(0.05 * total_steps), lr_scheduler_type="cosine", logging_steps=20,
    eval_strategy="epoch", save_strategy="no", report_to="none",
    dataloader_pin_memory=False,
    bf16=bf16, fp16=torch.cuda.is_available() and not bf16)
Trainer(model=model, args=args, train_dataset=ds["train"], eval_dataset=ds["val"],
        data_collator=DataCollatorForSeq2Seq(tok, padding=True, label_pad_token_id=-100)).train()

model = model.merge_and_unload()
model.save_pretrained(OUT)
tok.save_pretrained(OUT)
shutil.copy("data/labels.json", f"{OUT}/labels.json")
del model
torch.cuda.empty_cache()

# ------------------------- evaluation (clean + STT-noisy test sets) -------------------------
from nlu import NLU

nlu = NLU(OUT)
report = {}
for name in ("test", "test_noisy"):
    rows = [json.loads(l) for l in open(f"data/{name}.jsonl", encoding="utf-8")]
    preds = nlu.predict_batch([r["text"] for r in rows])
    yi = [r["intent"] for r in rows];       pi = [p["intent"] for p in preds]
    ys = [f'{r["intent"]}/{r["sub_intent"]}' for r in rows]
    ps = [f'{p["intent"]}/{p["sub_intent"]}' for p in preds]
    slot_rows = [(r, p) for r, p in zip(rows, preds) if r["slots"]]
    slot_ok = [{k: v for k, v in p.items() if k not in ("intent", "sub_intent")} == r["slots"]
               for r, p in slot_rows]
    report[name] = {
        "intent_accuracy": accuracy_score(yi, pi),
        "intent_macro_f1": f1_score(yi, pi, average="macro"),
        "sub_intent_accuracy": accuracy_score(ys, ps),
        "sub_intent_macro_f1": f1_score(ys, ps, average="macro"),
        "slot_exact_match": sum(slot_ok) / max(len(slot_ok), 1),
        "n": len(rows), "n_slot_rows": len(slot_rows)}
    print(name, json.dumps(report[name], indent=1))
json.dump(report, open("models/llm1_metrics.json", "w"), indent=1)
