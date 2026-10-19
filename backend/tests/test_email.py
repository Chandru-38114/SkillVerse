"""Brevo email for one-time codes: sent through the API when configured,
logged in development, and the code is never shown on screen once email is real."""
import os
import unittest
from unittest.mock import MagicMock, patch

import requests

from backend.app import email_service as E
from backend.app.routers import auth as A


class EmailTest(unittest.TestCase):
    def test_development_logs_only(self):
        with patch.dict(os.environ, {"BREVO_API_KEY": "", "EMAIL_FROM": ""}), patch("requests.post") as post:
            self.assertTrue(E.send_otp_email("a@x.com", "123456", "password_reset"))
            post.assert_not_called()

    def test_sends_through_brevo(self):
        env = {"BREVO_API_KEY": "k", "EMAIL_FROM": "team@gmail.com"}
        with patch.dict(os.environ, env), patch("requests.post", return_value=MagicMock(status_code=201)) as post:
            self.assertTrue(E.send_otp_email("user@x.com", "654321", "password_reset"))
            body = post.call_args.kwargs["json"]
            self.assertEqual(body["to"], [{"email": "user@x.com"}])
            self.assertEqual(body["sender"]["email"], "team@gmail.com")
            self.assertIn("654321", body["textContent"])
            self.assertEqual(post.call_args.kwargs["headers"]["api-key"], "k")

    def test_failure_raises(self):
        env = {"BREVO_API_KEY": "k", "EMAIL_FROM": "team@gmail.com"}
        with patch.dict(os.environ, env):
            with patch("requests.post", return_value=MagicMock(status_code=401, text="unauthorized")):
                with self.assertRaises(E.EmailError):
                    E.send_otp_email("user@x.com", "1", "password_reset")
            with patch("requests.post", side_effect=requests.ConnectionError()):
                with self.assertRaises(E.EmailError):
                    E.send_otp_email("user@x.com", "1", "password_reset")

    def test_code_never_on_screen_with_real_email(self):
        with patch.dict(os.environ, {"BREVO_API_KEY": "k", "EMAIL_FROM": "t@gmail.com", "DEV_OTP_MODE": "true"}):
            self.assertFalse(A._dev_otp_enabled())
        with patch.dict(os.environ, {"BREVO_API_KEY": "", "EMAIL_FROM": "", "DEV_OTP_MODE": "true"}):
            self.assertTrue(A._dev_otp_enabled())


if __name__ == "__main__":
    unittest.main()
