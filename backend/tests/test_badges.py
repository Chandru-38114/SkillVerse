import unittest
import datetime as dt
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.database import Base
from backend.app import models
from backend.app.services.badge_service import (
    TEACHER_BADGES,
    check_and_award_teacher_badges,
    get_user_earned_badges,
    award_badges_retroactively,
)


class TestTeacherBadges(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        # Seed test users
        self.user1 = models.User(id=1, email="tutor1@test.com", hashed_password="pw", name="Tutor One")
        self.user2 = models.User(id=2, email="learner2@test.com", hashed_password="pw", name="Learner Two")
        self.user3 = models.User(id=3, email="peer3@test.com", hashed_password="pw", name="Peer Three")

        # Seed skills
        self.skill1 = models.Skill(id=1, name="Python")
        self.skill2 = models.Skill(id=2, name="Web Development")

        self.db.add_all([self.user1, self.user2, self.user3, self.skill1, self.skill2])
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine)

    def test_first_class_badge_threshold(self):
        """
        'First Class' (Bronze):
        - 0 completed teaching sessions -> not awarded.
        - Scheduled/cancelled session -> not awarded.
        - Completed session as learner -> not awarded.
        - Exact threshold: 1 completed session as tutor -> awarded!
        """
        # Initially 0 sessions
        check_and_award_teacher_badges(self.db, self.user1.id)
        earned = get_user_earned_badges(self.db, self.user1.id)
        self.assertEqual(len(earned), 0)

        # Connection request
        req = models.ConnectionRequest(id=1, from_user_id=2, to_user_id=1, skill_id=1, status="accepted")
        self.db.add(req)
        self.db.commit()

        # 1 scheduled session (not completed yet)
        sess_scheduled = models.Session(
            id=1, request_id=1, tutor_id=1, learner_id=2, skill="Python",
            session_date="2026-10-10", start_time="10:00", end_time="11:00",
            status="scheduled"
        )
        self.db.add(sess_scheduled)
        self.db.commit()

        check_and_award_teacher_badges(self.db, self.user1.id)
        earned = get_user_earned_badges(self.db, self.user1.id)
        self.assertEqual(len(earned), 0)

        # User is learner in a completed session, not tutor
        sess_learner = models.Session(
            id=2, request_id=1, tutor_id=2, learner_id=1, skill="Python",
            session_date="2026-10-11", start_time="10:00", end_time="11:00",
            status="completed"
        )
        self.db.add(sess_learner)
        self.db.commit()

        check_and_award_teacher_badges(self.db, self.user1.id)
        earned = get_user_earned_badges(self.db, self.user1.id)
        self.assertEqual(len(earned), 0)

        # Now complete a session where user1 is TUTOR
        sess_tutor = models.Session(
            id=3, request_id=1, tutor_id=1, learner_id=2, skill="Python",
            session_date="2026-10-12", start_time="10:00", end_time="11:00",
            status="completed"
        )
        self.db.add(sess_tutor)
        self.db.commit()

        check_and_award_teacher_badges(self.db, self.user1.id)
        earned = get_user_earned_badges(self.db, self.user1.id)
        earned_ids = [b["id"] for b in earned]
        self.assertIn("first_class", earned_ids)

    def test_centurion_badge_threshold(self):
        """
        'Centurion' (Expert):
        - 99 completed teaching sessions -> not awarded.
        - Exact threshold: 100 completed teaching sessions -> awarded!
        """
        req = models.ConnectionRequest(id=1, from_user_id=2, to_user_id=1, skill_id=1, status="accepted")
        self.db.add(req)
        self.db.commit()

        # Add 99 completed teaching sessions
        sessions_99 = [
            models.Session(
                id=100 + i, request_id=1, tutor_id=1, learner_id=2, skill="Python",
                session_date="2026-10-10", start_time="10:00", end_time="11:00",
                status="completed"
            )
            for i in range(99)
        ]
        self.db.add_all(sessions_99)
        self.db.commit()

        check_and_award_teacher_badges(self.db, self.user1.id)
        earned = get_user_earned_badges(self.db, self.user1.id)
        earned_ids = [b["id"] for b in earned]
        self.assertNotIn("centurion", earned_ids)

        # Add the 100th session
        sess_100 = models.Session(
            id=199, request_id=1, tutor_id=1, learner_id=2, skill="Python",
            session_date="2026-10-10", start_time="10:00", end_time="11:00",
            status="completed"
        )
        self.db.add(sess_100)
        self.db.commit()

        check_and_award_teacher_badges(self.db, self.user1.id)
        earned = get_user_earned_badges(self.db, self.user1.id)
        earned_ids = [b["id"] for b in earned]
        self.assertIn("centurion", earned_ids)

    def test_five_star_mentor_threshold(self):
        """
        'Five-Star Mentor' (Gold):
        - 9 completed teaching sessions with 5.0 rating -> not awarded (needs 10+ sessions).
        - 10 completed teaching sessions with 4.7 avg rating -> not awarded (needs 4.8+ rating).
        - 10 completed teaching sessions with 4.8 avg rating -> awarded!
        """
        req = models.ConnectionRequest(id=1, from_user_id=2, to_user_id=1, skill_id=1, status="accepted")
        self.db.add(req)
        self.db.commit()

        # 9 completed teaching sessions
        for i in range(9):
            s = models.Session(
                id=300 + i, request_id=1, tutor_id=1, learner_id=2, skill="Python",
                session_date="2026-10-10", start_time="10:00", end_time="11:00",
                status="completed"
            )
            self.db.add(s)
        # 5.0 rating on 5 reviews
        for i in range(5):
            r = models.Review(id=300 + i, reviewer_id=2, reviewee_id=1, request_id=1, rating=5)
            self.db.add(r)
        self.db.commit()

        # Not awarded at 9 sessions
        check_and_award_teacher_badges(self.db, self.user1.id)
        earned_ids = [b["id"] for b in get_user_earned_badges(self.db, self.user1.id)]
        self.assertNotIn("five_star_mentor", earned_ids)

        # Add 10th session
        s10 = models.Session(
            id=309, request_id=1, tutor_id=1, learner_id=2, skill="Python",
            session_date="2026-10-10", start_time="10:00", end_time="11:00",
            status="completed"
        )
        self.db.add(s10)

        # Add reviews giving an average of 4.7
        # Currently 5 ratings of 5 (sum=25). If we add one rating of 3: sum=28/6 = 4.67 < 4.8
        r_low = models.Review(id=310, reviewer_id=2, reviewee_id=1, request_id=1, rating=3)
        self.db.add(r_low)
        self.db.commit()

        check_and_award_teacher_badges(self.db, self.user1.id)
        earned_ids = [b["id"] for b in get_user_earned_badges(self.db, self.user1.id)]
        self.assertNotIn("five_star_mentor", earned_ids)

        # Update rating to bring average up to 4.8+:
        # Remove low review, add ratings giving >= 4.8
        self.db.delete(r_low)
        # Reviews: 5 ratings of 5, plus 1 rating of 4 -> sum=29/6 = 4.83 >= 4.8
        r_good = models.Review(id=311, reviewer_id=2, reviewee_id=1, request_id=1, rating=4)
        self.db.add(r_good)
        self.db.commit()

        check_and_award_teacher_badges(self.db, self.user1.id)
        earned_ids = [b["id"] for b in get_user_earned_badges(self.db, self.user1.id)]
        self.assertIn("five_star_mentor", earned_ids)

    def test_circle_builder_threshold(self):
        """
        'Circle Builder' (Gold):
        - No exchange -> not awarded.
        - Pair exchange group completed -> not awarded (must be a cycle).
        - Cycle exchange group active (not completed) -> not awarded.
        - Exact threshold: cycle exchange group completed -> awarded!
        """
        # Pair exchange completed
        pair_grp = models.ExchangeGroup(id=1, kind="pair", status="completed")
        pair_mem = models.ExchangeMember(id=1, group_id=1, user_id=1, accepted=True)
        self.db.add_all([pair_grp, pair_mem])
        self.db.commit()

        check_and_award_teacher_badges(self.db, self.user1.id)
        earned_ids = [b["id"] for b in get_user_earned_badges(self.db, self.user1.id)]
        self.assertNotIn("circle_builder", earned_ids)

        # Cycle exchange group active/proposed
        cycle_grp = models.ExchangeGroup(id=2, kind="cycle", status="active")
        cycle_mem = models.ExchangeMember(id=2, group_id=2, user_id=1, accepted=True)
        self.db.add_all([cycle_grp, cycle_mem])
        self.db.commit()

        check_and_award_teacher_badges(self.db, self.user1.id)
        earned_ids = [b["id"] for b in get_user_earned_badges(self.db, self.user1.id)]
        self.assertNotIn("circle_builder", earned_ids)

        # Mark cycle group completed
        cycle_grp.status = "completed"
        self.db.commit()

        check_and_award_teacher_badges(self.db, self.user1.id)
        earned_ids = [b["id"] for b in get_user_earned_badges(self.db, self.user1.id)]
        self.assertIn("circle_builder", earned_ids)

    def test_user_badge_list_only_shows_earned_badges(self):
        """
        A user's badge list only returns badges that are actually earned.
        It NEVER returns all 8 badges with 'locked' placeholders leaking criteria.
        """
        # User 1 has no achievements yet
        badges_empty = get_user_earned_badges(self.db, self.user1.id)
        self.assertEqual(badges_empty, [])

        # User 1 earns only 'first_class'
        req = models.ConnectionRequest(id=1, from_user_id=2, to_user_id=1, skill_id=1, status="accepted")
        sess = models.Session(
            id=1, request_id=1, tutor_id=1, learner_id=2, skill="Python",
            session_date="2026-10-10", start_time="10:00", end_time="11:00",
            status="completed"
        )
        self.db.add_all([req, sess])
        self.db.commit()

        check_and_award_teacher_badges(self.db, self.user1.id)
        earned = get_user_earned_badges(self.db, self.user1.id)

        # Length must be exactly 1, containing ONLY First Class
        self.assertEqual(len(earned), 1)
        self.assertEqual(earned[0]["id"], "first_class")
        self.assertEqual(earned[0]["tier"], "bronze")
        self.assertTrue(earned[0]["earned"])

        # Confirm none of the unearned badges are present
        all_ids = {b["id"] for b in earned}
        self.assertNotIn("quick_responder", all_ids)
        self.assertNotIn("study_circle_regular", all_ids)
        self.assertNotIn("senior_advisor", all_ids)
        self.assertNotIn("five_star_mentor", all_ids)
        self.assertNotIn("circle_builder", all_ids)
        self.assertNotIn("hackathon_host", all_ids)
        self.assertNotIn("centurion", all_ids)

    def test_stubbed_community_badges_defined_but_unawardable(self):
        """
        The 4 Task 4A community badges are defined in TEACHER_BADGES with computable=False
        and are never awarded yet:
        - quick_responder
        - study_circle_regular
        - senior_advisor
        - hackathon_host
        """
        for badge_id in ["quick_responder", "study_circle_regular", "senior_advisor", "hackathon_host"]:
            self.assertIn(badge_id, TEACHER_BADGES)
            defn = TEACHER_BADGES[badge_id]
            self.assertFalse(defn["computable"])
            self.assertTrue(defn.get("stubbed", False))

        # Even with check_and_award_teacher_badges run, they should not be awarded
        check_and_award_teacher_badges(self.db, self.user1.id)
        earned_ids = [b["id"] for b in get_user_earned_badges(self.db, self.user1.id)]
        for badge_id in ["quick_responder", "study_circle_regular", "senior_advisor", "hackathon_host"]:
            self.assertNotIn(badge_id, earned_ids)

    def test_retroactive_awards_existing_users(self):
        """
        award_badges_retroactively scans all existing users and awards qualified badges.
        """
        # User 1: taught 1 session -> earns first_class
        # User 2: taught 0 sessions -> 0 badges
        # User 3: taught 10 sessions with 5.0 avg rating -> earns first_class + five_star_mentor
        req1 = models.ConnectionRequest(id=1, from_user_id=2, to_user_id=1, skill_id=1, status="accepted")
        sess1 = models.Session(
            id=1, request_id=1, tutor_id=1, learner_id=2, skill="Python",
            session_date="2026-10-10", start_time="10:00", end_time="11:00",
            status="completed"
        )
        self.db.add_all([req1, sess1])

        # User 3 setup
        req3 = models.ConnectionRequest(id=2, from_user_id=2, to_user_id=3, skill_id=2, status="accepted")
        self.db.add(req3)
        for i in range(10):
            s = models.Session(
                id=500 + i, request_id=2, tutor_id=3, learner_id=2, skill="Web Development",
                session_date="2026-10-10", start_time="10:00", end_time="11:00",
                status="completed"
            )
            self.db.add(s)
            r = models.Review(id=500 + i, reviewer_id=2, reviewee_id=3, request_id=2, rating=5)
            self.db.add(r)
        self.db.commit()

        # Run retroactive award
        summary = award_badges_retroactively(self.db)

        # Check user 1
        u1_badges = [b["id"] for b in get_user_earned_badges(self.db, self.user1.id)]
        self.assertEqual(u1_badges, ["first_class"])

        # Check user 2
        u2_badges = [b["id"] for b in get_user_earned_badges(self.db, self.user2.id)]
        self.assertEqual(u2_badges, [])

        # Check user 3
        u3_badges = set(b["id"] for b in get_user_earned_badges(self.db, self.user3.id))
        self.assertIn("first_class", u3_badges)
        self.assertIn("five_star_mentor", u3_badges)
