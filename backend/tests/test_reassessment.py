"""Features 0 and 1: topic scores are saved, and the post-session reassessment
gently updates the learner's course score/level (never the badge)."""
import asyncio
import datetime as dt
import unittest
import uuid
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.database import Base
from backend.app import models, schemas
from backend.app.routers.assessments import submit_assessment
from backend.app.routers.progress import SessionQuizAnswer, SessionQuizSubmit, start_session_quiz, submit_session_quiz
from backend.app.services.topic_scores import latest_topic_scores
from backend.app.services.question_generator import GenerationError


class ReassessmentTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()
        self.tutor = models.User(id=1, name="Tara", email="t@x.com", hashed_password="pw")
        self.learner = models.User(id=2, name="Lalu", email="l@x.com", hashed_password="pw")
        self.python = models.Skill(id=1, name="Python")
        self.db.add_all([self.tutor, self.learner, self.python])
        self.db.add(models.UserSkill(user_id=2, skill_id=1, role="learning", level="Intermediate",
                                     level_num=2, latest_score=50.0, badge="Bronze", sessions_completed=1))
        req = models.ConnectionRequest(id=1, from_user_id=2, to_user_id=1, skill_id=1, status="accepted")
        now = dt.datetime.now(dt.timezone.utc)
        sess = models.Session(id=1, request_id=1, tutor_id=1, learner_id=2, skill="Python", status="completed",
                              session_date="x", start_time="10:00", end_time="11:00",
                              scheduled_start=now - dt.timedelta(hours=2), scheduled_end=now - dt.timedelta(hours=1),
                              started_at=now - dt.timedelta(hours=2), both_joined_at=now - dt.timedelta(hours=2))
        prog = models.SessionProgress(session_id=1, user_id=2, skill_id=1, duration_minutes=60,
                                      topics_discussed="Functions, OOP", level_before="Intermediate")
        self.db.add_all([req, sess, prog])
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def _start(self, user):
        # No AI here: the summary and the AI quiz both fail -> question bank.
        with patch("backend.app.routers.progress.generate_session_summary", lambda *a: None), \
             patch("backend.app.routers.progress.generate_session_quiz", side_effect=GenerationError("offline")):
            return asyncio.run(start_session_quiz(session_id=1, db=self.db, current_user=user))

    def _submit(self, start, right):
        att = self.db.get(models.AssessmentSession, start["attempt_id"])
        answers = [SessionQuizAnswer(question_id=q["id"], answer=q["answer"] if i < right else "nope")
                   for i, q in enumerate(att.questions)]
        with patch("backend.app.routers.progress.build_next_session_plan", lambda *a, **k: ["Revise"]):
            return submit_session_quiz(session_id=1, payload=SessionQuizSubmit(attempt_id=start["attempt_id"], answers=answers),
                                       db=self.db, current_user=self.learner)

    def test_bank_fallback_when_ai_is_busy(self):
        start = self._start(self.learner)
        self.assertEqual(start["source"], "session-bank")
        self.assertGreaterEqual(len(start["questions"]), 4)
        self.assertTrue(all("answer" not in q for q in start["questions"]))  # answer keys stay on the server

    def test_full_marks_moves_score_30_percent_of_the_way(self):
        start = self._start(self.learner)
        out = self._submit(start, right=len(start["questions"]))
        self.assertEqual(out["score"], 100.0)
        row = self.db.query(models.UserSkill).filter_by(user_id=2, skill_id=1).one()
        self.assertEqual(row.latest_score, 65.0)          # 0.7*50 + 0.3*100
        self.assertEqual(row.level, "Intermediate")
        self.assertEqual(row.badge, "Bronze")              # badge unchanged
        self.assertEqual(out["skill_change"]["score_before"], 50.0)
        self.assertTrue(latest_topic_scores(self.db, 2, 1))  # topic history saved

    def test_no_arena_score_means_no_level_change(self):
        row = self.db.query(models.UserSkill).filter_by(user_id=2, skill_id=1).one()
        row.latest_score, row.level = None, "Unassessed"
        self.db.commit()
        out = self._submit(self._start(self.learner), right=0)
        self.assertFalse(out["skill_change"]["updated"])
        self.assertEqual(row.level, "Unassessed")

    def test_second_submit_is_refused(self):
        start = self._start(self.learner)
        self._submit(start, right=1)
        with self.assertRaises(HTTPException) as ctx:
            self._submit(start, right=1)
        self.assertEqual(ctx.exception.status_code, 409)

    def test_tutor_cannot_take_it(self):
        with self.assertRaises(HTTPException) as ctx:
            self._start(self.tutor)
        self.assertEqual(ctx.exception.status_code, 403)

    def test_arena_records_topic_scores(self):
        qs = [{"id": f"q{i}", "topic": "Loops" if i < 5 else "OOP", "type": "mcq", "question": "?",
               "options": ["A", "B"], "answer": "A"} for i in range(10)]
        att = models.AssessmentSession(id=str(uuid.uuid4()), user_id=2, skill_name="Python", source="bank", questions=qs,
                                       expires_at=dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=30))
        self.db.add(att)
        self.db.commit()
        answers = [schemas.AssessmentSubmitAnswer(question_id=f"q{i}", answer="A" if i < 5 else "B") for i in range(10)]
        with patch("backend.app.routers.assessments.build_study_plan", lambda *a, **k: []):
            submit_assessment(payload=schemas.AssessmentSubmit(skill_name="Python", role="learning", answers=answers, attempt_id=att.id),
                              current_user=self.learner, db=self.db)
        self.assertEqual(latest_topic_scores(self.db, 2, 1), {"Loops": 100.0, "OOP": 0.0})


if __name__ == "__main__":
    unittest.main()
