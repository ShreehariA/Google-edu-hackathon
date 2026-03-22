def compute_focus_chapters(tool_context) -> dict:
    """
    Ranks chapters by weakness_score using the student context payload.
    Writes the top chapter to session.state.
    Returns top 1-2 chapters with scores for the agent to present.
    """
    student_context = tool_context.state.get("student_context", {})

    scores_by_chapter = student_context.get("scores", {}).get("by_chapter", [])
    progress_by_chapter = student_context.get("progress", {}).get("by_chapter", [])

    progress_map = {
        c["chapter_id"]: c["till_date_progress"]
        for c in progress_by_chapter
    }

    ranked = []
    for chapter in scores_by_chapter:
        chapter_id = chapter["chapter_id"]
        till_date_avg = chapter.get("till_date_avg", 1.0)
        till_date_progress = progress_map.get(chapter_id, 1.0)

        weakness_score = (1 - till_date_avg) * 0.6 + (1 - till_date_progress) * 0.4

        ranked.append({
            "chapter_id": chapter_id,
            "chapter_name": chapter["chapter_name"],
            "weakness_score": round(weakness_score, 4),
            "till_date_avg": till_date_avg,
            "till_date_progress": till_date_progress,
        })

    ranked.sort(key=lambda x: x["weakness_score"], reverse=True)

    top = ranked[:2] if len(ranked) >= 2 else ranked

    if top:
        tool_context.state["selected_chapter_id"] = top[0]["chapter_id"]
        tool_context.state["selected_chapter_name"] = top[0]["chapter_name"]

    return {
        "top_chapters": top,
        "all_chapters": [
            {"chapter_id": c["chapter_id"], "chapter_name": c["chapter_name"]}
            for c in ranked
        ],
    }


def select_chapter(chapter_id: str, chapter_name: str, tool_context) -> dict:
    """
    Called when student picks a specific chapter.
    Overwrites session.state with their chosen chapter.
    """
    tool_context.state["selected_chapter_id"] = chapter_id
    tool_context.state["selected_chapter_name"] = chapter_name

    return {
        "status": "ok",
        "selected_chapter_id": chapter_id,
        "selected_chapter_name": chapter_name,
    }