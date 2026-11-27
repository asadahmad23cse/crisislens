"""Small protocol checks: ambiguity, privacy normalization, and regression gate."""
import unittest
from evaluate_humaid import POSITIVE, NEGATIVE, AMBIGUOUS, metrics, normalize
from check_regression import differences


class ProtocolTests(unittest.TestCase):
    def test_class_sets_are_disjoint(self):
        self.assertFalse(POSITIVE & NEGATIVE)
        self.assertFalse(POSITIVE & AMBIGUOUS)
        self.assertFalse(NEGATIVE & AMBIGUOUS)
        self.assertIn("injured_or_dead_people", AMBIGUOUS)
        self.assertIn("rescue_volunteering_or_donation_effort", AMBIGUOUS)

    def test_matching_ignores_handles_urls_and_whitespace(self):
        self.assertEqual(normalize("@alice Need HELP https://a.example  now"),
                         normalize("@bob need help https://b.example\nnow"))
        self.assertNotEqual(normalize("need water"), normalize("have water"))

    def test_metrics_include_denominators_and_errors(self):
        score = metrics([1, 0, 1, 0], [1, 1, 0, 0])
        self.assertEqual((score["tp"], score["fp"], score["fn"]), (1, 1, 1))
        self.assertEqual(score["f1"], 0.5)
        self.assertEqual(score["n"], 4)
        self.assertEqual(score["positives"], 2)

    def test_regression_detects_nonheadline_change(self):
        before = {"headline": 0.947, "classification": {"recall": 0.9}}
        after = {"headline": 0.947, "classification": {"recall": 0.8}}
        self.assertEqual(differences(before, after)[0]["path"], "classification.recall")
        self.assertEqual(differences(before, before), [])


if __name__ == "__main__":
    unittest.main()
