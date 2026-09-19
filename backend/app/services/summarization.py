import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

try:
    import google.generativeai as genai
    HAS_GENAI = True
except ImportError:
    HAS_GENAI = False
    logger.warning("google.generativeai not installed. Summarization will return a placeholder.")

def generate_session_summary(chat_history: str, whiteboard_state: str, compiler_code: str) -> Optional[str]:
    """
    Generates a semantic summary of the learning session based on the raw room data.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not HAS_GENAI or not api_key:
        # Return a fallback summary if the API isn't configured
        return None

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")
        
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
        
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        logger.error(f"Failed to generate session summary: {e}")
        return "Error generating session summary."
