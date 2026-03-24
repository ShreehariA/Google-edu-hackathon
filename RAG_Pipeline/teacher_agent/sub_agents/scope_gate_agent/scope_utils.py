import logging
import numpy as np
from vertexai.language_models import TextEmbeddingModel

logger = logging.getLogger(__name__)

model = TextEmbeddingModel.from_pretrained("text-embedding-005")

def embed(texts: list[str]) -> list[np.ndarray]:
    response = model.get_embeddings(texts)
    return [np.array(e.values) for e in response]

def _ensure_ndarray(v) -> np.ndarray:
    """Convert lists (from JSON-deserialized state) back to np.ndarray."""
    if isinstance(v, np.ndarray):
        return v
    return np.array(v)

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


def resolve_and_scope(query: str, session_state: dict) -> dict:
    chapters = session_state.get("chapters", [])
    if not chapters:
        return {
            "matched": False,
            "message": "It looks like you don't have any chapters recorded in your curriculum yet. Let's start with a general exploration of the course!"
        }

    chapter_names = [c["chapter_name"] for c in chapters]
    chapter_ids = [c["chapter_id"] for c in chapters]

    vocab_embeddings = session_state.get("vocab_embeddings", [])

    try:
        # Recompute embeddings if missing or empty
        if not vocab_embeddings:
            vocab_embeddings = embed(chapter_names)
            session_state["vocab_embeddings"] = [v.tolist() for v in vocab_embeddings]
        
        # Ensure all entries are np.ndarray (may have been JSON-deserialized to lists)
        vocab_embeddings = [_ensure_ndarray(v) for v in vocab_embeddings]

        query_embedding = embed([query])[0]
    except Exception as e:
        logger.error("Embedding call failed: %s", e, exc_info=True)
        return {
            "matched": False,
            "message": f"I had trouble matching your request to a chapter. "
                       f"Your chapters are: {', '.join(chapter_names)}. "
                       f"Could you pick one directly?"
        }

    scores = [
        cosine_similarity(query_embedding, v)
        for v in vocab_embeddings
    ]

    best_idx = scores.index(max(scores))
    best_score = scores[best_idx]

    if best_score < 0.55:
        return {
            "matched": False,
            "message": f"I couldn't connect '{query}' to any chapter in your syllabus. "
                       f"Your chapters are: {', '.join(chapter_names)}"
        }

    return {
        "matched":      True,
        "chapter_name": chapter_names[best_idx],
        "chapter_id":   chapter_ids[best_idx],
        "chapter_idx":  best_idx,
        "confidence":   best_score,
    }