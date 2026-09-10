import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..notification_service import create_notification

from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(prefix="/certificates", tags=["certificates"])

def generate_cert_id():
    return f"SKV-{uuid.uuid4().hex[:8].upper()}"

@router.post("/generate", response_model=schemas.CertificateOut)
def generate_certificate(
    payload: schemas.CertificateGenerateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    skill = db.query(models.Skill).filter(models.Skill.name.ilike(payload.skill_name)).first()
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")

    us = db.query(models.UserSkill).filter(
        models.UserSkill.user_id == current_user.id,
        models.UserSkill.skill_id == skill.id
    ).first()

    if not us:
        raise HTTPException(status_code=400, detail="You do not have this skill registered.")

    if not us.badge or us.level == "Unassessed":
        raise HTTPException(status_code=400, detail="You must complete a skill assessment to earn a badge first.")

    if us.progress_percentage < 100:
        raise HTTPException(status_code=400, detail="You must reach 100% learning progress to earn this certificate.")

    # Prevent duplicate generation for the same skill and same badge
    existing_cert = db.query(models.Certificate).filter(
        models.Certificate.user_id == current_user.id,
        models.Certificate.skill_id == skill.id,
        models.Certificate.badge == us.badge
    ).first()

    if existing_cert:
        raise HTTPException(status_code=400, detail="You have already generated a certificate for this achievement.")

    cert = models.Certificate(
        certificate_id=generate_cert_id(),
        user_id=current_user.id,
        skill_id=skill.id,
        level=us.level,
        badge=us.badge,
        sessions_completed=us.sessions_completed,
        progress_percentage=us.progress_percentage
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
