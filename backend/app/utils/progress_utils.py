from typing import Optional

def compute_skill_stage(assessments_count: int, sessions_completed: int, badge: Optional[str], level: str, total_learning_minutes: int):
    if badge:
        return "Mastery", f"You successfully passed the final challenge and earned your verified {badge} badge.", "Guide others or explore new skills"
    if sessions_completed >= 5:
        return "Developing", f"You have completed {sessions_completed} sessions. You are now eligible for the final verification challenge.", "Take the final challenge to earn a badge"
    if sessions_completed > 0:
        return "Practicing", f"You have completed {sessions_completed} learning sessions, accumulating {total_learning_minutes} minutes of practice.", f"Complete {5 - sessions_completed} more sessions to reach Developing"
    if assessments_count > 0:
        return "Baseline Established", f"You completed your first assessment, establishing your baseline level as {level}.", "Complete your first learning session"
    return "Discovered", "You have added this skill to your journey.", "Take a skill challenge to establish your baseline"
