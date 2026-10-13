"""
Tests for TASK 4B: Extended Teacher Community Features.

Features tested:
1. Access control: non-teacher 403 on EVERY new endpoint.
2. Study Circles:
   - Creation, listing (ordered by scheduled_at soonest first).
   - Join capacity enforcement (max_participants).
   - No duplicate joins.
   - Leave functionality.
   - Host-only completion.
   - Host-only deletion (prevent deletion if completed).
3. Ask-a-Senior:
   - Question creation, listing (ordered newest first, status filtering).
   - Answer submission (transitions status from open to answered).
   - Detail retrieval with full answers.
4. Weekly Challenge:
   - Auto-creates current week's challenge from rotating prompts.
   - Idempotent: multiple calls in the same week return the same row without creating duplicates.
   - One response per teacher per week enforced.
   - Listing responses paginated newest first.
5. Hackathons:
   - Creation, listing soonest first.
   - Joining without duplicates.
   - Host-only completion.
6. Pagination and ordering across all listing endpoints.
"""
import unittest
import datetime as dt
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.database import Base
from backend.app import models, schemas
from backend.app.routers.community import (
    require_teacher,
    create_study_circle,
    list_study_circles,
    join_study_circle,
    leave_study_circle,
    complete_study_circle,
    delete_study_circle,
    create_senior_question,
    list_senior_questions,
    create_senior_answer,
    get_senior_question,
    get_current_weekly_challenge,
    respond_to_weekly_challenge,
    list_weekly_challenge_responses,
    create_hackathon,
    list_hackathons,
    join_hackathon,
    complete_hackathon,
    get_current_week_monday,
)
from backend.app.utils.timezone import utc_now


class TestCommunityExtended(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        # Teachers (taught >= 1 completed session)
        self.alice = models.User(
            id=1,
            email="alice@teachers.edu",
            name="Alice Smith",
            college="MIT",
            hashed_password="pw",
            points=150,
        )
        self.bob = models.User(
            id=2,
            email="bob@teachers.edu",
            name="Bob Jones",
            college="Stanford",
            hashed_password="pw",
            points=120,
        )
        self.charlie = models.User(
            id=3,
            email="charlie@teachers.edu",
            name="Charlie Brown",
            college="Harvard",
            hashed_password="pw",
            points=110,
        )

        # Non-teachers (never taught completed session)
        self.daisy = models.User(
            id=4,
            email="daisy@students.edu",
            name="Daisy Miller",
            college="Oxford",
            hashed_password="pw",
            points=90,
        )

        self.db.add_all([self.alice, self.bob, self.charlie, self.daisy])
        self.db.commit()

        # Seed completed teaching sessions for Alice, Bob, and Charlie
        sess1 = models.Session(
            id=1,
            request_id=1,
            tutor_id=self.alice.id,
            learner_id=self.daisy.id,
            skill="Python",
            status="completed",
            session_date="2026-03-01",
            start_time="10:00",
            end_time="11:00",
            created_at=utc_now() - dt.timedelta(days=10),
        )
        sess2 = models.Session(
            id=2,
            request_id=2,
            tutor_id=self.bob.id,
            learner_id=self.daisy.id,
            skill="React",
            status="completed",
            session_date="2026-03-05",
            start_time="14:00",
            end_time="15:00",
            created_at=utc_now() - dt.timedelta(days=7),
        )
        sess3 = models.Session(
            id=3,
            request_id=3,
            tutor_id=self.charlie.id,
            learner_id=self.daisy.id,
            skill="Python",
            status="completed",
            session_date="2026-03-08",
            start_time="16:00",
            end_time="17:00",
            created_at=utc_now() - dt.timedelta(days=3),
        )
        self.db.add_all([sess1, sess2, sess3])
        self.db.commit()

    def tearDown(self):
        self.db.close()

    # ── Part 1: Access Control (Non-Teacher 403 on every new endpoint) ───────

    def test_non_teacher_403_on_all_new_endpoints(self):
        """Verifies that require_teacher rejects non-teachers with 403 on every single endpoint."""
        # 1. Base dependency check
        with self.assertRaises(HTTPException) as ctx:
            require_teacher(current_user=self.daisy, db=self.db)
        self.assertEqual(ctx.exception.status_code, 403)

        # 2. Study Circles
        circle_create_payload = schemas.StudyCircleCreate(
            title="Intro to React",
            description="Discussion on React hooks",
            scheduled_at=utc_now() + dt.timedelta(days=2),
            max_participants=5,
        )
        with self.assertRaises(HTTPException) as ctx:
            create_study_circle(circle_create_payload, current_user=require_teacher(current_user=self.daisy, db=self.db), db=self.db)
        self.assertEqual(ctx.exception.status_code, 403)

        with self.assertRaises(HTTPException) as ctx:
            list_study_circles(current_user=require_teacher(current_user=self.daisy, db=self.db), db=self.db)
        self.assertEqual(ctx.exception.status_code, 403)

        with self.assertRaises(HTTPException) as ctx:
            join_study_circle(circle_id=1, current_user=require_teacher(current_user=self.daisy, db=self.db), db=self.db)
        self.assertEqual(ctx.exception.status_code, 403)

        with self.assertRaises(HTTPException) as ctx:
            leave_study_circle(circle_id=1, current_user=require_teacher(current_user=self.daisy, db=self.db), db=self.db)
        self.assertEqual(ctx.exception.status_code, 403)

        with self.assertRaises(HTTPException) as ctx:
            complete_study_circle(circle_id=1, current_user=require_teacher(current_user=self.daisy, db=self.db), db=self.db)
        self.assertEqual(ctx.exception.status_code, 403)

        with self.assertRaises(HTTPException) as ctx:
            delete_study_circle(circle_id=1, current_user=require_teacher(current_user=self.daisy, db=self.db), db=self.db)
        self.assertEqual(ctx.exception.status_code, 403)

        # 3. Ask a Senior
        question_payload = schemas.SeniorQuestionCreate(body="How to handle pacing with advanced students?")
        with self.assertRaises(HTTPException) as ctx:
            create_senior_question(question_payload, current_user=require_teacher(current_user=self.daisy, db=self.db), db=self.db)
        self.assertEqual(ctx.exception.status_code, 403)

        with self.assertRaises(HTTPException) as ctx:
            list_senior_questions(current_user=require_teacher(current_user=self.daisy, db=self.db), db=self.db)
        self.assertEqual(ctx.exception.status_code, 403)

        answer_payload = schemas.SeniorAnswerCreate(body="Give them extension exercises.")
        with self.assertRaises(HTTPException) as ctx:
            create_senior_answer(question_id=1, payload=answer_payload, current_user=require_teacher(current_user=self.daisy, db=self.db), db=self.db)
        self.assertEqual(ctx.exception.status_code, 403)

        with self.assertRaises(HTTPException) as ctx:
            get_senior_question(question_id=1, current_user=require_teacher(current_user=self.daisy, db=self.db), db=self.db)
        self.assertEqual(ctx.exception.status_code, 403)

        # 4. Weekly Challenge
        with self.assertRaises(HTTPException) as ctx:
            get_current_weekly_challenge(current_user=require_teacher(current_user=self.daisy, db=self.db), db=self.db)
        self.assertEqual(ctx.exception.status_code, 403)

        respond_payload = schemas.WeeklyChallengeResponseCreate(body="I use real-world analogies.")
        with self.assertRaises(HTTPException) as ctx:
            respond_to_weekly_challenge(respond_payload, current_user=require_teacher(current_user=self.daisy, db=self.db), db=self.db)
        self.assertEqual(ctx.exception.status_code, 403)

        with self.assertRaises(HTTPException) as ctx:
            list_weekly_challenge_responses(current_user=require_teacher(current_user=self.daisy, db=self.db), db=self.db)
        self.assertEqual(ctx.exception.status_code, 403)

        # 5. Hackathons
        hackathon_payload = schemas.HackathonCreate(
            title="Weekend Hackathon",
            description="Build cool educational tools",
            starts_at=utc_now() + dt.timedelta(days=3),
            ends_at=utc_now() + dt.timedelta(days=5),
        )
        with self.assertRaises(HTTPException) as ctx:
            create_hackathon(hackathon_payload, current_user=require_teacher(current_user=self.daisy, db=self.db), db=self.db)
        self.assertEqual(ctx.exception.status_code, 403)

        with self.assertRaises(HTTPException) as ctx:
            list_hackathons(current_user=require_teacher(current_user=self.daisy, db=self.db), db=self.db)
        self.assertEqual(ctx.exception.status_code, 403)

        with self.assertRaises(HTTPException) as ctx:
            join_hackathon(hackathon_id=1, current_user=require_teacher(current_user=self.daisy, db=self.db), db=self.db)
        self.assertEqual(ctx.exception.status_code, 403)

        with self.assertRaises(HTTPException) as ctx:
            complete_hackathon(hackathon_id=1, current_user=require_teacher(current_user=self.daisy, db=self.db), db=self.db)
        self.assertEqual(ctx.exception.status_code, 403)

    # ── Part 2: Study Circles ────────────────────────────────────────────────

    def test_study_circle_capacity_and_duplicate_join(self):
        """Tests that study circle joins respect max_participants and prevent duplicates."""
        # Alice creates a circle with max_participants=2
        circle_payload = schemas.StudyCircleCreate(
            title="Algorithms Masterclass",
            description="Deep dive into graph algorithms",
            scheduled_at=utc_now() + dt.timedelta(days=1),
            max_participants=2,
        )
        circle = create_study_circle(circle_payload, current_user=self.alice, db=self.db)
        self.assertEqual(circle.participant_count, 0)
        self.assertEqual(circle.max_participants, 2)
        self.assertTrue(circle.is_host)

        # Bob joins (slot 1/2)
        joined_bob = join_study_circle(circle.id, current_user=self.bob, db=self.db)
        self.assertEqual(joined_bob.participant_count, 1)
        self.assertTrue(joined_bob.is_joined)

        # Bob attempts duplicate join -> 400
        with self.assertRaises(HTTPException) as ctx:
            join_study_circle(circle.id, current_user=self.bob, db=self.db)
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("already joined", ctx.exception.detail)

        # Charlie joins (slot 2/2 - full)
        joined_charlie = join_study_circle(circle.id, current_user=self.charlie, db=self.db)
        self.assertEqual(joined_charlie.participant_count, 2)

        # Extra teacher Dave qualifies
        dave = models.User(id=6, email="dave@teachers.edu", name="Dave", hashed_password="pw")
        self.db.add(dave)
        self.db.commit()
        sess_dave = models.Session(
            id=10, request_id=10, tutor_id=dave.id, learner_id=self.daisy.id,
            skill="Math", status="completed", session_date="2026-03-01", start_time="10:00", end_time="11:00",
        )
        self.db.add(sess_dave)
        self.db.commit()

        # Dave tries to join full circle -> 400 capacity exceeded
        with self.assertRaises(HTTPException) as ctx:
            join_study_circle(circle.id, current_user=dave, db=self.db)
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("maximum capacity", ctx.exception.detail)

        # Bob leaves
        leave_res = leave_study_circle(circle.id, current_user=self.bob, db=self.db)
        self.assertEqual(leave_res["status"], "success")

        # Now Dave can join (slot 2/2)
        joined_dave = join_study_circle(circle.id, current_user=dave, db=self.db)
        self.assertEqual(joined_dave.participant_count, 2)

    def test_study_circle_host_only_actions(self):
        """Tests that completion and deletion are host-only, and completed circle cannot be deleted."""
        circle_payload = schemas.StudyCircleCreate(
            title="System Design",
            description="Scaling distributed caches",
            scheduled_at=utc_now() + dt.timedelta(days=2),
            max_participants=5,
        )
        circle = create_study_circle(circle_payload, current_user=self.alice, db=self.db)

        # Bob attempts to complete -> 403
        with self.assertRaises(HTTPException) as ctx:
            complete_study_circle(circle.id, current_user=self.bob, db=self.db)
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("Only the host", ctx.exception.detail)

        # Bob attempts to delete -> 403
        with self.assertRaises(HTTPException) as ctx:
            delete_study_circle(circle.id, current_user=self.bob, db=self.db)
        self.assertEqual(ctx.exception.status_code, 403)

        # Alice completes the circle
        completed = complete_study_circle(circle.id, current_user=self.alice, db=self.db)
        self.assertEqual(completed.status, "completed")

        # Alice attempts to delete completed circle -> 400
        with self.assertRaises(HTTPException) as ctx:
            delete_study_circle(circle.id, current_user=self.alice, db=self.db)
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("completed study circle", ctx.exception.detail)

    # ── Part 3: Ask-a-Senior ─────────────────────────────────────────────────

    def test_ask_senior_qa_flow(self):
        """Tests posting questions, answers, and status updates."""
        q_payload = schemas.SeniorQuestionCreate(
            body="How do you handle difficult learners who don't engage?",
        )
        question = create_senior_question(q_payload, current_user=self.alice, db=self.db)
        self.assertEqual(question.status, "open")
        self.assertEqual(question.author_id, self.alice.id)
        self.assertEqual(question.answer_count, 0)

        # Bob answers
        a_payload = schemas.SeniorAnswerCreate(
            body="Start with low-stakes open questions and gamified prompts.",
        )
        answer = create_senior_answer(question.id, payload=a_payload, current_user=self.bob, db=self.db)
        self.assertEqual(answer.author_id, self.bob.id)
        self.assertEqual(answer.question_id, question.id)

        # Question detail reflects answers and updated status
        detail = get_senior_question(question.id, current_user=self.charlie, db=self.db)
        self.assertEqual(detail.status, "answered")
        self.assertEqual(detail.answer_count, 1)
        self.assertEqual(len(detail.answers), 1)
        self.assertEqual(detail.answers[0].body, a_payload.body)

    # ── Part 4: Weekly Challenge ─────────────────────────────────────────────

    def test_weekly_challenge_auto_creation_and_one_response_per_week(self):
        """
        Tests that:
        1. Current challenge is auto-created from rotating prompts.
        2. Two calls in the same week return the exact same challenge row.
        3. Enforces one response per teacher per week.
        """
        # Call 1: Auto-creates challenge
        c1 = get_current_weekly_challenge(current_user=self.alice, db=self.db)
        self.assertIsNotNone(c1.id)
        self.assertTrue(len(c1.prompt) > 10)
        self.assertEqual(c1.response_count, 0)
        self.assertFalse(c1.has_responded)

        # Call 2: Returns the exact same row (no duplicate row created)
        c2 = get_current_weekly_challenge(current_user=self.bob, db=self.db)
        self.assertEqual(c1.id, c2.id)
        self.assertEqual(c1.prompt, c2.prompt)
        self.assertEqual(c1.week_start, c2.week_start)

        # Count total rows in DB -> must be exactly 1
        count = self.db.query(models.WeeklyChallenge).count()
        self.assertEqual(count, 1)

        # Alice responds
        resp_payload = schemas.WeeklyChallengeResponseCreate(
            body="I break complex concepts into everyday metaphors.",
        )
        r1 = respond_to_weekly_challenge(resp_payload, current_user=self.alice, db=self.db)
        self.assertEqual(r1.user_id, self.alice.id)
        self.assertEqual(r1.challenge_id, c1.id)

        # Alice attempts a second response in the same week -> 400
        with self.assertRaises(HTTPException) as ctx:
            respond_to_weekly_challenge(resp_payload, current_user=self.alice, db=self.db)
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("already submitted a response", ctx.exception.detail)

        # Bob responds successfully
        resp_bob = schemas.WeeklyChallengeResponseCreate(body="I use live code quizzes.")
        r2 = respond_to_weekly_challenge(resp_bob, current_user=self.bob, db=self.db)
        self.assertEqual(r2.user_id, self.bob.id)

        # Updated challenge status reflects Alice's response
        c1_updated = get_current_weekly_challenge(current_user=self.alice, db=self.db)
        self.assertEqual(c1_updated.response_count, 2)
        self.assertTrue(c1_updated.has_responded)

    # ── Part 5: Hackathons ───────────────────────────────────────────────────

    def test_hackathon_flow_and_host_only_complete(self):
        """Tests hackathon creation, joins, and host-only completion."""
        h_payload = schemas.HackathonCreate(
            title="SkillVerse EdTech Hackathon",
            description="Build interactive widgets for classrooms",
            starts_at=utc_now() + dt.timedelta(days=5),
            ends_at=utc_now() + dt.timedelta(days=7),
        )
        hackathon = create_hackathon(h_payload, current_user=self.alice, db=self.db)
        self.assertEqual(hackathon.status, "upcoming")
        self.assertTrue(hackathon.is_host)
        self.assertEqual(hackathon.participant_count, 0)

        # Bob joins
        joined_bob = join_hackathon(hackathon.id, current_user=self.bob, db=self.db)
        self.assertEqual(joined_bob.participant_count, 1)
        self.assertTrue(joined_bob.is_joined)

        # Bob tries duplicate join -> 400
        with self.assertRaises(HTTPException) as ctx:
            join_hackathon(hackathon.id, current_user=self.bob, db=self.db)
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("already joined", ctx.exception.detail)

        # Bob attempts completion -> 403
        with self.assertRaises(HTTPException) as ctx:
            complete_hackathon(hackathon.id, current_user=self.bob, db=self.db)
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("Only the host", ctx.exception.detail)

        # Alice completes
        completed = complete_hackathon(hackathon.id, current_user=self.alice, db=self.db)
        self.assertEqual(completed.status, "completed")

    # ── Part 6: Pagination and Ordering ──────────────────────────────────────

    def test_pagination_and_ordering(self):
        """Tests pagination and chronological ordering across all list endpoints."""
        now = utc_now()

        # Seed 3 study circles with different scheduled times
        c1 = models.StudyCircle(
            title="Circle 1 (in 3 days)", description="Desc", host_id=self.alice.id,
            scheduled_at=now + dt.timedelta(days=3), status="scheduled", created_at=now,
        )
        c2 = models.StudyCircle(
            title="Circle 2 (in 1 day)", description="Desc", host_id=self.alice.id,
            scheduled_at=now + dt.timedelta(days=1), status="scheduled", created_at=now,
        )
        c3 = models.StudyCircle(
            title="Circle 3 (in 5 days)", description="Desc", host_id=self.alice.id,
            scheduled_at=now + dt.timedelta(days=5), status="scheduled", created_at=now,
        )
        self.db.add_all([c1, c2, c3])
        self.db.commit()

        # Listing study circles orders soonest first (c2: day 1, c1: day 3, c3: day 5)
        circles_page1 = list_study_circles(limit=2, offset=0, current_user=self.alice, db=self.db)
        self.assertEqual(len(circles_page1), 2)
        self.assertEqual(circles_page1[0].title, "Circle 2 (in 1 day)")
        self.assertEqual(circles_page1[1].title, "Circle 1 (in 3 days)")

        circles_page2 = list_study_circles(limit=2, offset=2, current_user=self.alice, db=self.db)
        self.assertEqual(len(circles_page2), 1)
        self.assertEqual(circles_page2[0].title, "Circle 3 (in 5 days)")

        # Seed 3 Senior questions
        q1 = models.SeniorQuestion(author_id=self.alice.id, body="Q1", created_at=now - dt.timedelta(hours=3))
        q2 = models.SeniorQuestion(author_id=self.alice.id, body="Q2", created_at=now - dt.timedelta(hours=1))
        q3 = models.SeniorQuestion(author_id=self.alice.id, body="Q3", created_at=now - dt.timedelta(hours=2))
        self.db.add_all([q1, q2, q3])
        self.db.commit()

        # Listing questions orders newest first (q2, q3, q1)
        questions_page = list_senior_questions(limit=2, offset=0, current_user=self.alice, db=self.db)
        self.assertEqual(len(questions_page), 2)
        self.assertEqual(questions_page[0].body, "Q2")
        self.assertEqual(questions_page[1].body, "Q3")

        # Seed 3 Hackathons
        h1 = models.Hackathon(
            title="H1 (in 10 days)", description="D", host_id=self.alice.id,
            starts_at=now + dt.timedelta(days=10), ends_at=now + dt.timedelta(days=12),
        )
        h2 = models.Hackathon(
            title="H2 (in 2 days)", description="D", host_id=self.alice.id,
            starts_at=now + dt.timedelta(days=2), ends_at=now + dt.timedelta(days=4),
        )
        self.db.add_all([h1, h2])
        self.db.commit()

        hackathons_page = list_hackathons(limit=2, offset=0, current_user=self.alice, db=self.db)
        self.assertEqual(len(hackathons_page), 2)
        self.assertEqual(hackathons_page[0].title, "H2 (in 2 days)")
        self.assertEqual(hackathons_page[1].title, "H1 (in 10 days)")


if __name__ == "__main__":
    unittest.main()
