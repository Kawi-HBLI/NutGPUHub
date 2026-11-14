"""Public checks of a deployed NutGPUHub. Passwords and session tokens are never printed.

Usage:  python3 deploy/smoke_test.py SERVICE_URL
Exits non-zero (failing the deploy workflow) if a check fails. Each public check is
retried up to 5 times, 3 seconds apart, because a Cloud Run instance may be starting.

Public checks (no account needed, nothing is written to the database)
  1. GET  /api/health                      -> 200 {"status": "ok"}
  2. GET  /api/ready                       -> 200 {"db": "connected"}   (the database answers)
  3. GET  /                                -> the built React page
  4. POST /api/v1/auth/login, other Origin -> 403 INVALID_ORIGIN       (origin rule enforced)
  5. POST /api/v1/auth/login, Origin = SERVICE_URL, empty body
                                           -> 400 INVALID_CREDENTIALS_INPUT
     This proves APP_ORIGIN on Cloud Run equals SERVICE_URL. If it does not, every
     sign-in in the browser returns 403.

Optional sign-in check, only when SMOKE_USERNAME and SMOKE_PASSWORD are both set:
sign in, GET /api/v1/auth/me, and for an operator GET /api/v1/machines (the seed
gave every demo operator one machine). The session is always signed out afterwards.

Adapted from the Lab 5 starter kit: NutGPUHub signs in with a username, keeps the
session in the nutgpuhub_session cookie (not a bearer token), requires an Origin
header on every POST, and has no public list such as /api/categories.
Standard library only. Offline tests: deploy/tests/test_smoke.py
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request

LOGIN = '/api/v1/auth/login'
SESSION_COOKIE = 'nutgpuhub_session'
OTHER_ORIGIN = 'https://smoke-test.invalid'


def request(base, path, data=None, origin=None, cookie=None):
    """Returns (status, headers, body). HTTP error statuses are returned, not raised."""
    headers = {}
    if data is not None:
        headers['Content-Type'] = 'application/json'
    if origin:
        headers['Origin'] = origin
    if cookie:
        headers['Cookie'] = SESSION_COOKIE + '=' + cookie
    req = urllib.request.Request(base + path, headers=headers,
        data=json.dumps(data).encode() if data is not None else None)
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return response.status, response.headers, response.read()
    except urllib.error.HTTPError as error:
        return error.code, error.headers, error.read()


def error_code(body):
    return json.loads(body)['error']['code']


def public_checks(base):
    return (
        ('GET /api/health', {'path': '/api/health'},
         lambda status, body: status == 200 and json.loads(body).get('status') == 'ok'),
        ('GET /api/ready', {'path': '/api/ready'},
         lambda status, body: status == 200 and json.loads(body).get('db') == 'connected'),
        ('GET /', {'path': '/'},
         lambda status, body: status == 200 and b'<html' in body.lower()),
        ('POST from another origin is rejected', {'path': LOGIN, 'data': {}, 'origin': OTHER_ORIGIN},
         lambda status, body: status == 403 and error_code(body) == 'INVALID_ORIGIN'),
        ('POST from SERVICE_URL is accepted (APP_ORIGIN matches)', {'path': LOGIN, 'data': {}, 'origin': base},
         lambda status, body: status == 400 and error_code(body) == 'INVALID_CREDENTIALS_INPUT'),
    )


def session_token(headers):
    for value in headers.get_all('Set-Cookie') or []:
        if value.startswith(SESSION_COOKIE + '='):
            return value.split(';', 1)[0].split('=', 1)[1]
    raise ValueError('No session cookie')


def check(base):
    for name, call, predicate in public_checks(base):
        for attempt in range(5):
            try:
                status, _, body = request(base, **call)
                if not predicate(status, body):
                    raise ValueError('Unexpected response')
                break
            except (urllib.error.URLError, TimeoutError, ValueError, KeyError, TypeError):
                if attempt == 4:
                    raise RuntimeError('Smoke check failed: ' + name) from None
                time.sleep(3)
        print('PASS ' + name)

    username, password = os.getenv('SMOKE_USERNAME'), os.getenv('SMOKE_PASSWORD')
    if bool(username) != bool(password):
        raise RuntimeError('Set both SMOKE_USERNAME and SMOKE_PASSWORD, or neither.')
    if not username:
        print('SKIP sign-in: optional smoke credentials not configured')
        return
    token = None
    try:
        status, headers, _ = request(base, LOGIN, data={'username': username, 'password': password}, origin=base)
        if status != 200:
            raise ValueError('Sign-in failed')
        token = session_token(headers)
        status, _, body = request(base, '/api/v1/auth/me', cookie=token)
        account = json.loads(body)
        if status != 200 or account.get('username') != username:
            raise ValueError('Unexpected account')
        if account.get('role') == 'operator':
            status, _, body = request(base, '/api/v1/machines', cookie=token)
            if status != 200 or not json.loads(body):
                raise ValueError('Operator has no machine')
        print('PASS sign-in and /api/v1/auth/me as ' + account.get('role', 'unknown'))
    except (urllib.error.URLError, TimeoutError, ValueError, KeyError, TypeError):
        raise RuntimeError('Sign-in smoke check failed') from None
    finally:
        # Always end the session, even when a check above failed.
        if token:
            request(base, '/api/v1/auth/logout', data={}, origin=base, cookie=token)
            print('PASS sign-out')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit('Usage: python3 deploy/smoke_test.py SERVICE_URL')
    check(sys.argv[1].rstrip('/'))
