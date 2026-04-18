from __future__ import annotations

import json
import uuid
import urllib.error
import urllib.request

BASE_URL = "http://127.0.0.1:8010"


def post_json(path: str, payload: dict[str, str]) -> tuple[int, str]:
    request = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return response.status, response.read().decode("utf-8")
    except urllib.error.HTTPError as error:
        return error.code, error.read().decode("utf-8")


def main() -> None:
    email = f"auth-{uuid.uuid4().hex[:8]}@example.com"
    password = "StrongPass123!"
    full_name = "Auth Demo User"

    signup_status, signup_body = post_json(
        "/auth/signup",
        {
            "full_name": full_name,
            "email": email,
            "password": password,
        },
    )
    print("SIGNUP:", signup_status, signup_body)
    if signup_status >= 400:
        raise SystemExit(signup_body)

    duplicate_status, duplicate_body = post_json(
        "/auth/signup",
        {
            "full_name": full_name,
            "email": email,
            "password": password,
        },
    )
    print("DUPLICATE_SIGNUP:", duplicate_status, duplicate_body)

    login_status, login_body = post_json(
        "/auth/login",
        {"email": email, "password": password},
    )
    print("LOGIN:", login_status, login_body)
    if login_status >= 400:
        raise SystemExit(login_body)

    wrong_status, wrong_body = post_json(
        "/auth/login",
        {"email": email, "password": "wrong-password"},
    )
    print("WRONG_LOGIN:", wrong_status, wrong_body)


if __name__ == "__main__":
    main()
