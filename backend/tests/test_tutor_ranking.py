"""Features 2-4: teaching impact, knowledge-gap recommendations, tutor ranking."""
import datetime as dt
import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.database import Base
from backend.app import models
from backend.app.routers.marketplace import recommended_tutors, search_partners
from backend.app.services import tutor_ranking as tr

T0 = dt.datetime(2026, 10, 1, tzinfo=dt.timezone.utc)


class TutorRankingTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()
        self.me = models.User(id=1, name="Lalu Learner", email="l@x.com", hashed_password="pw", college="X")
        self.good = models.User(id=2, name="Gita Good", email="g@x.com", hashed_password="pw", college="X")
        self.ok = models.User(id=3, name="Omar Ok", email="o@x.com", hashed_password="pw", college="X")
        self.db.add_all([self.me, self.good, self.ok, models.Skill(id=1, name="Python")])
        self.db.add_all([
            models.UserSkill(user_id=1, skill_id=1, role="learning", level="Beginner", level_num=1, latest_score=40),
            models.UserSkill(user_id=2, skill_id=1, role="teaching", level="Advanced", level_num=4, latest_score=90),
            models.UserSkill(user_id=3, skill_id=1, role="teaching", level="Advanced", level_num=4, latest_score=80),
        ])
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def _score(self, user, topic, score, minutes, source="arena", session_id=None):
        self.db.add(models.TopicScore(user_id=user, skill_id=1, topic=topic, score=score, source=source,
                                      session_id=session_id, created_at=T0 + dt.timedelta(minutes=minutes)))

    def _taught_session(self, sid, tutor, learner_before, learner_after, minute):
        self.db.add(models.ConnectionRequest(id=sid, from_user_id=1, to_user_id=tutor, skill_id=1, status="accepted"))
        self.db.add(models.Session(id=sid, request_id=sid, tutor_id=tutor, learner_id=1, skill="Python",
                                   session_date="2026-10-01", start_time="10:00", end_time="11:00", status="completed"))
        self._score(1, "Loops", learner_before, minute)
        self._score(1, "Loops", learner_after, minute + 1, source="reassessment", session_id=sid)

    # ── impact ───────────────────────────────────────────────────────────────
    def test_impact_hidden_until_three_sessions(self):
        self._taught_session(10, 2, 40, 60, 0)
        self._taught_session(11, 2, 50, 70, 10)
        self.db.commit()
        imp = tr.teaching_impact_for_users(self.db, [2])[2]
        self.assertEqual(imp["sessions_measured"], 2)
        self.assertIsNone(imp["avg_gain"])                 # not shown yet
        self._taught_session(12, 2, 60, 80, 20)
        self.db.commit()
        imp = tr.teaching_impact_for_users(self.db, [2])[2]
        self.assertEqual(imp["avg_gain"], 20.0)
        self.assertEqual(imp["impact_rank"], 10.0)         # 3*20/(3+3)

    def test_bayesian_rating(self):
        self.assertEqual(tr.bayes_rating(None, 0), 3.5)
        one_five = tr.bayes_rating(5.0, 1)
        many_4_8 = tr.bayes_rating(4.8, 40)
        self.assertLess(one_five, many_4_8)               # 1 lucky review doesn't win

    # ── recommendations ──────────────────────────────────────────────────────
    def test_recommends_tutor_strong_in_my_weak_topic(self):
        self._score(1, "Loops", 30, 0)        # my weak topic
        self._score(1, "OOP", 90, 0)          # not weak
        self._score(2, "Loops", 95, 0)        # Gita is strong in it
        self._score(3, "Loops", 50, 0)        # Omar isn't
        self.db.commit()
        recs = recommended_tutors(limit=6, current_user=self.me, db=self.db)
        self.assertEqual([r.user_id for r in recs], [2])
        self.assertEqual(recs[0].weak_topics, ["Loops"])
        self.assertEqual(recs[0].strong_topics, ["Loops"])

    def test_no_weak_topics_no_recommendations(self):
        self._score(1, "Loops", 90, 0)
        self.db.commit()
        self.assertEqual(recommended_tutors(limit=6, current_user=self.me, db=self.db), [])

    # ── ranking ──────────────────────────────────────────────────────────────
    def test_search_ranks_stronger_tutor_first_with_reasons(self):
        res = search_partners(q=None, role="I Want to Learn", sort="best", current_user=self.me, db=self.db)
        self.assertEqual([r.user_id for r in res], [2, 3])
        self.assertGreater(res[0].tutor_score, res[1].tutor_score)
        self.assertIn("Scored 90% in Python", res[0].rank_reasons)


if __name__ == "__main__":
    unittest.main()
