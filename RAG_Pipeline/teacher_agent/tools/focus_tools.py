def compute_focus_chapters(tool_context) -> dict:
    """
    Ranks chapters by weakness_score using the flat session state.
    Writes the top chapter to session.state.
    Returns top 1-2 chapters with scores for the agent to present.
    """
    chapters = tool_context.state.get("chapters", [])

    ranked = []
    for chapter in chapters:
        chapter_id            = chapter["chapter_id"]
        score_till_date_avg   = chapter.get("score_till_date_avg", 0.0)
        progress_till_date    = chapter.get("progress_till_date", 0.0)

        if progress_till_date == 0.0 and score_till_date_avg == 0.0:
            continue

        weakness_score = (
            (1 - score_till_date_avg) * 0.6 +
            (1 - progress_till_date)  * 0.4
        )

        ranked.append({
            "chapter_id":          chapter_id,
            "chapter_name":        chapter["chapter_name"],
            "weakness_score":      round(weakness_score, 4),
            "score_till_date_avg": score_till_date_avg,
            "progress_till_date":  progress_till_date,
        })

    ranked.sort(key=lambda x: x["weakness_score"], reverse=True)

    top = ranked[:2] if len(ranked) >= 2 else ranked

    if top:
        tool_context.state["selected_chapter_id"]   = top[0]["chapter_id"]
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
    tool_context.state["selected_chapter_id"]   = chapter_id
    tool_context.state["selected_chapter_name"] = chapter_name

    return {
        "status":              "ok",
        "selected_chapter_id":   chapter_id,
        "selected_chapter_name": chapter_name,
    }