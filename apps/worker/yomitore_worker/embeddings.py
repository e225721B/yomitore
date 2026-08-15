from fastembed import TextEmbedding

# 384次元・多言語対応・ローカル推論（APIキー不要）。fastembed がサポートするモデルから選定。
MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

_model: TextEmbedding | None = None


def _get_model() -> TextEmbedding:
    global _model
    if _model is None:
        _model = TextEmbedding(model_name=MODEL_NAME)
    return _model


def to_vector_literal(embedding: list[float]) -> str:
    return "[" + ",".join(f"{v:.8f}" for v in embedding) + "]"


def embed(text: str) -> list[float]:
    return list(next(_get_model().embed([text])))
