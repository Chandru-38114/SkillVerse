"""Round 3: one role per course, max 4 courses, the new progress/certificate
rule, and sessions that only count when tutor and learner both joined."""
import datetime as dt
import unittest
import uuid
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.database import Base
from backend.app import models, schemas
from backend.app.routers.requests import create_request
from backend.app.routers.assessments import submit_assessment
from backend.app.routers.certificates import generate_certificate
from backend.app.routers.progress import complete_session
from backend.app.routers.users import add_skill, remove_skill, SkillAddRequest
from backend.app.services.course_rules import clean_course_name, teaching_problem
from backend.app.utils.progress_utils import compute_progress_percentage


class CourseRulesTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()
        self.tutor = models.User(id=1, name="Tara Tutor", email="t@x.com", hashed_password="pw", points=100)
        self.learner = models.User(id=2, name="Lalu Learner", email="l@x.com", hashed_password="pw", points=100)
        self.python = models.Skill(id=1, name="Python")
        self.java = models.Skill(id=2, name="Java")
        self.db.add_all([self.tutor, self.learner, self.python, self.java])
        self.db.add(models.UserSkill(user_id=1, skill_id=1, role="teaching", level_num=4, level="Advanced", latest_score=85))
        self.db.commit()

    def tearDown(self):
        self.db.close()

    # ── helpers ──────────────────────────────────────────────────────────────
    def _request(self, sender, to_user_id, skill="Python", **extra):
        payload = schemas.ConnectionRequestCreate(to_user_id=to_user_id, skill_name=skill, **extra)
        return create_request(payload=payload, current_user=sender, db=self.db)

    def _arena(self, user, skill, role, correct, total=10):
        """Submit an arena attempt with `correct` right answers out of `total`."""
        questions = [{"id": f"q{i}", "topic": "Basics", "type": "mcq", "question": "?",
                      "options": ["A", "B", "C", "D"], "answer": "A"} for i in range(total)]
        sess = models.AssessmentSession(id=str(uuid.uuid4()), user_id=user.id, skill_name=skill, source="bank",
                                        questions=questions,
                                        expires_at=dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=30))
        self.db.add(sess)
        self.db.commit()
        answers = [schemas.AssessmentSubmitAnswer(question_id=f"q{i}", answer="A" if i < correct else "B") for i in range(total)]
        payload = schemas.AssessmentSubmit(skill_name=skill, role=role, answers=answers, attempt_id=sess.id)
        with patch("backend.app.routers.assessments.build_study_plan", lambda *a, **k: []):
            return submit_assessment(payload=payload, current_user=user, db=self.db)

    def _row(self, user_id, skill_id):
        return self.db.query(models.UserSkill).filter_by(user_id=user_id, skill_id=skill_id).one()

    # ── requests ─────────────────────────────────────────────────────────────
    def test_learner_can_request_a_teacher(self):
        out = self._request(self.learner, 1)
        self.assertEqual(out.status, "pending")
        self.assertEqual(self._row(2, 1).role, "learning")  # course added for the learner

    def test_teacher_cannot_request_own_course_as_learner(self):
        other = models.User(id=3, name="Other", email="o@x.com", hashed_password="pw")
        self.db.add_all([other, models.UserSkill(user_id=3, skill_id=1, role="teaching", level_num=4)])
        self.db.commit()
        with self.assertRaises(HTTPException) as ctx:
            self._request(self.tutor, 3)
        self.assertEqual(ctx.exception.status_code, 403)

    def test_cannot_request_someone_who_does_not_teach(self):
        with self.assertRaises(HTTPException) as ctx:
            self._request(self.tutor, 2)  # learner doesn't teach Python
        self.assertEqual(ctx.exception.status_code, 403)

    def test_cannot_request_yourself(self):
        with self.assertRaises(HTTPException) as ctx:
            self._request(self.tutor, 1)
        self.assertEqual(ctx.exception.status_code, 400)

    def test_offer_to_teach_must_be_a_taught_course(self):
        with self.assertRaises(HTTPException) as ctx:
            self._request(self.learner, 1, learner_can_teach="Java")
        self.assertEqual(ctx.exception.status_code, 400)

    def test_teaching_problem_level_gap(self):
        self.db.add(models.UserSkill(user_id=2, skill_id=1, role="learning", level_num=3))
        self.db.commit()
        self.assertIsNotNone(teaching_problem(self.db, 1, 2, 1))  # 4 vs 3: gap too small

    # ── course limit and names ───────────────────────────────────────────────
    def test_max_four_courses(self):
        for name in ["Go", "Rust", "C++", "SQL"]:
            add_skill(req=SkillAddRequest(skill_name=name), current_user=self.learner, db=self.db)
        with self.assertRaises(HTTPException) as ctx:
            add_skill(req=SkillAddRequest(skill_name="Kotlin"), current_user=self.learner, db=self.db)
        self.assertEqual(ctx.exception.status_code, 409)

    def test_teacher_cannot_add_course_as_learning(self):
        with self.assertRaises(HTTPException):
            add_skill(req=SkillAddRequest(skill_name="python"), current_user=self.tutor, db=self.db)

    def test_remove_course_frees_a_slot_unless_in_use(self):
        out = self._request(self.learner, 1)  # pending Python request: both can't remove it
        for user, uid in ((self.learner, 2), (self.tutor, 1)):
            with self.assertRaises(HTTPException) as ctx:
                remove_skill(skill_id=self._row(uid, 1).id, current_user=user, db=self.db)
            self.assertEqual(ctx.exception.status_code, 409)
        self.db.query(models.ConnectionRequest).filter_by(id=out.id).update({"status": "declined"})
        self.db.commit()
        res = remove_skill(skill_id=self._row(1, 1).id, current_user=self.tutor, db=self.db)  # a taught course
        self.assertEqual(res["courses_left"], 0)
        remove_skill(skill_id=self._row(2, 1).id, current_user=self.learner, db=self.db)
        self.assertEqual(self.db.query(models.UserSkill).count(), 0)

    def test_course_names(self):
        self.assertEqual(clean_course_name("  dsa "), "Data Structures and Algorithms")
        self.assertEqual(clean_course_name("Machine   Learning"), "Machine Learning")
        for bad in ["", "<script>", "x" * 60]:
            with self.assertRaises(HTTPException):
                clean_course_name(bad)

    # ── arena decides the role ───────────────────────────────────────────────
    def test_low_teach_score_stays_learner(self):
        res = self._arena(self.learner, "Java", "teaching", correct=5)  # 50%
        self.assertEqual(res.role, "learning")
        self.assertEqual(self._row(2, 2).role, "learning")

    def test_learner_grows_into_teacher(self):
        self._arena(self.learner, "Java", "learning", correct=3)
        res = self._arena(self.learner, "Java", "teaching", correct=7)  # 70%
        self.assertEqual(res.role, "teaching")
        self.assertEqual(self._row(2, 2).role, "teaching")

    def test_teacher_stays_teacher_with_learning_goal(self):
        res = self._arena(self.tutor, "Python", "learning", correct=9)
        self.assertEqual(res.role, "teaching")

    def test_badge_points_only_once_per_course(self):
        self._arena(self.learner, "Java", "learning", correct=5)
        self._arena(self.learner, "Java", "learning", correct=6)
        self.db.refresh(self.learner)
        self.assertEqual(self.learner.points, 150)

    # ── progress and certificate ─────────────────────────────────────────────
    def test_progress_formula(self):
        self.assertEqual(compute_progress_percentage(0, "Gold"), 0)  # badge alone is not 100%
        self.assertEqual(compute_progress_percentage(3), 48)
        self.assertEqual(compute_progress_percentage(5), 80)
        self.assertEqual(compute_progress_percentage(9), 80)
        self.assertEqual(compute_progress_percentage(5, course_completed=True), 100)

    def test_certificate_needs_sessions_and_final_challenge(self):
        self._arena(self.learner, "Java", "learning", correct=9)  # Expert badge, 0 sessions
        req = schemas.CertificateGenerateRequest(skill_name="Java")
        with self.assertRaises(HTTPException):
            generate_certificate(payload=req, db=self.db, current_user=self.learner)

        row = self._row(2, 2)
        row.sessions_completed = 5
        self.db.commit()
        with self.assertRaises(HTTPException):  # sessions done, final not passed yet
            generate_certificate(payload=req, db=self.db, current_user=self.learner)

        res = self._arena(self.learner, "Java", "learning", correct=4)  # 40%: fails the final
        self.assertFalse(res.course_completed)
        res = self._arena(self.learner, "Java", "learning", correct=7)  # 70%: passes
        self.assertTrue(res.course_completed)
        cert = generate_certificate(payload=req, db=self.db, current_user=self.learner)
        self.assertEqual(cert.progress_percentage, 100)
        with self.assertRaises(HTTPException):  # only one per course
            generate_certificate(payload=req, db=self.db, current_user=self.learner)

    # ── sessions ─────────────────────────────────────────────────────────────
    def _session(self, both_joined):
        req = models.ConnectionRequest(id=50, from_user_id=2, to_user_id=1, skill_id=1, status="accepted")
        now = dt.datetime.now(dt.timezone.utc)
        s = models.Session(id=50, request_id=50, tutor_id=1, learner_id=2, skill="Python",
                           session_date="2026-10-14", start_time="10:00", end_time="11:00",
                           scheduled_start=now - dt.timedelta(minutes=30), scheduled_end=now + dt.timedelta(minutes=30),
                           status="scheduled", started_at=now - dt.timedelta(minutes=29),
                           both_joined_at=(now - dt.timedelta(minutes=28)) if both_joined else None)
        self.db.add_all([req, models.UserSkill(user_id=2, skill_id=1, role="learning", level_num=0), s])
        self.db.commit()
        return s

    def test_session_alone_cannot_be_completed(self):
        self._session(both_joined=False)
        with self.assertRaises(HTTPException):
            complete_session(session_id=50, db=self.db, current_user=self.learner)

    def test_completed_session_adds_16_percent(self):
        self._session(both_joined=True)
        with patch("backend.app.routers.progress._try_generate_summary", lambda *a, **k: None):
            complete_session(session_id=50, db=self.db, current_user=self.learner)
            complete_session(session_id=50, db=self.db, current_user=self.tutor)
        self.assertEqual(self._row(2, 1).progress_percentage, 16)
        self.assertEqual(self._row(1, 1).sessions_completed, 1)  # counted as taught for the tutor
        self.assertEqual(self._row(1, 1).role, "teaching")       # a taught session never adds learner progress


if __name__ == "__main__":
    unittest.main()
