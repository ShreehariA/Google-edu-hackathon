def set_scope_gate_destination(
    destination: str,
    current_query: str,
    tool_context,
) -> dict:
    """
    Called by the Orchestrator before every ScopeGateAgent transfer.
    Writes scope_gate_destination and current_query to session state.

    Args:
        destination: either "TutorAgent" or "ExploreAgent"
        current_query: the topic or question the student mentioned
    """
    if destination not in ("TutorAgent", "ExploreAgent"):
        return {"error": f"Invalid destination: {destination}"}

    tool_context.state["temp:scope_gate_destination"] = destination
    tool_context.state["temp:current_query"] = current_query

    return {
        "status": "ok",
        "scope_gate_destination": destination,
        "current_query": current_query,
    }


def clear_scope_gate_state(tool_context) -> dict:
    """
    Called by the Orchestrator after ScopeGateAgent returns.
    Clears per-turn state so it doesn't bleed into the next message.
    """
    tool_context.state["temp:scope_gate_destination"] = None
    tool_context.state["temp:current_query"]          = None
    tool_context.state["temp:scope_rejected"]         = False
    tool_context.state["temp:scope_rejected_message"] = None
    tool_context.state["temp:chip_selected"]          = None

    return {"status": "cleared"}

def clear_active_agent(tool_context) -> dict:
    """Called when student explicitly switches away from active agent."""
    tool_context.state["active_agent"] = ""
    return {"status": "cleared"}

def set_active_agent(agent_name: str, tool_context) -> dict:
    """Sets the active agent so the Orchestrator knows to stay in it."""
    tool_context.state["active_agent"] = agent_name
    return {"status": "ok", "active_agent": agent_name}