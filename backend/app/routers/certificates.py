import os
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..notification_service import create_notification

from .. import models, schemas, auth
from ..database import get_db
from ..services.course_rules import (
    FINAL_PASS_SCORE, SESSIONS_FOR_FINAL, find_course, is_course_finished, user_course,
)

router = APIRouter(prefix="/certificates", tags=["certificates"])

def generate_cert_id():
    return f"SKV-{uuid.uuid4().hex[:8].upper()}"

@router.post("/generate", response_model=schemas.CertificateOut)
def generate_certificate(
    payload: schemas.CertificateGenerateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    skill = find_course(db, " ".join((payload.skill_name or "").split()))
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")

    us = user_course(db, current_user.id, skill.id)

    if not us:
        raise HTTPException(status_code=400, detail="You do not have this skill registered.")

    # A certificate means the course is finished: the learner completed the
    # required sessions AND then passed the final Skill Arena challenge
    # (progress 100%). A badge alone is not enough any more.
    if us.role != "learning":
        raise HTTPException(status_code=400, detail="Certificates are for learners who complete a course. You teach this course.")
    if not is_course_finished(us):
        done = us.sessions_completed or 0
        if done < SESSIONS_FOR_FINAL:
            msg = f"Complete {SESSIONS_FOR_FINAL - done} more session(s), then pass the final challenge to earn this certificate."
        else:
            msg = f"Pass the final Skill Arena challenge with {FINAL_PASS_SCORE}% or more to earn this certificate."
        raise HTTPException(status_code=400, detail=msg)

    # One certificate per finished course.
    existing_cert = db.query(models.Certificate).filter(
        models.Certificate.user_id == current_user.id,
        models.Certificate.skill_id == skill.id,
    ).first()

    if existing_cert:
        raise HTTPException(status_code=400, detail="You have already generated a certificate for this course.")

    cert = models.Certificate(
        certificate_id=generate_cert_id(),
        user_id=current_user.id,
        skill_id=skill.id,
        level=us.level,
        # The badge column is required; a finished course without a badge
        # (possible if the final score was 60 but the badge rules change)
        # still gets a certificate.
        badge=us.badge or "Completed",
        sessions_completed=us.sessions_completed,
        progress_percentage=100
    )

    db.add(cert)
    db.commit()
    db.refresh(cert)
    create_notification(db, current_user.id, "certificate", "Certificate Earned", f"You earned a new certificate for {skill.name}", cert.id, "certificate")

    return schemas.CertificateOut(
        id=cert.id,
        certificate_id=cert.certificate_id,
        user_id=cert.user_id,
        user_name=current_user.name,
        skill_id=cert.skill_id,
        skill_name=skill.name,
        issue_date=cert.issue_date,
        level=cert.level,
        badge=cert.badge,
        sessions_completed=cert.sessions_completed,
        progress_percentage=cert.progress_percentage
    )

@router.get("/my", response_model=List[schemas.CertificateOut])
def get_my_certificates(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    certs = db.query(models.Certificate).filter(models.Certificate.user_id == current_user.id).order_by(models.Certificate.issue_date.desc()).all()
    result = []
    for cert in certs:
        result.append(schemas.CertificateOut(
            id=cert.id,
            certificate_id=cert.certificate_id,
            user_id=cert.user_id,
            user_name=cert.user.name,
            skill_id=cert.skill_id,
            skill_name=cert.skill.name,
            issue_date=cert.issue_date,
            level=cert.level,
            badge=cert.badge,
            sessions_completed=cert.sessions_completed,
            progress_percentage=cert.progress_percentage
        ))
    return result

@router.get("/verify/{certificate_id}", response_model=schemas.CertificateOut)
def verify_certificate(
    certificate_id: str,
    db: Session = Depends(get_db)
):
    cert = db.query(models.Certificate).filter(models.Certificate.certificate_id == certificate_id).first()
    if not cert:
        raise HTTPException(status_code=404, detail="Invalid certificate ID")

    return schemas.CertificateOut(
        id=cert.id,
        certificate_id=cert.certificate_id,
        user_id=cert.user_id,
        user_name=cert.user.name,
        skill_id=cert.skill_id,
        skill_name=cert.skill.name,
        issue_date=cert.issue_date,
        level=cert.level,
        badge=cert.badge,
        sessions_completed=cert.sessions_completed,
        progress_percentage=cert.progress_percentage
    )

