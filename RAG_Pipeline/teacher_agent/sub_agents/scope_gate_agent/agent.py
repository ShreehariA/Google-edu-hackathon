from google.adk.agents import BaseAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events import Event, EventActions
from google.genai import types
from typing import AsyncGenerator
from .scope_utils import resolve_and_scope


class ScopeGateAgent(BaseAgent):
    async def _run_async_impl(
        self, ctx: InvocationContext
    ) -> AsyncGenerator[Event, None]:

        query = ctx.session.state.get("temp:current_query", "")

        if not query:
            yield Event(
                invocation_id=ctx.invocation_id,
                author=self.name,
                content=types.Content(
                    role="model",
                    parts=[types.Part(text=".")]
                ),
                actions=EventActions(state_delta={
                    "temp:scope_rejected":         True,
                    "temp:scope_rejected_message": "I didn't catch what topic you meant — could you try again?",
                }),
            )
            return

        result = resolve_and_scope(query, ctx.session.state)

        if not result["matched"]:
            yield Event(
                invocation_id=ctx.invocation_id,
                author=self.name,
                content=types.Content(
                    role="model",
                    parts=[types.Part(text=result["message"])]
                ),
                actions=EventActions(state_delta={
                    "temp:scope_rejected":         True,
                    "temp:scope_rejected_message": result["message"],
                }),
            )
            return

        # read destination before yield so it can be written to state_delta
        destination = ctx.session.state.get("temp:scope_gate_destination", "TutorAgent")

        yield Event(
            invocation_id=ctx.invocation_id,
            author=self.name,
            content=types.Content(
                role="model",
                parts=[types.Part(text=".")]
            ),
            actions=EventActions(state_delta={
                "selected_chapter_name": result["chapter_name"],
                "selected_chapter_id":   result["chapter_id"],
                "temp:scope_rejected":   False,
                "active_agent":          destination,
            }),
        )

        target_agent = next(
            (a for a in self.sub_agents if a.name == destination),
            None
        )

        if target_agent is None:
            yield Event(
                invocation_id=ctx.invocation_id,
                author=self.name,
                content=types.Content(
                    role="model",
                    parts=[types.Part(text=".")]
                ),
                actions=EventActions(state_delta={
                    "temp:scope_rejected":         True,
                    "temp:scope_rejected_message": f"Unknown destination: {destination}",
                    "active_agent":                "",
                }),
            )
            return

        async for event in target_agent.run_async(ctx):
            yield event