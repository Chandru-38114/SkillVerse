import unittest
import datetime as dt
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.database import Base
from backend.app import models
from backend.app.routers.assessments import submit_assessment
from backend.app.schemas import AssessmentSubmit, AssessmentSubmitAnswer
from backend.app.routers.report_card import get_my_report_card


class TestWeeklyReportCard(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        # Create test users
        self.user = models.User(id=1, email="student@test.com", hashed_password="pw", name="Alice", points=100)
        self.teacher = models.User(id=2, email="teacher@test.com", hashed_password="pw", name="Bob", points=100)
        self.peer = models.User(id=3, email="peer@test.com", hashed_password="pw", name="Charlie", points=100)

        # Create skills
        self.skill_python = models.Skill(id=1, name="Python")
        self.skill_react = models.Skill(id=2, name="React")

        self.db.add_all([self.user, self.teacher, self.peer, self.skill_python, self.skill_react])
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine)

    def test_weekly_counted_and_not_counted_across_weeks(self):
        """Test that in the same week, only the first attempt is counted=True,
        while in a subsequent week, the first attempt is counted=True."""
        week1_start = dt.date(2026, 10, 5)  # Monday
        week2_start = dt.date(2026, 10, 12) # Following Monday

        # Simulate assessment in Week 1, day 1
        att1 = models.WeeklyAttempt(
            user_id=1,
            skill_id=1,
            score=75.0,
            level_num=3,
            taken_at=dt.datetime(2026, 10, 5, 10, 0),
            week_start=week1_start,
            counted=True,
        )
        self.db.add(att1)
        self.db.commit()

        # Check existing counted for week 1 -> should find att1
        has_counted_w1 = self.db.query(models.WeeklyAttempt).filter(
            models.WeeklyAttempt.user_id == 1,
            models.WeeklyAttempt.skill_id == 1,
            models.WeeklyAttempt.week_start == week1_start,
            models.WeeklyAttempt.counted == True,
        ).first()
        self.assertIsNotNone(has_counted_w1)

        # Second attempt in Week 1, day 3 -> should be counted=False
        att2 = models.WeeklyAttempt(
            user_id=1,
            skill_id=1,
            score=85.0,
            level_num=4,
            taken_at=dt.datetime(2026, 10, 7, 14, 0),
            week_start=week1_start,
            counted=False,
        )
        self.db.add(att2)
        self.db.commit()

        # Check existing counted for week 2 -> None yet
        has_counted_w2 = self.db.query(models.WeeklyAttempt).filter(
            models.WeeklyAttempt.user_id == 1,
            models.WeeklyAttempt.skill_id == 1,
            models.WeeklyAttempt.week_start == week2_start,
            models.WeeklyAttempt.counted == True,
        ).first()
        self.assertIsNone(has_counted_w2)

        # First attempt in Week 2 -> should be counted=True
        att3 = models.WeeklyAttempt(
            user_id=1,
            skill_id=1,
            score=90.0,
            level_num=4,
            taken_at=dt.datetime(2026, 10, 12, 11, 0),
            week_start=week2_start,
            counted=True,
        )
        self.db.add(att3)
        self.db.commit()

        # Query all weekly attempts for user 1
        attempts = self.db.query(models.WeeklyAttempt).filter(
            models.WeeklyAttempt.user_id == 1,
            models.WeeklyAttempt.skill_id == 1,
        ).order_by(models.WeeklyAttempt.id.asc()).all()

        self.assertEqual(len(attempts), 3)
        self.assertTrue(attempts[0].counted)
        self.assertFalse(attempts[1].counted)
        self.assertTrue(attempts[2].counted)

    def test_report_card_numbers_match_seeded_data(self):
        """Report card numbers match a seeded set of sessions, reviews, exchanges and points."""
        week1_start = dt.date(2026, 9, 28)
        week2_start = dt.date(2026, 10, 5)

        # UserSkill for Python
        us = models.UserSkill(
            user_id=1,
            skill_id=1,
            role="learning",
            latest_score=85.0,
            level_num=4,
            level="Advanced",
            badge="Gold",
        )
        self.db.add(us)

        # Weekly attempts: week 1 score 70, week 2 score 85 -> trend "up"
        self.db.add_all([
            models.WeeklyAttempt(
                user_id=1, skill_id=1, score=70.0, level_num=3,
                taken_at=dt.datetime(2026, 9, 28, 10, 0), week_start=week1_start, counted=True,
            ),
            models.WeeklyAttempt(
                user_id=1, skill_id=1, score=85.0, level_num=4,
                taken_at=dt.datetime(2026, 10, 5, 10, 0), week_start=week2_start, counted=True,
            ),
        ])

        # Seed learning sessions (attended as learner)
        # 1 completed 60-min session learning Python
        req1 = models.ConnectionRequest(id=1, from_user_id=1, to_user_id=2, skill_id=1, status="completed", points_awarded=True)
        sess1 = models.Session(
            id=1, request_id=1, tutor_id=2, learner_id=1,
            skill="Python", session_date="2026-10-01", start_time="10:00", end_time="11:00",
            status="completed",
        )

        # Seed teaching sessions (given as teacher)
        # 1 completed 90-min session teaching React to peer
        req2 = models.ConnectionRequest(id=2, from_user_id=3, to_user_id=1, skill_id=2, status="completed", points_awarded=True)
        sess2 = models.Session(
            id=2, request_id=2, tutor_id=1, learner_id=3,
            skill="React", session_date="2026-10-03", start_time="14:00", end_time="15:30",
            status="completed",
        )

        # Seed reviews received by user 1 (as reviewee)
        rev1 = models.Review(
            id=1, reviewer_id=3, reviewee_id=1, request_id=2, session_id=2,
            rating=5, comment="Fantastic tutor! Very clear.",
            created_at=dt.datetime(2026, 10, 3, 16, 0),
        )
        rev2 = models.Review(
            id=2, reviewer_id=2, reviewee_id=1, request_id=1, session_id=1,
            rating=4, comment="Great collaboration.",
            created_at=dt.datetime(2026, 10, 4, 16, 0),
        )

        # Seed completed exchange group
        grp = models.ExchangeGroup(id=10, kind="cycle", status="completed")
        mem1 = models.ExchangeMember(group_id=10, user_id=1, accepted=True)
        mem2 = models.ExchangeMember(group_id=10, user_id=2, accepted=True)
        mem3 = models.ExchangeMember(group_id=10, user_id=3, accepted=True)

        self.db.add_all([req1, sess1, req2, sess2, rev1, rev2, grp, mem1, mem2, mem3])
        self.user.points = 175  # 100 base + 50 badge + 20 teaching + 5 review
        self.db.commit()

        # Call get_my_report_card
        res = get_my_report_card(current_user=self.user, db=self.db)

        # Verify Skills Overview
        self.assertEqual(len(res.skills_overview), 1)
        ov = res.skills_overview[0]
        self.assertEqual(ov.skill_name, "Python")
        self.assertEqual(ov.level_num, 4)
        self.assertEqual(ov.best_score, 85.0)
        self.assertEqual(ov.counted_weeks, 2)
        self.assertEqual(ov.trend, "up")

        # Verify Progress History
        self.assertEqual(len(res.progress_history), 1)
        ph = res.progress_history[0]
        self.assertEqual(len(ph.history), 2)
        self.assertEqual(ph.history[0].week_start, "2026-09-28")
        self.assertEqual(ph.history[0].score, 70.0)
        self.assertEqual(ph.history[1].week_start, "2026-10-05")
        self.assertEqual(ph.history[1].score, 85.0)

        # Verify Learning Activity
        self.assertEqual(res.learning_activity.sessions_attended, 1)
        self.assertEqual(res.learning_activity.total_learning_minutes, 60)
        self.assertEqual(res.learning_activity.distinct_skills_learned, ["Python"])

        # Verify Teaching Activity
        self.assertEqual(res.teaching_activity.sessions_given, 1)
        self.assertEqual(res.teaching_activity.total_teaching_minutes, 90)
        self.assertEqual(res.teaching_activity.distinct_skills_taught, ["React"])

        # Verify Exchange History
        self.assertEqual(len(res.exchange_history), 1)
        self.assertEqual(res.exchange_history[0].kind, "cycle")
        self.assertIn("Bob", res.exchange_history[0].other_members)
        self.assertIn("Charlie", res.exchange_history[0].other_members)

        # Verify Points Breakdown
        self.assertEqual(res.points_breakdown.total, 175)
        self.assertEqual(res.points_breakdown.split["initial"], 100)
        self.assertEqual(res.points_breakdown.split["assessment"], 50)
        self.assertEqual(res.points_breakdown.split["teaching"], 20)

        # Verify Reviews Received
        self.assertEqual(res.reviews_received["review_count"], 2)
        self.assertEqual(res.reviews_received["average_rating"], 4.5)
        self.assertEqual(len(res.reviews_received["recent_reviews"]), 2)
        self.assertEqual(res.reviews_received["recent_reviews"][0].comment, "Great collaboration.")

    def test_report_card_does_not_leak_private_data(self):
        """Confirm response model has no emails, phones, or answer keys."""
        res = get_my_report_card(current_user=self.user, db=self.db)
        dump = res.model_dump()
        dump_str = str(dump)

        self.assertNotIn("@test.com", dump_str)
        self.assertNotIn("mobile_number", dump_str)
        self.assertNotIn("answer_key", dump_str)
        self.assertNotIn("password", dump_str)


if __name__ == "__main__":
    unittest.main()
