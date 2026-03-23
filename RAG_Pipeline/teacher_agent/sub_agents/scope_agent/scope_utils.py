import numpy as np
from vertexai.language_models import TextEmbeddingModel

model = TextEmbeddingModel.from_pretrained("text-embedding-004")

def embed(texts: list[str]) -> list[np.ndarray]:
    response = model.get_embeddings(texts)
    return [np.array(e.values) for e in response]

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))


def resolve_and_scope(query: str, session_state: dict) -> dict:
    query_embedding = embed([query])[0]
    vocab_embeddings = session_state["vocab_embeddings"]
    chapter_vocabulary = session_state["chapter_vocabulary"]
    
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
                       f"Your chapters are: {', '.join(chapter_vocabulary)}"
        }
    
    return {
        "matched": True,
        "chapter_name": chapter_vocabulary[best_idx],
        "chapter_idx": best_idx,
        "confidence": best_score,
    }