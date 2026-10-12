import unittest
from backend.app.utils.levels import score_to_level, is_eligible_to_teach, SCORE_THRESHOLDS
from backend.app import models


class TestLevelsAndEligibility(unittest.TestCase):
    def test_threshold_boundaries(self):
        # no score -> 0
        self.assertEqual(score_to_level(None), 0)
        self.assertEqual(score_to_level(""), 0)
        self.assertEqual(score_to_level("invalid"), 0)

        # score < 40 -> 1
        self.assertEqual(score_to_level(0), 1)
        self.assertEqual(score_to_level(39), 1)
        self.assertEqual(score_to_level(39.9), 1)

        # 40 to 59 -> 2
        self.assertEqual(score_to_level(40), 2)
        self.assertEqual(score_to_level(50), 2)
        self.assertEqual(score_to_level(59), 2)

        # 60 to 79 -> 3
        self.assertEqual(score_to_level(60), 3)
        self.assertEqual(score_to_level(70), 3)
        self.assertEqual(score_to_level(79), 3)

        # 80 and above -> 4
        self.assertEqual(score_to_level(80), 4)
        self.assertEqual(score_to_level(95.5), 4)
        self.assertEqual(score_to_level(100), 4)

    def test_provisional_constants(self):
        self.assertIn("level_2_min", SCORE_THRESHOLDS)
        self.assertEqual(SCORE_THRESHOLDS["level_2_min"], 40)
        self.assertEqual(SCORE_THRESHOLDS["level_3_min"], 60)
        self.assertEqual(SCORE_THRESHOLDS["level_4_min"], 80)

    def test_eligibility_rules(self):
        # levels 4 vs 2 ok
        self.assertTrue(is_eligible_to_teach(4, 2))

        # 3 vs 2 not ok (diff is 1 < 2)
        self.assertFalse(is_eligible_to_teach(3, 2))

        # 2 vs 0 ok (teacher is 2 >= 2 and 2 >= 0 + 2)
        self.assertTrue(is_eligible_to_teach(2, 0))

        # 1 vs 0 not ok because teacher is below 2
        self.assertFalse(is_eligible_to_teach(1, 0))

        # None / null levels handled gracefully as 0
        self.assertFalse(is_eligible_to_teach(None, 0))
        self.assertFalse(is_eligible_to_teach(1, None))
        self.assertTrue(is_eligible_to_teach(2, None))

    def test_old_rows_without_level_num(self):
        # A UserSkill row created without specifying level_num has default 0 or None
        us = models.UserSkill(user_id=1, skill_id=1, role="teaching")
        level_val = getattr(us, 'level_num', None)
        # default in column is 0, or before db commit it's None/0
        effective_level = level_val if level_val is not None else 0
        self.assertEqual(effective_level, 0)
        # Teacher with 0 is not eligible to teach anyone
        self.assertFalse(is_eligible_to_teach(effective_level, 0))


if __name__ == '__main__':
    unittest.main()
