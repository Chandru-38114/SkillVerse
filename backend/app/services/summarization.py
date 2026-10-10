import logging
from typing import Optional

from .question_generator import generate_text

logger = logging.getLogger(__name__)

def generate_session_summary(chat_history: str, whiteboard_state: str, compiler_code: str) -> Optional[str]:
    """
    Generates a semantic summary of the learning session based on the raw room data.
    """
    prompt = f"""
    You are an AI assistant summarizing a learning session.
    Below is the raw data from the session:

    --- CHAT HISTORY ---
    {chat_history}

    --- WHITEBOARD STATE (JSON) ---
    {whiteboard_state}

    --- COMPILER CODE ---
    {compiler_code}

    Please provide a concise, 2-3 sentence semantic summary of what actually happened during this learning session.

    STRICT RULES:
    - Must be short (maximum 2-3 sentences).
    - Describe ONLY facts present in the supplied session data. Focus on what was discussed, drawn, and coded.
    - DO NOT invent achievements, mastery, or learning outcomes.
    - DO NOT assess the learner's skill level.
    - This is informational only.
    """

    return generate_text(prompt)
