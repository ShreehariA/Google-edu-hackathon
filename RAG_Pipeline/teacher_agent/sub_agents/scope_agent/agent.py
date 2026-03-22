from google.adk.agents import BaseAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events import Event
from typing import AsyncGenerator
from .scope_utils import is_in_scope, rewrite_query, resolve_and_scope

class ScopeGateAgent(BaseAgent):
    async def _run_async_impl(
        self, ctx: InvocationContext
    ) -> AsyncGenerator[Event, None]:
        
        query = ctx.session.state.get("current_query", "")
        result = resolve_and_scope(query, ctx.session.state)
        
        if not result["matched"]:
            ctx.session.state["scope_rejected"] = True
            ctx.session.state["scope_rejected_message"] = result["message"]
            return

        # always write chapter — both TutorAgent and ExploreAgent benefit from it
        ctx.session.state["selected_chapter_name"] = result["chapter_name"]
        
        destination = ctx.session.state.get("scope_gate_destination", "ExploreAgent")
        target_agent = self.sub_agents[0] if destination == "ExploreAgent" else self.sub_agents[1]
        
        async for event in target_agent.run_async(ctx):
            yield event