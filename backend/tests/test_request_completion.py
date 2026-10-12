import unittest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi import HTTPException

from backend.app.database import Base
from backend.app import models
from backend.app.routers.requests import complete_request


class TestCompleteRequestSessionPoints(unittest.TestCase):
    def setUp(self):
        # In-memory SQLite for clean isolation
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        # Create two test users
        self.user1 = models.User(
            id=1, email="user1@test.com", hashed_password="hash", name="User One", points=100
        )
        self.user2 = models.User(
            id=2, email="user2@test.com", hashed_password="hash", name="User Two", points=100
        )
        self.skill = models.Skill(id=1, name="Python")
        self.db.add_all([self.user1, self.user2, self.skill])
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine)

    def test_complete_without_session_gives_no_points(self):
        # Create an accepted request with NO session
        req = models.ConnectionRequest(
            id=101,
            from_user_id=1,
            to_user_id=2,
            skill_id=1,
            status="accepted",
            points_awarded=False
        )
        self.db.add(req)
        self.db.commit()

        # Calling complete_request should fail with "Hold a session before completing"
        with self.assertRaises(HTTPException) as ctx:
            complete_request(request_id=101, current_user=self.user1, db=self.db)
        
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("Hold a session before completing", ctx.exception.detail)

        # Points should NOT change
        self.db.refresh(self.user1)
        self.db.refresh(self.user2)
        self.assertEqual(self.user1.points, 100)
        self.assertEqual(self.user2.points, 100)
        self.db.refresh(req)
        self.assertEqual(req.status, "accepted")
        self.assertFalse(req.points_awarded)

    def test_complete_after_finished_session_gives_points_once(self):
        # Create an accepted request and a finished session
        req = models.ConnectionRequest(
            id=102,
            from_user_id=1,
            to_user_id=2,
            skill_id=1,
            status="accepted",
            points_awarded=False
        )
        self.db.add(req)
        self.db.commit()

        session = models.Session(
            id=201,
            request_id=102,
            tutor_id=2,
            learner_id=1,
            skill="Python",
            session_date="2026-10-12",
            start_time="10:00",
            end_time="11:00",
            status="completed"
        )
        self.db.add(session)
        self.db.commit()

        # First call succeeds and gives points
        res = complete_request(request_id=102, current_user=self.user1, db=self.db)
        self.assertEqual(res.status, "completed")

        self.db.refresh(self.user1)
        self.db.refresh(self.user2)
        self.assertEqual(self.user1.points, 120)
        self.assertEqual(self.user2.points, 120)
        self.db.refresh(req)
        self.assertTrue(req.points_awarded)

    def test_calling_twice_does_not_give_points_twice(self):
        # Setup accepted request + finished session
        req = models.ConnectionRequest(
            id=103,
            from_user_id=1,
            to_user_id=2,
            skill_id=1,
            status="accepted",
            points_awarded=False
        )
        self.db.add(req)
        self.db.commit()

        session = models.Session(
            id=202,
            request_id=103,
            tutor_id=2,
            learner_id=1,
            skill="Python",
            session_date="2026-10-12",
            start_time="10:00",
            end_time="11:00",
            status="completed"
        )
        self.db.add(session)
        self.db.commit()

        # First call succeeds
        complete_request(request_id=103, current_user=self.user1, db=self.db)
        self.db.refresh(self.user1)
        self.db.refresh(self.user2)
        self.assertEqual(self.user1.points, 120)
        self.assertEqual(self.user2.points, 120)

        # Second call raises HTTPException (already marked as completed)
        with self.assertRaises(HTTPException) as ctx:
            complete_request(request_id=103, current_user=self.user1, db=self.db)
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("already marked as completed", ctx.exception.detail)

        # Points remain 120 (never double credited)
        self.db.refresh(self.user1)
        self.db.refresh(self.user2)
        self.assertEqual(self.user1.points, 120)
        self.assertEqual(self.user2.points, 120)


if __name__ == '__main__':
    unittest.main()
