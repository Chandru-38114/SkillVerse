"""
Cycle detection service for 3-way circular skill exchanges.
A -> B -> C -> A
where:
  - User A teaches User B skill_ab
  - User B teaches User C skill_bc
  - User C teaches User A skill_ca
under the eligibility rule (teacher level >= learner level + 2 and teacher level >= 2).
"""
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from .. import models
from ..utils.levels import is_eligible_to_teach


def find_cycle_suggestions_for_user(db: Session, user_id: int) -> List[Dict[str, Any]]:
    """
    Find circular exchange suggestions of length 3 (A -> B -> C -> A) involving user_id (User A).
    Only propose a cycle to a user for a skill they want when they have NO direct pair match
    for that skill.
    Returns at most 3 cycle suggestions ranked by the sum of exchange scores.
    """
    # 1. Fetch current user's skills
    my_user_skills = (
        db.query(models.UserSkill)
        .join(models.Skill)
        .filter(models.UserSkill.user_id == user_id)
        .all()
    )
    my_learning = {
        us.skill_id: (us.skill.name, us.level_num or 0)
        for us in my_user_skills if us.role == "learning"
    }
    my_teaching = {
        us.skill_id: (us.skill.name, us.level_num or 0)
        for us in my_user_skills if us.role == "teaching"
    }

    if not my_learning or not my_teaching:
        return []

    # 2. Find which learning skills already have a direct pair match.
    # Pair match: another user can teach me s (eligible) AND wants something I can teach (eligible).
    direct_pair_skills = set()
    other_skills = (
        db.query(models.UserSkill)
        .join(models.Skill)
        .filter(models.UserSkill.user_id != user_id)
        .all()
    )

    # Group other users' skills
    user_skills_map: Dict[int, Dict[str, Dict[int, Tuple[str, int]]]] = {}
    for us in other_skills:
        uid = us.user_id
        if uid not in user_skills_map:
            user_skills_map[uid] = {"teaching": {}, "learning": {}}
        user_skills_map[uid][us.role][us.skill_id] = (us.skill.name, us.level_num or 0)

    for s_data in user_skills_map.values():
        for my_s_id, (_name, my_learn_lvl) in my_learning.items():
            if my_s_id in s_data["teaching"]:
                t_name, t_lvl = s_data["teaching"][my_s_id]
                if is_eligible_to_teach(t_lvl, my_learn_lvl):
                    # Can I teach them anything in return?
                    for my_t_id, (_name, my_teach_lvl) in my_teaching.items():
                        if my_t_id in s_data["learning"]:
                            _, their_learn_lvl = s_data["learning"][my_t_id]
                            if is_eligible_to_teach(my_teach_lvl, their_learn_lvl):
                                direct_pair_skills.add(my_s_id)

    # Skills for which user has no direct pair match:
    eligible_cycle_target_skills = set(my_learning.keys()) - direct_pair_skills
    if not eligible_cycle_target_skills:
        return []

    # 3. Build directed edges between all relevant users:
    # An edge (u -> v, skill_id, skill_name) exists if:
    # u has skill as teaching, v has skill as learning,
    # and is_eligible_to_teach(u_lvl, v_lvl) is True.
    all_users = {user_id}.union(user_skills_map.keys())
    user_full_skills: Dict[int, Dict[str, Dict[int, Tuple[str, int]]]] = {
        user_id: {"teaching": my_teaching, "learning": my_learning}
    }
    user_full_skills.update(user_skills_map)

    # edge map: u -> list of (v, skill_id, skill_name, u_level, v_level)
    edges: Dict[int, List[Tuple[int, int, str, int, int]]] = {u: [] for u in all_users}

    user_ids_list = list(all_users)
    for u in user_ids_list:
        u_teaching = user_full_skills[u]["teaching"]
        for v in user_ids_list:
            if u == v:
                continue
            v_learning = user_full_skills[v]["learning"]
            for s_id, (s_name, u_lvl) in u_teaching.items():
                if s_id in v_learning:
                    _, v_lvl = v_learning[s_id]
                    if is_eligible_to_teach(u_lvl, v_lvl):
                        edges[u].append((v, s_id, s_name, u_lvl, v_lvl))

    # 4. Search for cycles of length exactly 3 containing user_id:
    # A (user_id) -> B -> C -> A
    # Constraint: the skill C teaches A (skill_ca) must be in eligible_cycle_target_skills!
    found_cycles = []
    seen_cycle_keys = set()

    # Pre-fetch user objects for display names
    user_records = {u.id: u for u in db.query(models.User).filter(models.User.id.in_(all_users)).all()}

    for (b, s_ab_id, s_ab_name, lvl_a, lvl_b) in edges[user_id]:
        if b == user_id:
            continue
        for (c, s_bc_id, s_bc_name, lvl_b2, lvl_c) in edges[b]:
            if c in (user_id, b):
                continue
            for (dest, s_ca_id, s_ca_name, lvl_c2, lvl_a2) in edges[c]:
                if dest == user_id and s_ca_id in eligible_cycle_target_skills:
                    # Found a valid 3-cycle: A -> B -> C -> A
                    cycle_key = (s_ab_id, b, s_bc_id, c, s_ca_id)
                    if cycle_key in seen_cycle_keys:
                        continue
                    seen_cycle_keys.add(cycle_key)

                    # Score for cycle: sum of exchange scores (50 baseline per one-way leg)
                    score_ab = 50 + lvl_a
                    score_bc = 50 + lvl_b2
                    score_ca = 50 + lvl_c2
                    total_score = score_ab + score_bc + score_ca

                    found_cycles.append({
                        "total_score": total_score,
                        "members": [
                            {"user_id": user_id, "name": user_records[user_id].name if user_id in user_records else f"User {user_id}"},
                            {"user_id": b, "name": user_records[b].name if b in user_records else f"User {b}"},
                            {"user_id": c, "name": user_records[c].name if c in user_records else f"User {c}"},
                        ],
                        "legs": [
                            {
                                "teacher_id": user_id,
                                "teacher_name": user_records[user_id].name if user_id in user_records else f"User {user_id}",
                                "learner_id": b,
                                "learner_name": user_records[b].name if b in user_records else f"User {b}",
                                "skill_id": s_ab_id,
                                "skill_name": s_ab_name,
                                "teacher_level": lvl_a,
                            },
                            {
                                "teacher_id": b,
                                "teacher_name": user_records[b].name if b in user_records else f"User {b}",
                                "learner_id": c,
                                "learner_name": user_records[c].name if c in user_records else f"User {c}",
                                "skill_id": s_bc_id,
                                "skill_name": s_bc_name,
                                "teacher_level": lvl_b2,
                            },
                            {
                                "teacher_id": c,
                                "teacher_name": user_records[c].name if c in user_records else f"User {c}",
                                "learner_id": user_id,
                                "learner_name": user_records[user_id].name if user_id in user_records else f"User {user_id}",
                                "skill_id": s_ca_id,
                                "skill_name": s_ca_name,
                                "teacher_level": lvl_c2,
                            },
                        ]
                    })

    # Rank cycles by total_score descending and return at most 3
    found_cycles.sort(key=lambda x: x["total_score"], reverse=True)
    return found_cycles[:3]
