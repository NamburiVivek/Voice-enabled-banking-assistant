"""
RBI rules retriever (RAG). Put your RBI files in data/rbi/ (.txt .md .csv .json .pdf).

Build index:  python rag.py build
Test query:   python rag.py "what is the UPI transaction limit"
"""
import glob
import json
import os
import sys

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

import numpy as np

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
EMB_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
INDEX = os.path.join(BASE_DIR, "models", "rbi_index.npz")
DEFAULT_FOLDER = os.path.join(BASE_DIR, "data", "rbi")


def load_texts(folder=DEFAULT_FOLDER):
    texts = []
    for path in sorted(glob.glob(f"{folder}/**/*", recursive=True)):
        ext = os.path.splitext(path)[1].lower()
        if ext in (".txt", ".md"):
            texts.append(open(path, encoding="utf-8", errors="ignore").read())
        elif ext == ".csv":
            import pandas as pd
            df = pd.read_csv(path).fillna("")
            texts += [" | ".join(f"{c}: {v}" for c, v in row.items()) for _, row in df.iterrows()]
        elif ext == ".json":
            data = json.load(open(path, encoding="utf-8"))
            items = data if isinstance(data, list) else [data]
            texts += [json.dumps(i, ensure_ascii=False) if not isinstance(i, str) else i for i in items]
        elif ext == ".pdf":
            from pypdf import PdfReader
            texts.append("\n".join((p.extract_text() or "") for p in PdfReader(path).pages))
    return texts


def chunk(text, size=180, overlap=40):
    words = text.split()
    if len(words) <= size:
        return [text] if words else []
    step = size - overlap
    return [" ".join(words[i:i + size]) for i in range(0, len(words) - overlap, step)]


class RBIRetriever:
    def __init__(self, folder=DEFAULT_FOLDER, index=INDEX):
        from sentence_transformers import SentenceTransformer
        try:
            self.emb = SentenceTransformer(EMB_MODEL, local_files_only=True)
        except Exception:
            self.emb = SentenceTransformer(EMB_MODEL)
        if not os.path.exists(index):
            self.build(folder, index)
        d = np.load(index, allow_pickle=True)
        self.vecs, self.chunks = d["vecs"], list(d["chunks"])

    def build(self, folder, index):
        chunks = [c for t in load_texts(folder) for c in chunk(t)]
        if not chunks:
            raise SystemExit(f"No RBI text found in {folder}")
        vecs = self.emb.encode(chunks, normalize_embeddings=True, show_progress_bar=True)
        os.makedirs(os.path.dirname(index), exist_ok=True)
        np.savez(index, vecs=vecs, chunks=np.array(chunks, dtype=object))
        print(f"Indexed {len(chunks)} chunks")

    def search(self, query, k=3, min_score=0.25):
        q = self.emb.encode([query], normalize_embeddings=True)[0]
        scores = self.vecs @ q
        top = np.argsort(-scores)[:k]
        return [(float(scores[i]), self.chunks[i]) for i in top if scores[i] >= min_score]


if __name__ == "__main__":
    if sys.argv[1:] == ["build"]:
        if os.path.exists(INDEX):
            os.remove(INDEX)
        RBIRetriever()
    else:
        r = RBIRetriever()
        for s, c in r.search(" ".join(sys.argv[1:])):
            print(f"[{s:.2f}] {c[:300]}...\n")
