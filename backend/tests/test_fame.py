"""Fame page: trusted ratings, knowledge from counted weekly scores, rankings, weekly badges."""
import datetime as dt
import unittest
from unittest import mock

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.database import Base
from backend.app import models
from backend.app.services import fame as F

T0 = dt.datetime(2026, 10, 5, 10, 0)          # a Monday
TODAY = dt.date(2026, 11, 11)


def monday(weeks_ago):
    d = TODAY - dt.timedelta(days=TODAY.weekday())
    return d - dt.timedelta(weeks=weeks_ago)


class FameTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()
        for i, name in [(1, "Asha"), (2, "Bala"), (3, "Chitra"), (4, "Dev"), (5, "Esha"), (6, "Farid")]:
            self.db.add(models.User(id=i, name=name, email=f"{i}@x.com", hashed_password="pw"))
        self.db.add(models.Skill(id=1, name="Python"))
        self.db.add_all([
            models.UserSkill(user_id=1, skill_id=1, role="teaching", level="Advanced", level_num=4, latest_score=92),
            models.UserSkill(user_id=2, skill_id=1, role="teaching", level="Advanced", level_num=4, latest_score=85),
            models.UserSkill(user_id=3, skill_id=1, role="learning", level="Beginner", level_num=1, latest_score=70),
        ])
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def _session(self, sid, tutor, learner):
        self.db.add(models.ConnectionRequest(id=sid, from_user_id=learner, to_user_id=tutor, skill_id=1, status="accepted"))
        self.db.add(models.Session(id=sid, request_id=sid, tutor_id=tutor, learner_id=learner, skill="Python",
                                   session_date="2026-10-10", start_time="10:00", end_time="11:00", status="completed"))

    def _review(self, rid, sid, reviewer, tutor, rating, comment, minutes=0):
        self.db.add(models.Review(id=rid, reviewer_id=reviewer, reviewee_id=tutor, request_id=sid, session_id=sid,
                                  rating=rating, comment=comment, created_at=T0 + dt.timedelta(minutes=minutes)))

    def _weekly(self, user, weeks_ago, score, counted=True):
        self.db.add(models.WeeklyAttempt(user_id=user, skill_id=1, score=score, week_start=monday(weeks_ago),
                                         counted=counted, taken_at=T0))

    # --- trusted ratings -------------------------------------------------
    def test_one_vote_per_reviewer_and_spam_removed(self):
        self._session(1, 1, 3)
        self._review(1, 1, 3, 1, 5, "Very clear explanations")
        self._review(2, 1, 3, 1, 5, "Very clear explanations", minutes=1)   # duplicate text
        self._review(3, 1, 4, 1, 1, "buy cheap stuff at www.spam.com")       # link
        self._review(4, 1, 5, 1, 4, "Patient and helpful")
        self.db.commit()
        revs = F.teaching_reviews(self.db, [1])[1]
        flags = F.rule_flags(revs)
        self.assertEqual(set(flags), {2, 3})
        r = F.trusted_rating(revs, flags)
        self.assertEqual(r["count"], 2)                 # reviewers 3 and 5
        self.assertEqual(r["average"], 4.5)
        self.assertEqual(r["bayes"], round((2 * 4.5 + 5 * 3.5) / 7, 2))

    def test_flood_of_reviews_from_one_person_counts_once(self):
        self._session(1, 1, 3)
        for i in range(6):
            self._review(10 + i, 1, 3, 1, 5, f"great session number {i}", minutes=i)
        self.db.commit()
        revs = F.teaching_reviews(self.db, [1])[1]
        r = F.trusted_rating(revs, F.rule_flags(revs))
        self.assertEqual(r["count"], 1)

    # --- knowledge -------------------------------------------------------
    def test_knowledge_uses_counted_weekly_scores_only(self):
        self._weekly(2, 3, 60)
        self._weekly(2, 2, 70)
        self._weekly(2, 2, 100, counted=False)       # a retry in the same week: ignored
        self._weekly(2, 1, 80)
        self.db.commit()
        board = F.build_fame(self.db, today=TODAY)
        bala = next(c for c in board["most_knowledgeable"] if c["user_id"] == 2)
        self.assertEqual(bala["knowledge_score"], 70.0)          # mean of 60, 70, 80
        asha = next(c for c in board["most_knowledgeable"] if c["user_id"] == 1)
        self.assertEqual(asha["knowledge_score"], 92.0)          # no weekly history -> latest score
        self.assertEqual(board["most_knowledgeable"][0]["user_id"], 1)

    def test_rising_stars_need_two_counted_weeks(self):
        self._weekly(3, 4, 40)
        self._weekly(3, 0, 75)
        self._weekly(2, 1, 90)
        self.db.commit()
        board = F.build_fame(self.db, today=TODAY)
        self.assertEqual([c["user_id"] for c in board["rising_stars"]], [3])
        self.assertEqual(board["rising_stars"][0]["rising_gain"], 35.0)

    # --- top teachers ----------------------------------------------------
    def test_top_teachers_only_people_who_taught_and_activity_is_capped(self):
        for sid in range(1, 16):                        # Bala: 15 sessions
            self._session(sid, 2, 3)
        self._session(20, 1, 4)                         # Asha: 1 session, great review
        self._review(1, 20, 4, 1, 5, "Explains concepts clearly and patiently")
        self.db.commit()
        board = F.build_fame(self.db, today=TODAY)
        ids = [c["user_id"] for c in board["top_teachers"]]
        self.assertEqual(set(ids), {1, 2})              # Chitra never taught
        bala = next(c for c in board["top_teachers"] if c["user_id"] == 2)
        self.assertEqual(bala["activity_score"], 100)   # 15 sessions, capped
        self.assertEqual(bala["students_taught"], 1)
        asha = next(c for c in board["top_teachers"] if c["user_id"] == 1)
        self.assertIsNotNone(asha["insight"])
        self.assertIn("Clear explanations", asha["insight"]["strengths"])

    # --- AI insight caching ----------------------------------------------
    def test_ai_insight_is_cached_until_reviews_change(self):
        self._session(1, 1, 3)
        self._review(1, 1, 3, 1, 5, "Very clear and patient")
        self.db.commit()
        ai = {"summary": "Clear and patient.", "strengths": ["Clarity"], "improvements": [],
              "qualities": {q: None for q in ("clarity", "knowledge", "communication", "helpfulness", "patience")},
              "flagged": []}
        with mock.patch("backend.app.services.question_generator.analyze_teacher_reviews", return_value=dict(ai)) as call:
            first = F.get_insight(self.db, 1, use_ai=True)
            again = F.get_insight(self.db, 1, use_ai=True)
            self.assertEqual(call.call_count, 1)
            self.assertEqual(first["source"], "ai")
            self.assertEqual(again["summary"], "Clear and patient.")
            self._review(2, 1, 4, 1, 4, "Helpful examples")
            self.db.commit()
            F.get_insight(self.db, 1, use_ai=True)
            self.assertEqual(call.call_count, 2)

    def test_ai_unavailable_falls_back_to_keywords(self):
        self._session(1, 1, 3)
        self._review(1, 1, 3, 1, 2, "Too fast and confusing")
        self._review(2, 1, 4, 1, 5, "Clear explanation of loops", minutes=1)
        self.db.commit()
        with mock.patch("backend.app.services.question_generator.analyze_teacher_reviews", return_value=None):
            ins = F.get_insight(self.db, 1, use_ai=True)
        self.assertEqual(ins["source"], "keywords")
        self.assertIn("Slow down the pace", ins["improvements"])

    # --- weekly badges -----------------------------------------------------
    def test_weekly_streaks_and_badges(self):
        for w, s in [(5, 40), (4, 45), (3, 60), (1, 62), (0, 90)]:
            self._weekly(3, w, s)
        self.db.commit()
        st = F.weekly_status(F.weekly_history(self.db, [3])[3], today=TODAY)
        self.assertEqual(st["best_streak"], 3)
        self.assertEqual(st["current_streak"], 2)
        self.assertTrue(st["this_week_done"])
        ids = {b["id"] for b in st["badges"]}
        self.assertEqual(ids, {"weekly_first", "streak_3", "improver", "big_leap"})

    def test_no_history_no_badges(self):
        st = F.weekly_status({}, today=TODAY)
        self.assertEqual((st["current_streak"], st["weeks_taken"], st["badges"]), (0, 0, []))


if __name__ == "__main__":
    unittest.main()
