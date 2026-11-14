"""Offline unit tests for deploy/smoke_test.py (the network is mocked).

Run (repository root):  python3 -m unittest discover -s deploy/tests -p 'test_smoke.py'
CI runs it in the test-and-docker job.
"""
from email.message import Message
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('smoke', Path(__file__).parents[1] / 'smoke_test.py')
smoke = importlib.util.module_from_spec(spec)
spec.loader.exec_module(smoke)

BASE = 'https://nutgpuhub-123456789012.asia-southeast1.run.app'


def headers(*cookies):
    message = Message()
    for cookie in cookies:
        message['Set-Cookie'] = cookie
    return message


def error(code):
    return ('{"error":{"code":"%s","message":"x"}}' % code).encode()


class SmokeTests(unittest.TestCase):
    def setUp(self):
        self.calls = []
        self.machines = b'[{"machineId":1,"machineCode":"GPU-01"}]'

    def live(self, base, path, data=None, origin=None, cookie=None):
        """A deployment where APP_ORIGIN equals BASE and the seed has run."""
        self.calls.append(path)
        if path == '/api/health':
            return 200, headers(), b'{"status":"ok"}'
        if path == '/api/ready':
            return 200, headers(), b'{"status":"ready","db":"connected"}'
        if path == '/':
            return 200, headers(), b'<!doctype html><html></html>'
        if path == smoke.LOGIN:
            if origin != BASE:
                return 403, headers(), error('INVALID_ORIGIN')
            if not data:
                return 400, headers(), error('INVALID_CREDENTIALS_INPUT')
            return 200, headers('nutgpuhub_session=test-session; Path=/; HttpOnly; Secure'), b'{}'
        if path == '/api/v1/auth/me':
            return 200, headers(), b'{"id":3,"username":"operator-a","role":"operator"}'
        if path == '/api/v1/machines':
            return 200, headers(), self.machines
        if path == '/api/v1/auth/logout':
            return 204, headers(), b''
        raise AssertionError('Unexpected path ' + path)

    @patch.dict('os.environ', {}, clear=True)
    def test_public_checks_pass_and_skip_optional_sign_in(self):
        with patch.object(smoke, 'request', side_effect=self.live):
            smoke.check(BASE)
        self.assertEqual(self.calls, ['/api/health', '/api/ready', '/', smoke.LOGIN, smoke.LOGIN])

    @patch.dict('os.environ', {}, clear=True)
    def test_database_not_ready_fails_even_when_http_answers(self):
        def unavailable(base, path, **kwargs):
            if path == '/api/ready':
                return 503, headers(), b'{"status":"not_ready","db":"unavailable"}'
            return self.live(base, path, **kwargs)
        with patch.object(smoke, 'request', side_effect=unavailable), patch.object(smoke.time, 'sleep'):
            with self.assertRaisesRegex(RuntimeError, '/api/ready'):
                smoke.check(BASE)

    @patch.dict('os.environ', {}, clear=True)
    def test_wrong_app_origin_fails(self):
        def wrong_origin(base, path, origin=None, **kwargs):
            if path == smoke.LOGIN:
                return 403, headers(), error('INVALID_ORIGIN')
            return self.live(base, path, origin=origin, **kwargs)
        with patch.object(smoke, 'request', side_effect=wrong_origin), patch.object(smoke.time, 'sleep'):
            with self.assertRaisesRegex(RuntimeError, 'APP_ORIGIN'):
                smoke.check(BASE)

    @patch.dict('os.environ', {'SMOKE_USERNAME': 'operator-a', 'SMOKE_PASSWORD': 'test-only-password'}, clear=True)
    def test_operator_sign_in_checks_machines_and_signs_out(self):
        with patch.object(smoke, 'request', side_effect=self.live):
            smoke.check(BASE)
        self.assertEqual(self.calls[-3:], ['/api/v1/auth/me', '/api/v1/machines', '/api/v1/auth/logout'])

    @patch.dict('os.environ', {'SMOKE_USERNAME': 'operator-a', 'SMOKE_PASSWORD': 'test-only-password'}, clear=True)
    def test_session_is_signed_out_even_if_a_check_fails(self):
        self.machines = b'[]'
        with patch.object(smoke, 'request', side_effect=self.live):
            with self.assertRaisesRegex(RuntimeError, 'Sign-in smoke'):
                smoke.check(BASE)
        self.assertEqual(self.calls[-1], '/api/v1/auth/logout')

    @patch.dict('os.environ', {'SMOKE_USERNAME': 'operator-a'}, clear=True)
    def test_only_one_credential_is_rejected(self):
        with patch.object(smoke, 'request', side_effect=self.live):
            with self.assertRaisesRegex(RuntimeError, 'SMOKE_USERNAME and SMOKE_PASSWORD'):
                smoke.check(BASE)


if __name__ == '__main__':
    unittest.main()
