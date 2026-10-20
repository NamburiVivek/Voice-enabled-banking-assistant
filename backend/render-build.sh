#!/usr/bin/env bash
# Exit immediately if a command exits with a non-zero status
set -o errexit

echo "📦 Installing backend requirements with CPU-optimized PyTorch..."
pip install --upgrade pip
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
if [ -f ai/requirements.txt ]; then
    pip install -r ai/requirements.txt
fi

echo "🧠 Pre-caching sentence-transformers embedding model for instantaneous startup..."
python -c "
try:
    from sentence_transformers import SentenceTransformer
    SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
    print('✅ Pre-cached sentence-transformers/all-MiniLM-L6-v2 successfully.')
except Exception as e:
    print('⚠️ Notice during pre-cache:', e)
"
