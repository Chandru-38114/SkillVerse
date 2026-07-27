from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas, auth
from ..database import get_db
from ..data.questions import get_questions_for_skill
from .users import get_or_create_skill

router = APIRouter(prefix="/assessments", tags=["assessments"])


@router.get("/questions/{skill_name}")
def get_assessment_questions(skill_name: str):
    """Returns questions WITHOUT the answer key."""
    questions = get_questions_for_skill(skill_name)
    return [
        {"id": q["id"], "topic": q["topic"], "type": q["type"],
         "question": q["question"], "options": q["options"]}
        for q in questions
    ]


def level_for_score(score: float) -> str:
    if score < 40:
        return "Beginner"
    if score < 70:
        return "Intermediate"
    return "Advanced"


def badge_for_score(score: float):
    if score >= 90:
        return "Expert"
    if score >= 75:
        return "Gold"
    if score >= 60:
        return "Silver"
    if score >= 40:
        return "Bronze"
    return None


def study_plan_for_topics(weak_topics: list[str]) -> list[str]:
    if not weak_topics:
        return ["You're solid across the board — consider teaching this skill to others."]
    return [f"Day {i+1}: Focus on {topic}" for i, topic in enumerate(weak_topics)]


@router.post("/submit", response_model=schemas.AssessmentResult)
def submit_assessment(
    payload: schemas.AssessmentSubmit,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    questions = get_questions_for_skill(payload.skill_name)
    if not questions:
        raise HTTPException(status_code=404, detail="No questions for this skill")

    answer_key = {q["id"]: q for q in questions}
    submitted = {a.question_id: a.answer for a in payload.answers}

    per_topic_correct = {}
    per_topic_total = {}
    correct_count = 0

    for q in questions:
        topic = q["topic"]
        per_topic_total[topic] = per_topic_total.get(topic, 0) + 1
        is_correct = submitted.get(q["id"]) == q["answer"]
        if is_correct:
            correct_count += 1
            per_topic_correct[topic] = per_topic_correct.get(topic, 0) + 1

    score = round((correct_count / len(questions)) * 100, 1)
    level = level_for_score(score)
    badge = badge_for_score(score)

    # Weak topics = topics where the user got less than 60% right
    weak_topics = [
        topic for topic in per_topic_total
        if (per_topic_correct.get(topic, 0) / per_topic_total[topic]) < 0.6
    ]
    study_plan = study_plan_for_topics(weak_topics)

    # Persist attempt + update the user's skill record
    attempt = models.AssessmentAttempt(
        user_id=current_user.id,
        skill_id=get_or_create_skill(db, payload.skill_name).id,
        score=score,
        weak_topics=",".join(weak_topics),
    )
    db.add(attempt)

    skill = get_or_create_skill(db, payload.skill_name)
    user_skill = (
        db.query(models.UserSkill)
        .filter(models.UserSkill.user_id == current_user.id, models.UserSkill.skill_id == skill.id)
        .first()
    )
    if not user_skill:
        user_skill = models.UserSkill(user_id=current_user.id, skill_id=skill.id, role=payload.role)
        db.add(user_skill)

    user_skill.latest_score = score
    user_skill.level = level
    user_skill.badge = badge
    user_skill.role = payload.role

    # Award points for completing a certification, per the points economy
    if badge:
        current_user.points += 50

    db.commit()

    return schemas.AssessmentResult(
        score=score, level=level, badge=badge,
        weak_topics=weak_topics, study_plan=study_plan,
    )