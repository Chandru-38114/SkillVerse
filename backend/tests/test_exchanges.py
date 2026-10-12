import unittest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi import HTTPException

from backend.app.database import Base
from backend.app import models
from backend.app.services.cycles import find_cycle_suggestions_for_user
from backend.app.routers.exchanges import propose_cycle, respond_to_cycle, ProposeCycleRequest, CycleLegProposal, RespondCycleRequest


class TestExchangeGroupsAndCycles(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        # Users A, B, C
        self.userA = models.User(id=1, email="a@test.com", hashed_password="pw", name="User A", points=100)
        self.userB = models.User(id=2, email="b@test.com", hashed_password="pw", name="User B", points=100)
        self.userC = models.User(id=3, email="c@test.com", hashed_password="pw", name="User C", points=100)

        # Skills: Python, React, Rust
        self.skill_python = models.Skill(id=1, name="Python")
        self.skill_react = models.Skill(id=2, name="React")
        self.skill_rust = models.Skill(id=3, name="Rust")

        self.db.add_all([
            self.userA, self.userB, self.userC,
            self.skill_python, self.skill_react, self.skill_rust
        ])
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine)

    def test_cycle_suggestion_found_when_no_pair_match(self):
        # A teaches Python (lvl 4), wants React (lvl 0)
        # B teaches React (lvl 3), wants Rust (lvl 1)
        # C teaches Rust (lvl 4), wants Python (lvl 0)
        # Notice:
        # A wants React. Does B teach React? Yes (lvl 3 vs lvl 0 -> ok).
        # But B wants Rust, not Python. So A and B have NO pair match.
        # B wants Rust. C teaches Rust (lvl 4 vs lvl 1 -> ok).
        # C wants Python, not React. So B and C have NO pair match.
        # C wants Python. A teaches Python (lvl 4 vs lvl 0 -> ok).
        # A wants React, not Rust. So C and A have NO pair match.
        # This is a perfect 3-way cycle: A -> B -> C -> A
        self.db.add_all([
            models.UserSkill(user_id=1, skill_id=1, role="teaching", level_num=4),
            models.UserSkill(user_id=1, skill_id=2, role="learning", level_num=0),

            models.UserSkill(user_id=2, skill_id=2, role="teaching", level_num=3),
            models.UserSkill(user_id=2, skill_id=3, role="learning", level_num=1),

            models.UserSkill(user_id=3, skill_id=3, role="teaching", level_num=4),
            models.UserSkill(user_id=3, skill_id=1, role="learning", level_num=0),
        ])
        self.db.commit()

        suggestions = find_cycle_suggestions_for_user(self.db, user_id=1)
        self.assertEqual(len(suggestions), 1)
        sug = suggestions[0]
        self.assertEqual(len(sug["legs"]), 3)
        self.assertEqual(sug["legs"][0]["teacher_id"], 1)
        self.assertEqual(sug["legs"][0]["learner_id"], 3) # Wait, A teaches Python to C
        # Or A -> B -> C -> A depending on orientation
        # Let's verify cycle is closed
        teachers = [leg["teacher_id"] for leg in sug["legs"]]
        learners = [leg["learner_id"] for leg in sug["legs"]]
        self.assertEqual(set(teachers), {1, 2, 3})
        self.assertEqual(set(learners), {1, 2, 3})

    def test_no_suggestion_when_eligibility_fails(self):
        # Teacher has level 1, learner has level 0. Difference is 1 < 2, and level 1 < 2.
        # Eligibility fails!
        self.db.add_all([
            models.UserSkill(user_id=1, skill_id=1, role="teaching", level_num=1), # below 2!
            models.UserSkill(user_id=1, skill_id=2, role="learning", level_num=0),

            models.UserSkill(user_id=2, skill_id=2, role="teaching", level_num=3),
            models.UserSkill(user_id=2, skill_id=3, role="learning", level_num=1),

            models.UserSkill(user_id=3, skill_id=3, role="teaching", level_num=4),
            models.UserSkill(user_id=3, skill_id=1, role="learning", level_num=0),
        ])
        self.db.commit()

        suggestions = find_cycle_suggestions_for_user(self.db, user_id=1)
        self.assertEqual(len(suggestions), 0)

    def test_cycle_accept_by_all_becomes_active_with_three_legs(self):
        # Setup skills with valid eligibility
        self.db.add_all([
            models.UserSkill(user_id=1, skill_id=1, role="teaching", level_num=4),
            models.UserSkill(user_id=3, skill_id=1, role="learning", level_num=0),

            models.UserSkill(user_id=3, skill_id=3, role="teaching", level_num=4),
            models.UserSkill(user_id=2, skill_id=3, role="learning", level_num=1),

            models.UserSkill(user_id=2, skill_id=2, role="teaching", level_num=3),
            models.UserSkill(user_id=1, skill_id=2, role="learning", level_num=0),
        ])
        self.db.commit()

        # Propose cycle: 1 teaches 3 (Python), 3 teaches 2 (Rust), 2 teaches 1 (React)
        payload = ProposeCycleRequest(
            legs=[
                CycleLegProposal(teacher_id=1, learner_id=3, skill_id=1),
                CycleLegProposal(teacher_id=3, learner_id=2, skill_id=3),
                CycleLegProposal(teacher_id=2, learner_id=1, skill_id=2),
            ]
        )
        res = propose_cycle(payload=payload, current_user=self.userA, db=self.db)
        grp_id = res["id"]
        self.assertEqual(res["status"], "proposed")
        self.assertEqual(len(res["legs"]), 3)

        # Proposer (User A) is accepted=True, others False
        member_a = self.db.query(models.ExchangeMember).filter_by(group_id=grp_id, user_id=1).first()
        member_b = self.db.query(models.ExchangeMember).filter_by(group_id=grp_id, user_id=2).first()
        member_c = self.db.query(models.ExchangeMember).filter_by(group_id=grp_id, user_id=3).first()
        self.assertTrue(member_a.accepted)
        self.assertFalse(member_b.accepted)
        self.assertFalse(member_c.accepted)

        # User B accepts
        res_b = respond_to_cycle(group_id=grp_id, payload=RespondCycleRequest(accept=True), current_user=self.userB, db=self.db)
        self.assertEqual(res_b["status"], "proposed")

        # User C accepts -> All 3 accepted!
        res_c = respond_to_cycle(group_id=grp_id, payload=RespondCycleRequest(accept=True), current_user=self.userC, db=self.db)
        self.assertEqual(res_c["status"], "active")

        # Check that 3 connection requests were created for the legs
        legs = self.db.query(models.ExchangeLeg).filter_by(group_id=grp_id).all()
        self.assertEqual(len(legs), 3)
        for leg in legs:
            self.assertEqual(leg.status, "active")
            self.assertIsNotNone(leg.request_id)
            req = self.db.query(models.ConnectionRequest).filter_by(id=leg.request_id).first()
            self.assertIsNotNone(req)
            self.assertEqual(req.status, "accepted")

    def test_cycle_declined_by_one_becomes_cancelled(self):
        # Setup skills
        self.db.add_all([
            models.UserSkill(user_id=1, skill_id=1, role="teaching", level_num=4),
            models.UserSkill(user_id=3, skill_id=1, role="learning", level_num=0),
            models.UserSkill(user_id=3, skill_id=3, role="teaching", level_num=4),
            models.UserSkill(user_id=2, skill_id=3, role="learning", level_num=1),
            models.UserSkill(user_id=2, skill_id=2, role="teaching", level_num=3),
            models.UserSkill(user_id=1, skill_id=2, role="learning", level_num=0),
        ])
        self.db.commit()

        payload = ProposeCycleRequest(
            legs=[
                CycleLegProposal(teacher_id=1, learner_id=3, skill_id=1),
                CycleLegProposal(teacher_id=3, learner_id=2, skill_id=3),
                CycleLegProposal(teacher_id=2, learner_id=1, skill_id=2),
            ]
        )
        res = propose_cycle(payload=payload, current_user=self.userA, db=self.db)
        grp_id = res["id"]

        # User B declines
        res_b = respond_to_cycle(group_id=grp_id, payload=RespondCycleRequest(accept=False), current_user=self.userB, db=self.db)
        self.assertEqual(res_b["status"], "cancelled")

        grp = self.db.query(models.ExchangeGroup).filter_by(id=grp_id).first()
        self.assertEqual(grp.status, "cancelled")

    def test_points_only_after_delivery(self):
        # Setup and activate a cycle
        self.db.add_all([
            models.UserSkill(user_id=1, skill_id=1, role="teaching", level_num=4),
            models.UserSkill(user_id=3, skill_id=1, role="learning", level_num=0),
            models.UserSkill(user_id=3, skill_id=3, role="teaching", level_num=4),
            models.UserSkill(user_id=2, skill_id=3, role="learning", level_num=1),
            models.UserSkill(user_id=2, skill_id=2, role="teaching", level_num=3),
            models.UserSkill(user_id=1, skill_id=2, role="learning", level_num=0),
        ])
        self.db.commit()

        payload = ProposeCycleRequest(
            legs=[
                CycleLegProposal(teacher_id=1, learner_id=3, skill_id=1),
                CycleLegProposal(teacher_id=3, learner_id=2, skill_id=3),
                CycleLegProposal(teacher_id=2, learner_id=1, skill_id=2),
            ]
        )
        res = propose_cycle(payload=payload, current_user=self.userA, db=self.db)
        grp_id = res["id"]
        respond_to_cycle(group_id=grp_id, payload=RespondCycleRequest(accept=True), current_user=self.userB, db=self.db)
        respond_to_cycle(group_id=grp_id, payload=RespondCycleRequest(accept=True), current_user=self.userC, db=self.db)

        leg1 = self.db.query(models.ExchangeLeg).filter_by(group_id=grp_id, teacher_id=1).first()
        self.assertEqual(leg1.status, "active")

        # Before delivery, teacher User A has initial points 100
        self.db.refresh(self.userA)
        self.assertEqual(self.userA.points, 100)

        # Simulate delivery of leg1 via complete_session
        from backend.app.routers.progress import complete_session
        # Create session for leg1
        sess = models.Session(
            id=501,
            request_id=leg1.request_id,
            tutor_id=1,
            learner_id=3,
            skill="Python",
            session_date="2026-10-12",
            start_time="10:00",
            end_time="11:00",
            status="scheduled"
        )
        self.db.add(sess)
        self.db.commit()

        # Deliver session
        complete_session(session_id=501, db=self.db, current_user=self.userA)

        self.db.refresh(leg1)
        self.assertEqual(leg1.status, "delivered")
        self.assertIsNotNone(leg1.delivered_at)

        # Teacher User A received +20 points
        self.db.refresh(self.userA)
        self.assertEqual(self.userA.points, 120)

        # The group is not yet completed because legs 2 & 3 are not delivered
        grp = self.db.query(models.ExchangeGroup).filter_by(id=grp_id).first()
        self.assertEqual(grp.status, "active")

    def test_teacher_cannot_get_double_points_from_session_and_complete_request(self):
        # Setup and activate a cycle
        self.db.add_all([
            models.UserSkill(user_id=1, skill_id=1, role="teaching", level_num=4),
            models.UserSkill(user_id=3, skill_id=1, role="learning", level_num=0),
            models.UserSkill(user_id=3, skill_id=3, role="teaching", level_num=4),
            models.UserSkill(user_id=2, skill_id=3, role="learning", level_num=1),
            models.UserSkill(user_id=2, skill_id=2, role="teaching", level_num=3),
            models.UserSkill(user_id=1, skill_id=2, role="learning", level_num=0),
        ])
        self.db.commit()

        payload = ProposeCycleRequest(
            legs=[
                CycleLegProposal(teacher_id=1, learner_id=3, skill_id=1),
                CycleLegProposal(teacher_id=3, learner_id=2, skill_id=3),
                CycleLegProposal(teacher_id=2, learner_id=1, skill_id=2),
            ]
        )
        res = propose_cycle(payload=payload, current_user=self.userA, db=self.db)
        grp_id = res["id"]
        respond_to_cycle(group_id=grp_id, payload=RespondCycleRequest(accept=True), current_user=self.userB, db=self.db)
        respond_to_cycle(group_id=grp_id, payload=RespondCycleRequest(accept=True), current_user=self.userC, db=self.db)

        leg1 = self.db.query(models.ExchangeLeg).filter_by(group_id=grp_id, teacher_id=1).first()

        # Teacher User A initial points = 100
        self.db.refresh(self.userA)
        self.assertEqual(self.userA.points, 100)

        # Create session for leg1
        sess = models.Session(
            id=601,
            request_id=leg1.request_id,
            tutor_id=1,
            learner_id=3,
            skill="Python",
            session_date="2026-10-12",
            start_time="10:00",
            end_time="11:00",
            status="scheduled"
        )
        self.db.add(sess)
        self.db.commit()

        # Step 1: Complete session (delivery) -> Teacher receives +20 points
        from backend.app.routers.progress import complete_session
        complete_session(session_id=601, db=self.db, current_user=self.userA)

        self.db.refresh(self.userA)
        self.assertEqual(self.userA.points, 120)

        # Step 2: Now complete the request -> Teacher MUST NOT get another +20 points
        from backend.app.routers.requests import complete_request
        complete_request(request_id=leg1.request_id, current_user=self.userA, db=self.db)

        self.db.refresh(self.userA)
        self.assertEqual(self.userA.points, 120)  # Remains 120, NOT 140!


if __name__ == '__main__':
    unittest.main()
