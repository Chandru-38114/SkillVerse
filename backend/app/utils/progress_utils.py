from typing import Optional

# Kept in sync with services/course_rules.py (not imported to avoid a cycle).
SESSIONS_FOR_FINAL = 5
PERCENT_PER_SESSION = 16
FINAL_PASS_SCORE = 60


def compute_skill_stage(assessments_count: int, sessions_completed: int, badge: Optional[str], level: str,
                        total_learning_minutes: int, role: str = "learning", course_completed: bool = False):
    """(stage, what happened, next step) for the Progress page.

    Learners go Discovered -> Baseline Established -> Practicing (1-4 sessions)
    -> Developing (5 sessions, final challenge unlocked) -> Mastery (passed the
    final challenge after the sessions). A badge alone is NOT Mastery any more:
    it used to hand out certificates for one 40% test with zero sessions.
    Teachers are shown as Teaching; the learner stages don't apply to them."""
    sessions_completed = int(sessions_completed or 0)
    if role == "teaching":
        badge_part = f" with a {badge} badge" if badge else ""
        return (
            "Teaching",
            f"You are a verified tutor for this course{badge_part}. You have taught {sessions_completed} session(s).",
            "Accept learner requests and keep teaching",
        )
    if course_completed:
        return "Mastery", "You completed the sessions and passed the final challenge. Course complete!", "Download your certificate"
    if sessions_completed >= SESSIONS_FOR_FINAL:
        return (
            "Developing",
            f"You have completed {sessions_completed} sessions. The final challenge is now unlocked.",
            f"Pass the final Skill Arena challenge with {FINAL_PASS_SCORE}% or more to finish the course",
        )
    if sessions_completed > 0:
        left = SESSIONS_FOR_FINAL - sessions_completed
        return (
            "Practicing",
            f"You have completed {sessions_completed} learning session(s), {total_learning_minutes or 0} minutes of practice.",
            f"Complete {left} more session{'s' if left != 1 else ''} to unlock the final challenge",
        )
    if assessments_count > 0:
        return "Baseline Established", f"You took your first assessment. Your starting level is {level}.", "Complete your first learning session"
    return "Discovered", "You have added this course to your journey.", "Take a Skill Arena challenge to find your starting level"


def compute_progress_percentage(sessions_completed: int, badge: Optional[str] = None,
                                role: str = "learning", course_completed: bool = False) -> int:
    """Course progress for a learner: each completed session is 16%, so the
    5 sessions that unlock the final challenge make 80%. Passing the final
    challenge makes 100%. (The badge no longer jumps straight to 100%.)
    A verified teacher's course shows 100%."""
    if role == "teaching" or course_completed:
        return 100
    done = min(int(sessions_completed or 0), SESSIONS_FOR_FINAL)
    return max(0, done * PERCENT_PER_SESSION)


def progress_for(us) -> int:
    """Progress for a UserSkill row."""
    return compute_progress_percentage(
        us.sessions_completed or 0, us.badge, us.role or "learning", us.course_completed_at is not None,
    )


def stage_for(us, assessments_count: int):
    return compute_skill_stage(
        assessments_count, us.sessions_completed or 0, us.badge, us.level, us.total_learning_minutes or 0,
        us.role or "learning", us.course_completed_at is not None,
    )
