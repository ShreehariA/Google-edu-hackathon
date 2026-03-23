from .agent import ScopeGateAgent
from ..explore_agent.agent import explore_agent 
from ..tutor_agent.agent import tutor_agent # imported locally, not bubbled up

scope_gate_agent = ScopeGateAgent(
    name="ScopeGateAgent",
    sub_agents=[explore_agent,tutor_agent]
)