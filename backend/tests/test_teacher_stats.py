import unittest
import datetime as dt
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.database import Base
from backend.app import models
from backend.app.routers.teacher_stats import get_my_teacher_stats


class TestTeacherStats(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        # Users
        self.teacher = models.User(id=1, email="tutor@test.com", hashed_password="pw", name="Dr. Smith", points=100)
        self.learner1 = models.User(id=2, email="learner1@test.com", hashed_password="pw", name="Alice", points=100)
        self.learner2 = models.User(id=3, email="learner2@test.com", hashed_password="pw", name="Bob", points=100)
        self.non_teacher = models.User(id=4, email="nonteacher@test.com", hashed_password="pw", name="Daisy", points=100)

        # Skills
        self.skill_python = models.Skill(id=1, name="Python")
        self.skill_fastapi = models.Skill(id=2, name="FastAPI")

        self.db.add_all([
            self.teacher, self.learner1, self.learner2, self.non_teacher,
            self.skill_python, self.skill_fastapi
        ])
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine)

    def test_user_who_never_taught_gets_has_taught_false(self):
        """A user who never taught gets has_taught: false and no stats fields."""
        res = get_my_teacher_stats(current_user=self.non_teacher, db=self.db)
        self.assertFalse(res.has_taught)
        self.assertIsNone(res.teaching_experience)
        self.assertIsNone(res.rating_summary)
        self.assertIsNone(res.session_stats)
        self.assertIsNone(res.students_help)
        self.assertIsNone(res.skill_breakdown)
        self.assertIsNone(res.reliability)
        self.assertIsNone(res.recent_reviews)

    def test_teacher_stats_seeded_data_calculations(self):
        """A user who has taught gets correct hours, ratings and reliability numbers."""
        # Teacher's skill levels
        us1 = models.UserSkill(user_id=1, skill_id=1, role="teaching", level_num=4)
        us2 = models.UserSkill(user_id=1, skill_id=2, role="teaching", level_num=3)
        self.db.add_all([us1, us2])

        # 3 accepted connection requests for this teacher:
        # req1: Python from learner1 -> completed session
        # req2: Python from learner1 -> completed second session (returning learner!)
        # req3: FastAPI from learner2 -> completed session
        # req4: Python from learner2 -> accepted, but never scheduled/cancelled (to test reliability)
        req1 = models.ConnectionRequest(id=1, from_user_id=2, to_user_id=1, skill_id=1, status="completed", points_awarded=True)
        req2 = models.ConnectionRequest(id=2, from_user_id=2, to_user_id=1, skill_id=1, status="completed", points_awarded=True)
        req3 = models.ConnectionRequest(id=3, from_user_id=3, to_user_id=1, skill_id=2, status="completed", points_awarded=True)
        req4 = models.ConnectionRequest(id=4, from_user_id=3, to_user_id=1, skill_id=1, status="accepted")

        # Sessions for req1 (60 min), req2 (60 min), req3 (120 min) -> total 240 min = 4.0 hours
        sess1 = models.Session(
            id=1, request_id=1, tutor_id=1, learner_id=2, skill="Python",
            session_date="2026-09-01", start_time="10:00", end_time="11:00", status="completed",
        )
        sess2 = models.Session(
            id=2, request_id=2, tutor_id=1, learner_id=2, skill="Python",
            session_date="2026-09-15", start_time="10:00", end_time="11:00", status="completed",
        )
        sess3 = models.Session(
            id=3, request_id=3, tutor_id=1, learner_id=3, skill="FastAPI",
            session_date="2026-10-01", start_time="14:00", end_time="16:00", status="completed",
        )

        # Reviews for sessions:
        # sess1: 5 stars
        # sess2: 4 stars
        # sess3: 5 stars
        rev1 = models.Review(
            id=1, reviewer_id=2, reviewee_id=1, request_id=1, session_id=1,
            rating=5, comment="Excellent lesson on OOP Python",
            created_at=dt.datetime(2026, 9, 1, 12, 0),
        )
        rev2 = models.Review(
            id=2, reviewer_id=2, reviewee_id=1, request_id=2, session_id=2,
            rating=4, comment="Very helpful follow-up",
            created_at=dt.datetime(2026, 9, 15, 12, 0),
        )
        rev3 = models.Review(
            id=3, reviewer_id=3, reviewee_id=1, request_id=3, session_id=3,
            rating=5, comment="FastAPI masterclass!",
            created_at=dt.datetime(2026, 10, 1, 17, 0),
        )

        self.db.add_all([req1, req2, req3, req4, sess1, sess2, sess3, rev1, rev2, rev3])
        self.db.commit()

        res = get_my_teacher_stats(current_user=self.teacher, db=self.db)

        self.assertTrue(res.has_taught)

        # Teaching experience
        # 60 + 60 + 120 = 240 mins = 4.0 hours
        self.assertEqual(res.teaching_experience["total_hours_taught"], 4.0)
        self.assertEqual(res.teaching_experience["teaching_since"], "2026-09-01")

        # Rating summary
        # (5 + 4 + 5) / 3 = 14 / 3 = 4.7
        self.assertEqual(res.rating_summary["review_count"], 3)
        self.assertEqual(res.rating_summary["average_rating"], 4.7)
        self.assertEqual(res.rating_summary["star_breakdown"]["star_5"], 2)
        self.assertEqual(res.rating_summary["star_breakdown"]["star_4"], 1)
        self.assertEqual(res.rating_summary["star_breakdown"]["star_3"], 0)

        # Session stats
        # Total sessions = 3, avg length = 240 / 3 = 80.0 mins
        self.assertEqual(res.session_stats["total_sessions_taught"], 3)
        self.assertEqual(res.session_stats["average_session_length"], 80.0)

        # Students helped
        # Learners: learner1 (Alice) with 2 sessions, learner2 (Bob) with 1 session
        # Distinct learners: 2
        # Returning students: 1 (Alice had >= 2 sessions)
        self.assertEqual(res.students_help["distinct_learners_taught"], 2)
        self.assertEqual(res.students_help["returning_students_count"], 1)

        # Skill breakdown
        # Python: 2 sessions, level 4, avg rating (5 + 4)/2 = 4.5
        # FastAPI: 1 session, level 3, avg rating 5.0
        skill_map = {item.skill_name: item for item in res.skill_breakdown}
        self.assertIn("Python", skill_map)
        self.assertEqual(skill_map["Python"].level_num, 4)
        self.assertEqual(skill_map["Python"].sessions_taught, 2)
        self.assertEqual(skill_map["Python"].average_rating, 4.5)

        self.assertIn("FastAPI", skill_map)
        self.assertEqual(skill_map["FastAPI"].level_num, 3)
        self.assertEqual(skill_map["FastAPI"].sessions_taught, 1)
        self.assertEqual(skill_map["FastAPI"].average_rating, 5.0)

        # Reliability
        # Total accepted teacher requests = 4 (req1, req2, req3, req4)
        # Completed requests = 3
        # Completion rate = 3 / 4 * 100 = 75.0%
        # Cancelled or unscheduled = 1
        self.assertEqual(res.reliability["total_accepted_requests"], 4)
        self.assertEqual(res.reliability["completed_sessions"], 3)
        self.assertEqual(res.reliability["cancelled_or_unscheduled"], 1)
        self.assertEqual(res.reliability["completion_rate"], 75.0)

        # Recent reviews (3 reviews sorted desc by created_at)
        self.assertEqual(len(res.recent_reviews), 3)
        self.assertEqual(res.recent_reviews[0].comment, "FastAPI masterclass!")
        self.assertEqual(res.recent_reviews[0].rating, 5)

    def test_teacher_stats_no_sensitive_data_leaked(self):
        """Confirm response model contains no emails, phones, or answer keys."""
        res = get_my_teacher_stats(current_user=self.teacher, db=self.db)
        dump = res.model_dump()
        dump_str = str(dump)

        self.assertNotIn("@test.com", dump_str)
        self.assertNotIn("mobile_number", dump_str)
        self.assertNotIn("answer_key", dump_str)
        self.assertNotIn("password", dump_str)


if __name__ == "__main__":
    unittest.main()
