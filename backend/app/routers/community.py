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
