"""
Reviews router — POST /reviews/{request_id}  (submit a review)
             — GET  /reviews/user/{user_id}  (retrieve reviews for a user)

All validation is enforced server-side.  The client never supplies
reviewer_id or reviewee_id; they are derived from the JWT and the
connection request.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from ..notification_service import create_notification

from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(prefix="/reviews", tags=["reviews"])


def _to_out(r: models.Review) -> schemas.ReviewOut:
    return schemas.ReviewOut(
        id=r.id,
        reviewer_id=r.reviewer_id,
        reviewer_name=r.reviewer.name,
        reviewee_id=r.reviewee_id,
        request_id=r.request_id,
        rating=r.rating,
        comment=r.comment or "",
        created_at=r.created_at,
    )


@router.post("/{request_id}", response_model=schemas.ReviewOut)
def submit_review(
    request_id: int,
    payload: schemas.ReviewCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Submit a review for a completed session.

    Validation rules (all enforced server-side):
    1. Connection must exist and current user must be a participant.
    2. Connection status must be 'completed'.
    3. Rating must be between 1 and 5 inclusive.
    4. A user cannot review themselves.
    5. A user cannot submit a second review for the same connection.
    """
    # ── 1. Fetch and authorise ────────────────────────────────────────────────
    req = db.query(models.ConnectionRequest).filter(
        models.ConnectionRequest.id == request_id
    ).first()

    if not req or current_user.id not in (req.from_user_id, req.to_user_id):
        raise HTTPException(status_code=404, detail="Connection not found")

    # ── 2. Must be completed ──────────────────────────────────────────────────
    if req.status != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Reviews can only be submitted for completed sessions (current status: {req.status}).",
        )

    # ── 3. Rating range ───────────────────────────────────────────────────────
    if payload.rating < 1 or payload.rating > 5:
        raise HTTPException(
            status_code=422,
            detail="Rating must be between 1 and 5.",
        )

    # ── 4. No self-review (sanity guard, not normally reachable) ──────────────
    reviewee_id = (
        req.to_user_id if current_user.id == req.from_user_id else req.from_user_id
    )
    if reviewee_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot review yourself.")

    # ── 5. No duplicate reviews ───────────────────────────────────────────────
    already = db.query(models.Review).filter(
        models.Review.request_id == request_id,
        models.Review.reviewer_id == current_user.id,
    ).first()
    if already:
        raise HTTPException(
            status_code=409,
            detail="You have already submitted a review for this session.",
        )

    # ── Persist ───────────────────────────────────────────────────────────────
    review = models.Review(
        reviewer_id=current_user.id,
        reviewee_id=reviewee_id,
        request_id=request_id,
        rating=payload.rating,
        comment=payload.comment or "",
    )
    db.add(review)
    db.commit()
    db.refresh(review)

    # Award +5 points to the reviewer.
    # Only reachable after all validation has passed and the review row
    # has been persisted, so invalid or duplicate reviews never earn points.
    current_user.points += 5
    db.commit()
    create_notification(db, reviewee_id, "review", "New Review", f"{current_user.name} left you a {payload.rating}-star review", review.id, "review")

    return _to_out(review)


@router.get("/user/{user_id}", response_model=schemas.UserReviewSummary)
def get_user_reviews(
    user_id: int,
    db: Session = Depends(get_db),
):
    """
    Retrieve all reviews written ABOUT a user (as reviewee), plus their
    average rating and review count.  No authentication required — this
    data is intentionally public so the marketplace can display it.
    """
    rows = (
        db.query(models.Review)
        .filter(models.Review.reviewee_id == user_id)
        .order_by(models.Review.created_at.desc())
        .all()
    )

    review_count = len(rows)
    average_rating = (
        round(sum(r.rating for r in rows) / review_count, 1)
        if review_count > 0 else None
    )

    return schemas.UserReviewSummary(
        average_rating=average_rating,
        review_count=review_count,
        reviews=[_to_out(r) for r in rows],
    )


@router.get("/my/{request_id}", response_model=schemas.ReviewOut)
def get_my_review_for_request(
    request_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Check whether the current user has already reviewed a specific connection.
    Returns the review if it exists, or 404 if not yet submitted.
    Used by the frontend to decide whether to show 'Leave Review' or 'Review submitted'.
    """
    review = db.query(models.Review).filter(
        models.Review.request_id == request_id,
        models.Review.reviewer_id == current_user.id,
    ).first()

    if not review:
        raise HTTPException(status_code=404, detail="No review found")

    return _to_out(review)
