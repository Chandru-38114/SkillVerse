"""
Community Router — Teachers-only Community and Lounge Feed.

Access Control:
- require_teacher dependency checks has_taught via teacher_stats_service helper.
  Only teachers with >= 1 completed session as tutor can enter.
- GET /community/access returns {"has_taught": bool} so frontend can show a locked state.

Lounge Feed:
- POST /community/lounge/posts: rate-limited to 1 post per 30 seconds per user, max length 2000 chars.
- GET /community/lounge/posts: paginated, newest first, author details, comment_count.
- GET /community/lounge/posts/{id}: post detail with comments.
- POST /community/lounge/posts/{id}/comments: comment on post.
- DELETE /community/lounge/posts/{id}: post author only.
- DELETE /community/lounge/comments/{id}: comment author or post author.
"""
from typing import List, Optional
import datetime as dt
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from .. import models, schemas, auth
from ..database import get_db
from ..utils.timezone import utc_now
from ..services.teacher_stats_service import check_user_has_taught

router = APIRouter(prefix="/community", tags=["community"])


def require_teacher(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
) -> models.User:
    """
    Dependency ensuring that current_user has taught at least one completed session.
    Reuses teacher_stats_service helper to ensure single source of truth.
    Raises 403 Forbidden if the user is not a qualified teacher.
    """
    if not check_user_has_taught(db, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. The Community Lounge is restricted to teachers with at least one completed session.",
        )
    return current_user


# ── Access Check ─────────────────────────────────────────────────────────────

@router.get("/access", response_model=schemas.CommunityAccessOut)
def get_community_access(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns whether the current user has access to the community lounge.
    Allows frontend to render a locked state rather than hitting a 403 error wall.
    """
    has_taught = check_user_has_taught(db, current_user.id)
    return schemas.CommunityAccessOut(has_taught=has_taught)


# ── Lounge Posts ─────────────────────────────────────────────────────────────

@router.post("/lounge/posts", response_model=schemas.LoungePostOut)
def create_lounge_post(
    payload: schemas.LoungePostCreate,
    current_user: models.User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """
    Create a new post in the Teacher Lounge.
    Gated by require_teacher.
    Enforces rate limit: maximum 1 post every 30 seconds per user.
    """
    # Rate limit check: inspect last post created by this author
    latest_post = (
        db.query(models.LoungePost)
        .filter(models.LoungePost.author_id == current_user.id)
        .order_by(models.LoungePost.created_at.desc())
        .first()
    )
    if latest_post and latest_post.created_at:
        now = utc_now()
        latest_created = latest_post.created_at
        if latest_created.tzinfo is not None and now.tzinfo is None:
            latest_created = latest_created.replace(tzinfo=None)
        elif latest_created.tzinfo is None and now.tzinfo is not None:
            now = now.replace(tzinfo=None)

        elapsed = (now - latest_created).total_seconds()
        if elapsed < 30:
            remaining = int(30 - elapsed)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Please wait {remaining} seconds before posting again.",
            )

    post = models.LoungePost(
        author_id=current_user.id,
        body=payload.body,
        created_at=utc_now(),
    )
    db.add(post)
    db.commit()
    db.refresh(post)

    return schemas.LoungePostOut(
        id=post.id,
        author_id=post.author_id,
        author_name=current_user.name,
        author_college=current_user.college or "",
        author_avatar_url=current_user.profile_picture_url,
        body=post.body,
        created_at=post.created_at,
        edited_at=post.edited_at,
        comment_count=0,
    )


@router.get("/lounge/posts", response_model=List[schemas.LoungePostOut])
def get_lounge_posts(
    limit: int = 20,
    offset: int = 0,
    skip: Optional[int] = None,
    current_user: models.User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """
    Get paginated Lounge posts, ordered newest first.
    Includes author name and comment_count.
    Gated by require_teacher.
    """
    if hasattr(limit, "default"):
        limit = limit.default or 20
    if hasattr(offset, "default"):
        offset = offset.default or 0
    if hasattr(skip, "default"):
        skip = skip.default

    limit = max(1, min(100, int(limit)))
    if skip is not None and offset == 0:
        offset = int(skip)
    else:
        offset = max(0, int(offset))

    posts = (
        db.query(models.LoungePost)
        .order_by(models.LoungePost.created_at.desc(), models.LoungePost.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    if not posts:
        return []

    post_ids = [p.id for p in posts]
    comment_counts = dict(
        db.query(
            models.LoungeComment.post_id,
            func.count(models.LoungeComment.id)
        )
        .filter(models.LoungeComment.post_id.in_(post_ids))
        .group_by(models.LoungeComment.post_id)
        .all()
    )

    results = []
    for p in posts:
        author_name = p.author.name if p.author else "Teacher"
        author_college = p.author.college if p.author and p.author.college else ""
        author_avatar = p.author.profile_picture_url if p.author else None
        results.append(
            schemas.LoungePostOut(
                id=p.id,
                author_id=p.author_id,
                author_name=author_name,
                author_college=author_college,
                author_avatar_url=author_avatar,
                body=p.body,
                created_at=p.created_at,
                edited_at=p.edited_at,
                comment_count=comment_counts.get(p.id, 0),
            )
        )
    return results


@router.get("/lounge/posts/{id}", response_model=schemas.LoungePostDetailOut)
def get_lounge_post_detail(
    id: int,
    current_user: models.User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """
    Get details of a single post and all of its comments.
    Gated by require_teacher.
    """
    post = db.query(models.LoungePost).filter(models.LoungePost.id == id).first()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found.",
        )

    comment_items = [
        schemas.LoungeCommentOut(
            id=c.id,
            post_id=c.post_id,
            author_id=c.author_id,
            author_name=c.author.name if c.author else "Teacher",
            author_college=c.author.college if c.author and c.author.college else "",
            author_avatar_url=c.author.profile_picture_url if c.author else None,
            body=c.body,
            created_at=c.created_at,
        )
        for c in post.comments
    ]

    author_name = post.author.name if post.author else "Teacher"
    author_college = post.author.college if post.author and post.author.college else ""
    author_avatar = post.author.profile_picture_url if post.author else None

    return schemas.LoungePostDetailOut(
        id=post.id,
        author_id=post.author_id,
        author_name=author_name,
        author_college=author_college,
        author_avatar_url=author_avatar,
        body=post.body,
        created_at=post.created_at,
        edited_at=post.edited_at,
        comment_count=len(comment_items),
        comments=comment_items,
    )


@router.post("/lounge/posts/{id}/comments", response_model=schemas.LoungeCommentOut)
def create_lounge_comment(
    id: int,
    payload: schemas.LoungeCommentCreate,
    current_user: models.User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """
    Add a comment to a Lounge post.
    Gated by require_teacher.
    """
    post = db.query(models.LoungePost).filter(models.LoungePost.id == id).first()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found.",
        )

    comment = models.LoungeComment(
        post_id=post.id,
        author_id=current_user.id,
        body=payload.body,
        created_at=utc_now(),
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    return schemas.LoungeCommentOut(
        id=comment.id,
        post_id=comment.post_id,
        author_id=comment.author_id,
        author_name=current_user.name,
        author_college=current_user.college or "",
        author_avatar_url=current_user.profile_picture_url,
        body=comment.body,
        created_at=comment.created_at,
    )


@router.delete("/lounge/posts/{id}")
def delete_lounge_post(
    id: int,
    current_user: models.User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """
    Delete a Lounge post.
    Author-only permission: only the author of the post can delete it.
    Gated by require_teacher.
    """
    post = db.query(models.LoungePost).filter(models.LoungePost.id == id).first()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found.",
        )

    if post.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to delete this post. Only the post author can delete it.",
        )

    db.delete(post)
    db.commit()
    return {"status": "success", "message": "Post deleted successfully", "id": id}


@router.delete("/lounge/comments/{id}")
@router.delete("/lounge/posts/{post_id}/comments/{id}")
def delete_lounge_comment(
    id: int,
    post_id: Optional[int] = None,
    current_user: models.User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """
    Delete a Lounge comment.
    Allowed by comment author OR the parent post's author (for thread moderation).
    Gated by require_teacher.
    """
    comment = db.query(models.LoungeComment).filter(models.LoungeComment.id == id).first()
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found.",
        )

    # Permission check: comment author OR parent post author
    is_comment_author = (comment.author_id == current_user.id)
    is_post_author = (comment.post and comment.post.author_id == current_user.id)

    if not (is_comment_author or is_post_author):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to delete this comment. Only the comment author or post author can delete it.",
        )

    db.delete(comment)
    db.commit()
    return {"status": "success", "message": "Comment deleted successfully", "id": id}


# ── Study Circles (Scheduled group sessions) ────────────────────────────────

def _serialize_study_circle(
    circle: models.StudyCircle,
    current_user_id: int,
    participant_count: Optional[int] = None,
    is_joined: Optional[bool] = None,
    include_participants: bool = False,
) -> schemas.StudyCircleOut:
    host = circle.host
    parts = circle.participants or []
    part_count = len(parts) if participant_count is None else participant_count
    joined = any(p.user_id == current_user_id for p in parts) if is_joined is None else is_joined

    parts_out: List[schemas.StudyCircleParticipantOut] = []
    if include_participants and parts:
        for p in parts:
            parts_out.append(
                schemas.StudyCircleParticipantOut(
                    id=p.id,
                    circle_id=p.circle_id,
                    user_id=p.user_id,
                    user_name=p.user.name if p.user else "Teacher",
                    user_college=(p.user.college or "") if p.user else "",
                    user_avatar_url=p.user.profile_picture_url if p.user else None,
                    joined_at=p.joined_at,
                )
            )

    return schemas.StudyCircleOut(
        id=circle.id,
        title=circle.title,
        description=circle.description,
        host_id=circle.host_id,
        host_name=host.name if host else "Teacher",
        host_college=(host.college or "") if host else "",
        host_avatar_url=host.profile_picture_url if host else None,
        skill_id=circle.skill_id,
        skill_name=circle.skill.name if circle.skill else None,
        scheduled_at=circle.scheduled_at,
        max_participants=circle.max_participants,
        status=circle.status,
        created_at=circle.created_at,
        participant_count=part_count,
        is_joined=joined,
        is_host=(circle.host_id == current_user_id),
        participants=parts_out,
    )


@router.post("/study-circles", response_model=schemas.StudyCircleOut)
def create_study_circle(
    payload: schemas.StudyCircleCreate,
    current_user: models.User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """
    Create a new teacher study circle.
    Gated by require_teacher.
    """
    circle = models.StudyCircle(
        title=payload.title,
        description=payload.description,
        host_id=current_user.id,
        skill_id=payload.skill_id,
        scheduled_at=payload.scheduled_at,
        max_participants=payload.max_participants or 8,
        status="scheduled",
        created_at=utc_now(),
    )
    db.add(circle)
    db.commit()
    db.refresh(circle)
    return _serialize_study_circle(circle, current_user.id, participant_count=0, is_joined=False)


@router.get("/study-circles", response_model=List[schemas.StudyCircleOut])
def list_study_circles(
    limit: int = 20,
    offset: int = 0,
    status_filter: Optional[str] = None,
    current_user: models.User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """
    List upcoming study circles (paginated, newest/soonest first).
    Gated by require_teacher.
    """
    if hasattr(limit, "default"):
        limit = limit.default or 20
    if hasattr(offset, "default"):
        offset = offset.default or 0
    if hasattr(status_filter, "default"):
        status_filter = status_filter.default

    query = db.query(models.StudyCircle)
    if isinstance(status_filter, str) and status_filter:
        query = query.filter(models.StudyCircle.status == status_filter)
    else:
        query = query.filter(models.StudyCircle.status == "scheduled")

    circles = (
        query.order_by(models.StudyCircle.scheduled_at.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    circle_ids = [c.id for c in circles]

    counts_map = {}
    joined_set = set()
    if circle_ids:
        counts = (
            db.query(
                models.StudyCircleParticipant.circle_id,
                func.count(models.StudyCircleParticipant.id),
            )
            .filter(models.StudyCircleParticipant.circle_id.in_(circle_ids))
            .group_by(models.StudyCircleParticipant.circle_id)
            .all()
        )
        counts_map = {cid: cnt for cid, cnt in counts}

        my_joins = (
            db.query(models.StudyCircleParticipant.circle_id)
            .filter(
                models.StudyCircleParticipant.circle_id.in_(circle_ids),
                models.StudyCircleParticipant.user_id == current_user.id,
            )
            .all()
        )
        joined_set = {j[0] for j in my_joins}

    return [
        _serialize_study_circle(
            c,
            current_user.id,
            participant_count=counts_map.get(c.id, 0),
            is_joined=(c.id in joined_set),
            include_participants=False,
        )
        for c in circles
    ]


@router.post("/study-circles/{circle_id}/join", response_model=schemas.StudyCircleOut)
def join_study_circle(
    circle_id: int,
    current_user: models.User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """
    Join a study circle.
    Enforces capacity (max_participants) and prevents duplicate joins.
    """
    circle = db.query(models.StudyCircle).filter(models.StudyCircle.id == circle_id).first()
    if not circle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study circle not found.",
        )

    if circle.status in ("completed", "cancelled"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot join a completed or cancelled study circle.",
        )

    existing = (
        db.query(models.StudyCircleParticipant)
        .filter(
            models.StudyCircleParticipant.circle_id == circle_id,
            models.StudyCircleParticipant.user_id == current_user.id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already joined this study circle.",
        )

    current_count = (
        db.query(func.count(models.StudyCircleParticipant.id))
        .filter(models.StudyCircleParticipant.circle_id == circle_id)
        .scalar()
    ) or 0
    if current_count >= circle.max_participants:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Study circle has reached maximum capacity.",
        )

    participant = models.StudyCircleParticipant(
        circle_id=circle.id,
        user_id=current_user.id,
        joined_at=utc_now(),
    )
    db.add(participant)
    db.commit()
    db.refresh(circle)
    return _serialize_study_circle(
        circle,
        current_user.id,
        participant_count=current_count + 1,
        is_joined=True,
        include_participants=True,
    )


@router.post("/study-circles/{circle_id}/leave")
def leave_study_circle(
    circle_id: int,
    current_user: models.User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """
    Leave a joined study circle.
    """
    circle = db.query(models.StudyCircle).filter(models.StudyCircle.id == circle_id).first()
    if not circle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study circle not found.",
        )

    participant = (
        db.query(models.StudyCircleParticipant)
        .filter(
            models.StudyCircleParticipant.circle_id == circle_id,
            models.StudyCircleParticipant.user_id == current_user.id,
        )
        .first()
    )
    if not participant:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are not a participant in this study circle.",
        )

    db.delete(participant)
    db.commit()
    return {"status": "success", "message": "Left study circle successfully."}


@router.post("/study-circles/{circle_id}/complete", response_model=schemas.StudyCircleOut)
def complete_study_circle(
    circle_id: int,
    current_user: models.User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """
    Mark a study circle as completed. Host-only.
    Feeds the study_circle_regular badge.
    """
    circle = db.query(models.StudyCircle).filter(models.StudyCircle.id == circle_id).first()
    if not circle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study circle not found.",
        )

    if circle.host_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the host can mark this study circle as completed.",
        )

    if circle.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot complete a cancelled study circle.",
        )

    circle.status = "completed"
    db.commit()
    db.refresh(circle)
    return _serialize_study_circle(circle, current_user.id, include_participants=True)


@router.delete("/study-circles/{circle_id}")
def delete_study_circle(
    circle_id: int,
    current_user: models.User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """
    Delete a study circle. Host-only, and only if not yet completed.
    """
    circle = db.query(models.StudyCircle).filter(models.StudyCircle.id == circle_id).first()
    if not circle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study circle not found.",
        )

    if circle.host_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the host can delete this study circle.",
        )

    if circle.status == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete a completed study circle.",
        )

    db.delete(circle)
    db.commit()
    return {"status": "success", "message": "Study circle deleted successfully."}


# ── Ask-a-Senior (Teacher-only Q&A) ──────────────────────────────────────────

def _serialize_senior_question(
    q: models.SeniorQuestion,
    answer_count: int = 0,
) -> schemas.SeniorQuestionOut:
    author = q.author
    return schemas.SeniorQuestionOut(
        id=q.id,
        author_id=q.author_id,
        author_name=author.name if author else "Teacher",
        author_college=(author.college or "") if author else "",
        author_avatar_url=author.profile_picture_url if author else None,
        body=q.body,
        status=q.status,
        created_at=q.created_at,
        answer_count=answer_count,
    )


@router.post("/ask-senior/questions", response_model=schemas.SeniorQuestionOut)
def create_senior_question(
    payload: schemas.SeniorQuestionCreate,
    current_user: models.User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """
    Post a new question in Ask-a-Senior.
    Gated by require_teacher.
    """
    question = models.SeniorQuestion(
        author_id=current_user.id,
        body=payload.body,
        status="open",
        created_at=utc_now(),
    )
    db.add(question)
    db.commit()
    db.refresh(question)
    return _serialize_senior_question(question, answer_count=0)


@router.get("/ask-senior/questions", response_model=List[schemas.SeniorQuestionOut])
def list_senior_questions(
    limit: int = 20,
    offset: int = 0,
    status_filter: Optional[str] = None,
    current_user: models.User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """
    List questions in Ask-a-Senior (paginated, newest first, optional status filter).
    """
    if hasattr(limit, "default"):
        limit = limit.default or 20
    if hasattr(offset, "default"):
        offset = offset.default or 0
    if hasattr(status_filter, "default"):
        status_filter = status_filter.default

    query = db.query(models.SeniorQuestion)
    if isinstance(status_filter, str) and status_filter:
        query = query.filter(models.SeniorQuestion.status == status_filter)

    questions = (
        query.order_by(models.SeniorQuestion.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    q_ids = [q.id for q in questions]

    answer_counts = {}
    if q_ids:
        counts = (
            db.query(models.SeniorAnswer.question_id, func.count(models.SeniorAnswer.id))
            .filter(models.SeniorAnswer.question_id.in_(q_ids))
            .group_by(models.SeniorAnswer.question_id)
            .all()
        )
        answer_counts = {qid: cnt for qid, cnt in counts}

    return [
        _serialize_senior_question(q, answer_count=answer_counts.get(q.id, 0))
        for q in questions
    ]


@router.post("/ask-senior/questions/{question_id}/answers", response_model=schemas.SeniorAnswerOut)
def create_senior_answer(
    question_id: int,
    payload: schemas.SeniorAnswerCreate,
    current_user: models.User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """
    Submit an answer to an Ask-a-Senior question.
    Updates the question status to 'answered'. Feeds the senior_advisor badge.
    """
    question = db.query(models.SeniorQuestion).filter(models.SeniorQuestion.id == question_id).first()
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found.",
        )

    answer = models.SeniorAnswer(
        question_id=question.id,
        author_id=current_user.id,
        body=payload.body,
        created_at=utc_now(),
    )
    db.add(answer)
    question.status = "answered"
    db.commit()
    db.refresh(answer)

    return schemas.SeniorAnswerOut(
        id=answer.id,
        question_id=answer.question_id,
        author_id=answer.author_id,
        author_name=current_user.name,
        author_college=current_user.college or "",
        author_avatar_url=current_user.profile_picture_url,
        body=answer.body,
        created_at=answer.created_at,
    )


@router.get("/ask-senior/questions/{question_id}", response_model=schemas.SeniorQuestionDetailOut)
def get_senior_question(
    question_id: int,
    current_user: models.User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """
    Fetch a question and its answers.
    """
    question = db.query(models.SeniorQuestion).filter(models.SeniorQuestion.id == question_id).first()
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found.",
        )

    answers = question.answers or []
    answers_out = [
        schemas.SeniorAnswerOut(
            id=a.id,
            question_id=a.question_id,
            author_id=a.author_id,
            author_name=a.author.name if a.author else "Teacher",
            author_college=(a.author.college or "") if a.author else "",
            author_avatar_url=a.author.profile_picture_url if a.author else None,
            body=a.body,
            created_at=a.created_at,
        )
        for a in answers
    ]

    base = _serialize_senior_question(question, answer_count=len(answers_out))
    return schemas.SeniorQuestionDetailOut(
        id=base.id,
        author_id=base.author_id,
        author_name=base.author_name,
        author_college=base.author_college,
        author_avatar_url=base.author_avatar_url,
        body=base.body,
        status=base.status,
        created_at=base.created_at,
        answer_count=base.answer_count,
        answers=answers_out,
    )


# ── Weekly Challenges (Rotating prompt teachers respond to) ───────────────────

WEEKLY_PROMPTS = [
    "Share one teaching technique or analogy that had the biggest breakthrough with a struggling learner this week.",
    "How do you prepare your lesson materials to balance depth of concepts with hands-on practice?",
    "What is your strategy for giving constructive feedback that encourages learners without discouraging them?",
    "Describe a time a learner asked a question you didn't know the answer to on the spot. How did you handle it?",
    "What is your favorite icebreaker to establish trust and psychological safety in a 1-on-1 session?",
    "How do you adapt your pacing when you realize a learner is grasping material much faster (or slower) than anticipated?",
    "Share your go-to method for verifying that a learner truly understands a concept before moving on to the next topic.",
]


def get_current_week_monday() -> dt.date:
    today = dt.date.today()
    return today - dt.timedelta(days=today.weekday())


def _get_or_create_current_weekly_challenge(db: Session) -> models.WeeklyChallenge:
    current_monday = get_current_week_monday()
    challenge = (
        db.query(models.WeeklyChallenge)
        .filter(models.WeeklyChallenge.week_start == current_monday)
        .first()
    )
    if challenge:
        return challenge

    iso_week = current_monday.isocalendar()[1]
    prompt_idx = iso_week % len(WEEKLY_PROMPTS)
    prompt = WEEKLY_PROMPTS[prompt_idx]

    try:
        challenge = models.WeeklyChallenge(
            prompt=prompt,
            week_start=current_monday,
            created_at=utc_now(),
        )
        db.add(challenge)
        db.commit()
        db.refresh(challenge)
        return challenge
    except Exception:
        db.rollback()
        existing = (
            db.query(models.WeeklyChallenge)
            .filter(models.WeeklyChallenge.week_start == current_monday)
            .first()
        )
        if existing:
            return existing
        raise


@router.get("/weekly-challenge/current", response_model=schemas.WeeklyChallengeOut)
def get_current_weekly_challenge(
    current_user: models.User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """
    Get the active weekly challenge.
    Auto-creates this week's challenge from rotating prompts if none exists yet.
    """
    challenge = _get_or_create_current_weekly_challenge(db)
    response_count = (
        db.query(func.count(models.WeeklyChallengeResponse.id))
        .filter(models.WeeklyChallengeResponse.challenge_id == challenge.id)
        .scalar()
    ) or 0

    has_responded = (
        db.query(models.WeeklyChallengeResponse.id)
        .filter(
            models.WeeklyChallengeResponse.challenge_id == challenge.id,
            models.WeeklyChallengeResponse.user_id == current_user.id,
        )
        .first()
        is not None
    )

    return schemas.WeeklyChallengeOut(
        id=challenge.id,
        prompt=challenge.prompt,
        week_start=challenge.week_start,
        created_at=challenge.created_at,
        response_count=response_count,
        has_responded=has_responded,
    )


@router.post("/weekly-challenge/current/respond", response_model=schemas.WeeklyChallengeResponseOut)
def respond_to_weekly_challenge(
    payload: schemas.WeeklyChallengeResponseCreate,
    current_user: models.User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """
    Submit a response to the active weekly challenge.
    Enforces exactly one response per teacher per week.
    """
    challenge = _get_or_create_current_weekly_challenge(db)

    existing = (
        db.query(models.WeeklyChallengeResponse)
        .filter(
            models.WeeklyChallengeResponse.challenge_id == challenge.id,
            models.WeeklyChallengeResponse.user_id == current_user.id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already submitted a response for this week's challenge.",
        )

    response_obj = models.WeeklyChallengeResponse(
        challenge_id=challenge.id,
        user_id=current_user.id,
        body=payload.body,
        created_at=utc_now(),
    )
    db.add(response_obj)
    db.commit()
    db.refresh(response_obj)

    return schemas.WeeklyChallengeResponseOut(
        id=response_obj.id,
        challenge_id=response_obj.challenge_id,
        user_id=response_obj.user_id,
        user_name=current_user.name,
        user_college=current_user.college or "",
        user_avatar_url=current_user.profile_picture_url,
        body=response_obj.body,
        created_at=response_obj.created_at,
    )


@router.get("/weekly-challenge/current/responses", response_model=List[schemas.WeeklyChallengeResponseOut])
def list_weekly_challenge_responses(
    limit: int = 20,
    offset: int = 0,
    current_user: models.User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """
    List responses to the active weekly challenge (paginated, newest first).
    """
    if hasattr(limit, "default"):
        limit = limit.default or 20
    if hasattr(offset, "default"):
        offset = offset.default or 0

    challenge = _get_or_create_current_weekly_challenge(db)
    responses = (
        db.query(models.WeeklyChallengeResponse)
        .filter(models.WeeklyChallengeResponse.challenge_id == challenge.id)
        .order_by(models.WeeklyChallengeResponse.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return [
        schemas.WeeklyChallengeResponseOut(
            id=r.id,
            challenge_id=r.challenge_id,
            user_id=r.user_id,
            user_name=r.user.name if r.user else "Teacher",
            user_college=(r.user.college or "") if r.user else "",
            user_avatar_url=r.user.profile_picture_url if r.user else None,
            body=r.body,
            created_at=r.created_at,
        )
        for r in responses
    ]


# ── Hackathons (Teacher-organized events) ─────────────────────────────────────

def _serialize_hackathon(
    hackathon: models.Hackathon,
    current_user_id: int,
    participant_count: Optional[int] = None,
    is_joined: Optional[bool] = None,
) -> schemas.HackathonOut:
    host = hackathon.host
    parts = hackathon.participants or []
    part_count = len(parts) if participant_count is None else participant_count
    joined = any(p.user_id == current_user_id for p in parts) if is_joined is None else is_joined

    return schemas.HackathonOut(
        id=hackathon.id,
        title=hackathon.title,
        description=hackathon.description,
        host_id=hackathon.host_id,
        host_name=host.name if host else "Teacher",
        host_college=(host.college or "") if host else "",
        host_avatar_url=host.profile_picture_url if host else None,
        starts_at=hackathon.starts_at,
        ends_at=hackathon.ends_at,
        status=hackathon.status,
        created_at=hackathon.created_at,
        participant_count=part_count,
        is_joined=joined,
        is_host=(hackathon.host_id == current_user_id),
    )


@router.post("/hackathons", response_model=schemas.HackathonOut)
def create_hackathon(
    payload: schemas.HackathonCreate,
    current_user: models.User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """
    Organize a new teacher hackathon.
    Gated by require_teacher.
    """
    if payload.ends_at <= payload.starts_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Hackathon end time must be after the start time.",
        )

    hackathon = models.Hackathon(
        title=payload.title,
        description=payload.description,
        host_id=current_user.id,
        starts_at=payload.starts_at,
        ends_at=payload.ends_at,
        status="upcoming",
        created_at=utc_now(),
    )
    db.add(hackathon)
    db.commit()
    db.refresh(hackathon)
    return _serialize_hackathon(hackathon, current_user.id, participant_count=0, is_joined=False)


@router.get("/hackathons", response_model=List[schemas.HackathonOut])
def list_hackathons(
    limit: int = 20,
    offset: int = 0,
    status_filter: Optional[str] = None,
    current_user: models.User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """
    List teacher hackathons (paginated, soonest first).
    """
    if hasattr(limit, "default"):
        limit = limit.default or 20
    if hasattr(offset, "default"):
        offset = offset.default or 0
    if hasattr(status_filter, "default"):
        status_filter = status_filter.default

    query = db.query(models.Hackathon)
    if isinstance(status_filter, str) and status_filter:
        query = query.filter(models.Hackathon.status == status_filter)

    hackathons = (
        query.order_by(models.Hackathon.starts_at.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    h_ids = [h.id for h in hackathons]

    counts_map = {}
    joined_set = set()
    if h_ids:
        counts = (
            db.query(
                models.HackathonParticipant.hackathon_id,
                func.count(models.HackathonParticipant.id),
            )
            .filter(models.HackathonParticipant.hackathon_id.in_(h_ids))
            .group_by(models.HackathonParticipant.hackathon_id)
            .all()
        )
        counts_map = {hid: cnt for hid, cnt in counts}

        my_joins = (
            db.query(models.HackathonParticipant.hackathon_id)
            .filter(
                models.HackathonParticipant.hackathon_id.in_(h_ids),
                models.HackathonParticipant.user_id == current_user.id,
            )
            .all()
        )
        joined_set = {j[0] for j in my_joins}

    return [
        _serialize_hackathon(
            h,
            current_user.id,
            participant_count=counts_map.get(h.id, 0),
            is_joined=(h.id in joined_set),
        )
        for h in hackathons
    ]


@router.post("/hackathons/{hackathon_id}/join", response_model=schemas.HackathonOut)
def join_hackathon(
    hackathon_id: int,
    current_user: models.User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """
    Join a hackathon. Enforces no duplicate joins and active/upcoming status.
    """
    hackathon = db.query(models.Hackathon).filter(models.Hackathon.id == hackathon_id).first()
    if not hackathon:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Hackathon not found.",
        )

    if hackathon.status in ("completed", "cancelled"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot join a completed or cancelled hackathon.",
        )

    existing = (
        db.query(models.HackathonParticipant)
        .filter(
            models.HackathonParticipant.hackathon_id == hackathon.id,
            models.HackathonParticipant.user_id == current_user.id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already joined this hackathon.",
        )

    participant = models.HackathonParticipant(
        hackathon_id=hackathon.id,
        user_id=current_user.id,
        joined_at=utc_now(),
    )
    db.add(participant)
    db.commit()
    db.refresh(hackathon)
    return _serialize_hackathon(hackathon, current_user.id, is_joined=True)


@router.post("/hackathons/{hackathon_id}/complete", response_model=schemas.HackathonOut)
def complete_hackathon(
    hackathon_id: int,
    current_user: models.User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """
    Mark a hackathon as completed. Host-only.
    Feeds the hackathon_host badge.
    """
    hackathon = db.query(models.Hackathon).filter(models.Hackathon.id == hackathon_id).first()
    if not hackathon:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Hackathon not found.",
        )

    if hackathon.host_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the host can mark this hackathon as completed.",
        )

    if hackathon.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot complete a cancelled hackathon.",
        )

    hackathon.status = "completed"
    db.commit()
    db.refresh(hackathon)
    return _serialize_hackathon(hackathon, current_user.id)

