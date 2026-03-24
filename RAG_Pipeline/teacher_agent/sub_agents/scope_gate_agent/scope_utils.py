import os
import numpy as np
import vertexai
from vertexai.language_models import TextEmbeddingModel

vertexai.init(
    project=os.environ.get("GOOGLE_CLOUD_PROJECT", "birmiu-agent-two26bir-4072"),
    location=os.environ.get("GOOGLE_CLOUD_LOCATION", "europe-west2")
)

model = TextEmbeddingModel.from_pretrained("text-embedding-005")

def embed(texts: list[str]) -> list[np.ndarray]:
    response = model.get_embeddings(texts)
    return [np.array(e.values) for e in response]

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

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

    # fallback — recompute embeddings if missing
    if not vocab_embeddings:
        vocab_embeddings = embed(chapter_names)
        session_state["vocab_embeddings"] = vocab_embeddings

    query_embedding = embed([query])[0]

    scores = [
        cosine_similarity(query_embedding, v)
        for v in vocab_embeddings
    ]

    best_idx = scores.index(max(scores))
    best_score = scores[best_idx]

    if best_score < 0.65:
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