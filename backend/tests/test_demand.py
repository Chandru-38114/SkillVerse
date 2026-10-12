"""
Tests for Task 3A: Marketplace Teacher Stats + Demand Notifications.
- Requesting a skill that already has an eligible teacher returns that teacher, no DemandRequest created.
- Requesting a skill with no teacher creates a DemandRequest and notifies the right eligible users (and nobody else).
- A later user reaching the required level triggers a notification to the original requester.
- The 3-open-requests limit is enforced.
- No notification leaks the requester's email or phone — only name and skill.
- Marketplace search includes teacher stats summary for teachers who have taught, and omits for users who haven't.
"""
import unittest
import datetime as dt
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.database import Base
from backend.app import models, schemas
from backend.app.routers.demand import create_demand_request
from backend.app.services.demand_service import (
    notify_requesters_on_teacher_level_qualified,
    fulfill_demand_request_on_connection,
)
from backend.app.routers.marketplace import search_partners
from backend.app.services.teacher_stats_service import get_teacher_public_stats_for_users


class TestDemandAndTeacherVisibility(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        # Users
        self.alice = models.User(
            id=1, email="alice_private@example.com", mobile_number="+919876543210",
            hashed_password="pw", name="Alice Smith", college="MIT", points=100
        )
        self.bob = models.User(
            id=2, email="bob_private@example.com", mobile_number="+919876543211",
            hashed_password="pw", name="Bob Jones", college="Stanford", points=100
        )
        self.charlie = models.User(
            id=3, email="charlie_private@example.com", mobile_number="+919876543212",
            hashed_password="pw", name="Charlie Brown", college="Harvard", points=100
        )
        self.daisy = models.User(
            id=4, email="daisy_private@example.com", mobile_number="+919876543213",
            hashed_password="pw", name="Daisy Miller", college="Oxford", points=100
        )

        # Skills
        self.skill_python = models.Skill(id=1, name="Python")
        self.skill_rust = models.Skill(id=2, name="Rust")
        self.skill_go = models.Skill(id=3, name="Go")
        self.skill_react = models.Skill(id=4, name="React")
        self.skill_sql = models.Skill(id=5, name="SQL")
        self.skill_docker = models.Skill(id=6, name="Docker")

        self.db.add_all([
            self.alice, self.bob, self.charlie, self.daisy,
            self.skill_python, self.skill_rust, self.skill_go,
            self.skill_react, self.skill_sql, self.skill_docker
        ])
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine)

    def test_request_skill_with_eligible_teacher_returns_teacher(self):
        """
        Requesting a skill that already has an eligible teacher returns that teacher,
        and does NOT create a DemandRequest.
        """
        # Alice is a learner at level 0 in Python
        us_alice = models.UserSkill(user_id=self.alice.id, skill_id=self.skill_python.id, role="learning", level_num=0)
        # Bob is teaching Python at level 3 (eligible: 3 >= 0 + 2 and 3 >= 2)
        us_bob = models.UserSkill(user_id=self.bob.id, skill_id=self.skill_python.id, role="teaching", level_num=3)
        self.db.add_all([us_alice, us_bob])
        self.db.commit()

        payload = schemas.DemandRequestCreate(skill_name="Python")
        res = create_demand_request(payload=payload, current_user=self.alice, db=self.db)

        # Confirm teacher is returned
        self.assertEqual(res.status, "teacher_available")
        self.assertIsNotNone(res.teacher)
        self.assertEqual(res.teacher.id, self.bob.id)
        self.assertEqual(res.teacher.name, self.bob.name)
        self.assertEqual(res.teacher.level_num, 3)

        # Confirm no DemandRequest row was created
        demand_count = self.db.query(models.DemandRequest).count()
        self.assertEqual(demand_count, 0)

        # Confirm no demand notifications were sent
        notif_count = self.db.query(models.Notification).count()
        self.assertEqual(notif_count, 0)

    def test_request_skill_with_no_teacher_creates_demand_and_notifies_eligible_only(self):
        """
        Requesting a skill with no teacher creates a DemandRequest and notifies
        the right eligible users (and nobody else).
        """
        # Alice is learning Rust (level 0).
        # Bob has Rust on his profile with level 3 (qualified to teach, even though not listed as 'teaching').
        # Charlie has Rust on his profile with level 0 and no score (unverified).
        # Daisy has NO Rust skill at all.
        us_alice = models.UserSkill(user_id=self.alice.id, skill_id=self.skill_rust.id, role="learning", level_num=0)
        us_bob = models.UserSkill(user_id=self.bob.id, skill_id=self.skill_rust.id, role="learning", level_num=3)
        us_charlie = models.UserSkill(user_id=self.charlie.id, skill_id=self.skill_rust.id, role="learning", level_num=0, latest_score=None)
        self.db.add_all([us_alice, us_bob, us_charlie])
        self.db.commit()

        payload = schemas.DemandRequestCreate(skill_name="Rust")
        res = create_demand_request(payload=payload, current_user=self.alice, db=self.db)

        # Confirm demand request created
        self.assertEqual(res.status, "open")
        self.assertIsNone(res.teacher)
        self.assertIsNotNone(res.demand_request)
        self.assertEqual(res.demand_request.requester_id, self.alice.id)
        self.assertEqual(res.demand_request.skill_id, self.skill_rust.id)

        # Check notifications created
        notifs = self.db.query(models.Notification).all()
        # Exactly 2 notifications: 1 for Bob, 1 for Charlie. Alice and Daisy get NONE.
        notified_user_ids = [n.user_id for n in notifs]
        self.assertIn(self.bob.id, notified_user_ids)
        self.assertIn(self.charlie.id, notified_user_ids)
        self.assertNotIn(self.alice.id, notified_user_ids)
        self.assertNotIn(self.daisy.id, notified_user_ids)
        self.assertEqual(len(notifs), 2)

        # Bob (already qualified at level 3) gets: "...send them a request"
        bob_notif = next(n for n in notifs if n.user_id == self.bob.id)
        self.assertIn("send them a request", bob_notif.message)
        self.assertIn("Alice", bob_notif.message)
        self.assertIn("Rust", bob_notif.message)

        # Charlie (unverified level) gets: "...take the assessment to confirm"
        charlie_notif = next(n for n in notifs if n.user_id == self.charlie.id)
        self.assertIn("take the assessment to confirm", charlie_notif.message)
        self.assertIn("Alice", charlie_notif.message)
        self.assertIn("Rust", charlie_notif.message)

    def test_later_user_reaching_required_level_triggers_notification(self):
        """
        A later user reaching the required level triggers a notification to the original requester,
        and marks the demand request fulfilled once a connection request is accepted.
        """
        # Alice creates demand request for Go (level 0)
        dr = models.DemandRequest(
            id=1,
            requester_id=self.alice.id,
            skill_id=self.skill_go.id,
            learner_level_num=0,
            status="open",
        )
        self.db.add(dr)
        self.db.commit()

        # Bob reaches level 3 in Go
        notified = notify_requesters_on_teacher_level_qualified(
            db=self.db,
            teacher_id=self.bob.id,
            skill_id=self.skill_go.id,
            new_level_num=3,
        )
        self.assertIn(self.alice.id, notified)

        # Confirm Alice got notification that teacher is available
        alice_notifs = (
            self.db.query(models.Notification)
            .filter(models.Notification.user_id == self.alice.id)
            .all()
        )
        self.assertEqual(len(alice_notifs), 1)
        self.assertIn("Bob", alice_notifs[0].message)
        self.assertIn("Go", alice_notifs[0].message)

        # Now Bob and Alice connect for Go, and connection request is accepted
        conn_req = models.ConnectionRequest(
            id=1,
            from_user_id=self.bob.id,
            to_user_id=self.alice.id,
            skill_id=self.skill_go.id,
            status="accepted"
        )
        self.db.add(conn_req)
        self.db.commit()

        # Trigger fulfillment on connection
        fulfilled_count = fulfill_demand_request_on_connection(
            db=self.db,
            user_a_id=self.bob.id,
            user_b_id=self.alice.id,
            skill_id=self.skill_go.id
        )
        self.assertEqual(fulfilled_count, 1)

        # Demand request is now fulfilled
        updated_dr = self.db.query(models.DemandRequest).filter(models.DemandRequest.id == 1).first()
        self.assertEqual(updated_dr.status, "fulfilled")

    def test_three_open_requests_limit_enforced(self):
        """
        A user can have at most 3 open demand requests at a time.
        Also verifies 24-hour cooldown after fulfilled/expired requests.
        """
        # Alice creates 3 open demand requests
        for skill in [self.skill_rust, self.skill_go, self.skill_react]:
            payload = schemas.DemandRequestCreate(skill_id=skill.id)
            res = create_demand_request(payload=payload, current_user=self.alice, db=self.db)
            self.assertEqual(res.status, "open")

        open_count = self.db.query(models.DemandRequest).filter(
            models.DemandRequest.requester_id == self.alice.id,
            models.DemandRequest.status == "open"
        ).count()
        self.assertEqual(open_count, 3)

        # Attempting 4th request must fail with 400
        payload_4 = schemas.DemandRequestCreate(skill_id=self.skill_sql.id)
        with self.assertRaises(HTTPException) as ctx:
            create_demand_request(payload=payload_4, current_user=self.alice, db=self.db)
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("at most 3 open demand requests", ctx.exception.detail)

        # Fulfill one demand request (Rust)
        dr_rust = self.db.query(models.DemandRequest).filter(
            models.DemandRequest.requester_id == self.alice.id,
            models.DemandRequest.skill_id == self.skill_rust.id
        ).first()
        dr_rust.status = "fulfilled"
        self.db.commit()

        # Alice now has 2 open requests, but re-requesting Rust within 24h must be rejected
        payload_re_rust = schemas.DemandRequestCreate(skill_id=self.skill_rust.id)
        with self.assertRaises(HTTPException) as ctx2:
            create_demand_request(payload=payload_re_rust, current_user=self.alice, db=self.db)
        self.assertEqual(ctx2.exception.status_code, 400)
        self.assertIn("within 24 hours", ctx2.exception.detail)

        # But Alice CAN request a different skill (SQL) because she now has 2 open requests
        res_sql = create_demand_request(payload=payload_4, current_user=self.alice, db=self.db)
        self.assertEqual(res_sql.status, "open")

    def test_no_notification_leaks_requester_email_or_phone(self):
        """
        No notification leaks the requester's email or phone — only name and skill.
        """
        # Bob (level 3) and Charlie (level 0) have Docker on their profile, but neither is listed as teaching
        us_bob = models.UserSkill(user_id=self.bob.id, skill_id=self.skill_docker.id, role="learning", level_num=3)
        us_charlie = models.UserSkill(user_id=self.charlie.id, skill_id=self.skill_docker.id, role="learning", level_num=0)
        self.db.add_all([us_bob, us_charlie])
        self.db.commit()

        # Alice submits demand request for Docker
        payload = schemas.DemandRequestCreate(skill_name="Docker")
        create_demand_request(payload=payload, current_user=self.alice, db=self.db)

        # Inspect all created notifications
        all_notifs = self.db.query(models.Notification).all()
        self.assertGreater(len(all_notifs), 0)

        for n in all_notifs:
            msg = n.message
            title = n.title
            combined = f"{title} {msg}"

            # Ensure private email and phone NEVER appear anywhere in notifications
            self.assertNotIn("alice_private@example.com", combined)
            self.assertNotIn("+919876543210", combined)
            self.assertNotIn("9876543210", combined)
            self.assertNotIn("example.com", combined)

            # Ensure public name and skill ARE present
            self.assertIn("Alice", combined)
            self.assertIn("Docker", combined)

    def test_marketplace_teacher_stats_in_search(self):
        """
        Part 1: In marketplace search, users who have taught at least one completed session
        include teacher stats (average_rating, review_count, sessions_taught, teaching_since),
        while users who have NOT taught omit them.
        """
        # Bob is teaching Python and has taught 2 completed sessions
        us_bob = models.UserSkill(user_id=self.bob.id, skill_id=self.skill_python.id, role="teaching", level_num=3)
        # Charlie is also teaching Python but has NEVER taught a completed session
        us_charlie = models.UserSkill(user_id=self.charlie.id, skill_id=self.skill_python.id, role="teaching", level_num=3)
        self.db.add_all([us_bob, us_charlie])

        # Bob's 2 completed sessions
        sess1 = models.Session(
            id=1, request_id=1, tutor_id=self.bob.id, learner_id=self.daisy.id, skill="Python",
            session_date="2026-08-15", start_time="10:00", end_time="11:00", status="completed"
        )
        sess2 = models.Session(
            id=2, request_id=2, tutor_id=self.bob.id, learner_id=self.daisy.id, skill="Python",
            session_date="2026-09-01", start_time="14:00", end_time="15:00", status="completed"
        )
        self.db.add_all([sess1, sess2])

        # Review for Bob: rating 5
        rev1 = models.Review(
            id=1, reviewer_id=self.daisy.id, reviewee_id=self.bob.id, request_id=1, session_id=1,
            rating=5, comment="Great Python session"
        )
        self.db.add(rev1)
        self.db.commit()

        # Shared service test
        summaries = get_teacher_public_stats_for_users(self.db, [self.bob.id, self.charlie.id])
        self.assertIn(self.bob.id, summaries)
        self.assertNotIn(self.charlie.id, summaries)  # Charlie has never taught, omitted!

        bob_stats = summaries[self.bob.id]
        self.assertEqual(bob_stats["sessions_taught"], 2)
        self.assertEqual(bob_stats["teaching_since"], "2026-08-15")
        self.assertEqual(bob_stats["review_count"], 1)
        self.assertEqual(bob_stats["average_rating"], 5.0)

        # Search endpoint test
        results = search_partners(q="Python", role="All", current_user=self.alice, db=self.db)
        bob_res = next(r for r in results if r.user_id == self.bob.id)
        charlie_res = next(r for r in results if r.user_id == self.charlie.id)

        # Bob has taught: stats are populated
        self.assertIsNotNone(bob_res.teacher_stats)
        self.assertEqual(bob_res.teacher_stats.sessions_taught, 2)
        self.assertEqual(bob_res.teacher_stats.teaching_since, "2026-08-15")
        self.assertEqual(bob_res.teacher_stats.review_count, 1)
        self.assertEqual(bob_res.teacher_stats.average_rating, 5.0)
        self.assertEqual(bob_res.sessions_taught, 2)
        self.assertEqual(bob_res.teaching_since, "2026-08-15")

        # Charlie has NOT taught: stats are omitted / None
        self.assertIsNone(charlie_res.teacher_stats)
        self.assertIsNone(charlie_res.sessions_taught)
        self.assertIsNone(charlie_res.teaching_since)
        self.assertIsNone(charlie_res.average_rating)
        self.assertIsNone(charlie_res.review_count)


if __name__ == "__main__":
    unittest.main()
