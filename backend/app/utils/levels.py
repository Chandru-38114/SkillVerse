"""
Level computation and teaching eligibility rules.
"""

# Thresholds are provisional
SCORE_THRESHOLDS = {
    "level_1_max": 39,   # score < 40 -> 1
    "level_2_min": 40,   # 40 to 59   -> 2
    "level_2_max": 59,
    "level_3_min": 60,   # 60 to 79   -> 3
    "level_3_max": 79,
    "level_4_min": 80,   # 80+        -> 4
}


def score_to_level(score: float | int | None) -> int:
    """
    Convert a numeric assessment score into a discrete level (0-4).
    - no score -> 0
    - score < 40 -> 1
    - 40 to 59 -> 2
    - 60 to 79 -> 3
    - 80 and above -> 4
    """
    if score is None:
        return 0
    try:
        val = float(score)
    except (ValueError, TypeError):
        return 0

    if val < SCORE_THRESHOLDS["level_2_min"]:
        return 1
    elif val <= SCORE_THRESHOLDS["level_2_max"]:
        return 2
    elif val <= SCORE_THRESHOLDS["level_3_max"]:
        return 3
    else:
        return 4


def is_eligible_to_teach(teacher_level: int, learner_level: int) -> bool:
    """
    User u may teach skill s to user v only if:
    level_num(u, s) >= level_num(v, s) + 2 AND level_num(u, s) >= 2.
    """
    t_lvl = teacher_level if teacher_level is not None else 0
    l_lvl = learner_level if learner_level is not None else 0
    return (t_lvl >= l_lvl + 2) and (t_lvl >= 2)
