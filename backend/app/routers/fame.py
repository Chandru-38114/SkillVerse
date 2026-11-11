"""
Fame page — the best teachers and most knowledgeable members (services/fame.py).

- GET /fame                          Top Teachers, Most Knowledgeable, Rising Stars + the formula
- GET /fame/teacher/{user_id}/insight AI summary of a teacher's reviews (cached; ?refresh=1 asks the AI)
- GET /fame/me/weekly                my weekly assessment streak and badges
"""
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import auth, models
from ..database import SessionLocal, get_db
from ..services import fame as F

router = APIRouter(prefix="/fame", tags=["fame"])

AI_PREFETCH = 5   # after a page view, prepare AI summaries for the top 5 teachers in the background


def _prefetch_ai(user_ids):
    db = SessionLocal()
    try:
        for uid in user_ids:
            F.get_insight(db, uid, use_ai=True)
    except Exception:   # noqa: BLE001 — a background helper must never crash the worker
        db.rollback()
    finally:
        db.close()


@router.get("")
def fame_board(
    background: BackgroundTasks,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    board = F.build_fame(db)
    missing = [c["user_id"] for c in board["top_teachers"][:AI_PREFETCH]
               if c["insight"] and c["insight"].get("source") != "ai"]
    if missing:
        background.add_task(_prefetch_ai, missing)
    me = F.weekly_status(F.weekly_history(db, [current_user.id]).get(current_user.id, {}))
    return {**board, "me": {"user_id": current_user.id, "weekly": me}}


@router.get("/teacher/{user_id}/insight")
def teacher_insight(
    user_id: int,
    refresh: bool = False,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    if not db.query(models.User.id).filter(models.User.id == user_id).first():
        raise HTTPException(status_code=404, detail="User not found")
    insight = F.get_insight(db, user_id, use_ai=refresh)
    return {"user_id": user_id, "insight": insight}


@router.get("/me/weekly")
def my_weekly(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    return F.weekly_status(F.weekly_history(db, [current_user.id]).get(current_user.id, {}))
