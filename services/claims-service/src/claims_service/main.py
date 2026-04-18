from __future__ import annotations

import base64
import binascii
import io
import hashlib
import json
import math
import os
import hmac
import sqlite3
import re
import threading
import uuid
from datetime import datetime, timedelta, timezone
from contextlib import closing
from difflib import SequenceMatcher
from pathlib import Path
from statistics import mean
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

try:
    from PIL import ExifTags, Image

    _PIL_AVAILABLE = True
except Exception:
    ExifTags = None
    Image = None
    _PIL_AVAILABLE = False

ROOT_DIR = Path(__file__).resolve().parents[4]
SEED_DIR = ROOT_DIR / "data" / "claims-assurance" / "seed"
SCHEMA_PATH = (
    ROOT_DIR / "data-contracts" / "sql-schema" / "claims-assurance.sql"
)
SQLITE_PATH = Path(
    os.getenv(
        "CLAIMS_SQLITE_PATH",
        str(
            ROOT_DIR
            / "data"
            / "claims-assurance"
            / "claims_assurance.sqlite3"
        ),
    )
)

PATIENT_COLUMNS = [
    "patient_id",
    "full_name",
    "date_of_birth",
    "gender",
    "government_id",
    "scheme_id",
    "scheme_member_id",
    "phone_number",
    "address",
    "city",
    "state",
    "eligibility_status",
    "metadata",
    "created_at",
    "updated_at",
]

HOSPITAL_COLUMNS = [
    "hospital_id",
    "name",
    "scheme_partners",
    "city",
    "state",
    "empanelment_status",
    "specialties",
    "metadata",
    "created_at",
    "updated_at",
]

CLAIM_COLUMNS = [
    "claim_id",
    "patient_id",
    "hospital_id",
    "scheme_id",
    "diagnosis",
    "procedure",
    "claim_amount",
    "admission_date",
    "discharge_date",
    "document_text",
    "supporting_documents",
    "metadata",
    "status",
    "risk_score",
    "risk_band",
    "fraud_flags",
    "patient_name",
    "hospital_name",
    "created_at",
    "updated_at",
]

USER_COLUMNS = [
    "user_id",
    "full_name",
    "email",
    "password_salt",
    "password_hash",
    "created_at",
    "updated_at",
]

CLAIM_FEATURE_LABELS = [
    "hospital_avg_claim_cost",
    "patient_claim_frequency_30d",
    "cost_deviation_ratio",
    "days_since_last_claim",
    "patient_hospital_distance_km",
    "nearest_hospital_distance_km",
    "claims_per_week",
    "overlap_flag",
]

_schema_lock = threading.Lock()
_store_ready = False

BENEFICIARY_APPROVE_THRESHOLD = 0.82
BENEFICIARY_REVIEW_THRESHOLD = 0.62
HIGH_COST_THRESHOLD = float(os.getenv("CLAIMS_HIGH_COST_THRESHOLD", "20000"))
FEATURE_LOOKBACK_DAYS = int(os.getenv("CLAIMS_FEATURE_LOOKBACK_DAYS", "30"))
METADATA_DEVICE_REUSE_PATIENT_THRESHOLD = int(
    os.getenv("CLAIMS_METADATA_DEVICE_REUSE_PATIENT_THRESHOLD", "5")
)
METADATA_GPS_MISMATCH_DISTANCE_KM = float(
    os.getenv("CLAIMS_METADATA_GPS_MISMATCH_DISTANCE_KM", "2.5")
)

GPS_INFO_TAG_ID = 34853
IMAGE_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".heic",
    ".heif",
    ".webp",
    ".tif",
    ".tiff",
}
EXIF_TIMESTAMP_FORMATS = (
    "%Y:%m:%d %H:%M:%S",
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%dT%H:%M:%S%z",
)

CITY_COORDINATES: dict[str, tuple[float, float]] = {
    "bengaluru,karnataka": (12.9716, 77.5946),
    "mysuru,karnataka": (12.2958, 76.6394),
    "chennai,tamil nadu": (13.0827, 80.2707),
    "delhi,delhi": (28.6139, 77.2090),
}


class PatientCreateRequest(BaseModel):
    patient_id: str | None = None
    full_name: str = Field(min_length=1)
    date_of_birth: str = Field(min_length=1)
    gender: str = Field(min_length=1)
    government_id: str = Field(min_length=1)
    scheme_id: str = Field(default="AB-ArK")
    scheme_member_id: str = Field(min_length=1)
    phone_number: str = Field(min_length=7)
    address: str = Field(min_length=1)
    city: str = Field(min_length=1)
    state: str = Field(min_length=1)
    eligibility_status: str = Field(default="eligible")
    metadata: dict[str, Any] = Field(default_factory=dict)


class PatientResponse(PatientCreateRequest):
    created_at: str
    updated_at: str


class ClaimSubmitRequest(BaseModel):
    claim_id: str | None = None
    patient_id: str = Field(min_length=1)
    hospital_id: str = Field(min_length=1)
    scheme_id: str = Field(default="AB-ArK")
    diagnosis: str = Field(min_length=1)
    procedure: str = Field(min_length=1)
    claim_amount: float = Field(gt=0)
    admission_date: str = Field(min_length=1)
    discharge_date: str | None = None
    document_text: str = Field(min_length=1)
    supporting_documents: list[str | dict[str, Any]] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class ClaimResponse(ClaimSubmitRequest):
    status: str
    risk_score: float
    risk_band: str
    fraud_flags: list[str]
    hospital_name: str | None = None
    patient_name: str | None = None
    feature_labels: list[str] | None = None
    feature_vector: list[float] | None = None
    feature_summary: dict[str, float] | None = None
    created_at: str
    updated_at: str


class HospitalResponse(BaseModel):
    hospital_id: str
    name: str
    scheme_partners: list[str]
    city: str
    state: str
    empanelment_status: str
    specialties: list[str]
    metadata: dict[str, Any] = Field(default_factory=dict)


class BeneficiaryVerifyRequest(BaseModel):
    patient_id: str | None = None
    full_name: str = Field(min_length=1)
    date_of_birth: str = Field(min_length=1)
    address: str = Field(min_length=1)
    government_id: str | None = None
    scheme_member_id: str | None = None
    scheme_id: str | None = None
    city: str | None = None
    state: str | None = None


class BeneficiaryVerifyResponse(BaseModel):
    patient_id: str | None = None
    decision: str
    confidence_score: float
    matched_patient_id: str | None = None
    matched_patient_name: str | None = None
    matched_scheme_id: str | None = None
    match_breakdown: dict[str, float]
    signals: list[str]
    reasons: list[str]


class ClaimFeatureResponse(BaseModel):
    claim_id: str
    patient_id: str
    hospital_id: str
    feature_labels: list[str]
    feature_vector: list[float]
    feature_summary: dict[str, float]
    claim_velocity: str
    overlap_flag: bool
    spatiotemporal_flags: list[str]
    metadata_flag: bool = False
    metadata_reason: str | None = None
    metadata_signals: list[str] = Field(default_factory=list)
    metadata_summary: dict[str, Any] = Field(default_factory=dict)
    generated_at: str


class AuthSignupRequest(BaseModel):
    full_name: str = Field(min_length=1)
    email: str = Field(min_length=3)
    password: str = Field(min_length=8)


class AuthLoginRequest(BaseModel):
    email: str = Field(min_length=3)
    password: str = Field(min_length=1)


class AuthUserResponse(BaseModel):
    user_id: str
    full_name: str
    email: str
    created_at: str
    updated_at: str


class AuthResponse(BaseModel):
    verified: bool
    message: str
    user: AuthUserResponse | None = None


app = FastAPI(title="Claims Assurance Service", version="0.1.0")


DEFAULT_SCHEMA_SQL = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS patients (
    patient_id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    date_of_birth TEXT NOT NULL,
    gender TEXT NOT NULL,
    government_id TEXT NOT NULL,
    scheme_id TEXT NOT NULL,
    scheme_member_id TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    eligibility_status TEXT NOT NULL DEFAULT 'eligible',
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hospitals (
    hospital_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    scheme_partners TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    empanelment_status TEXT NOT NULL,
    specialties TEXT NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS claims (
    claim_id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    hospital_id TEXT NOT NULL,
    scheme_id TEXT NOT NULL,
    diagnosis TEXT NOT NULL,
    procedure TEXT NOT NULL,
    claim_amount REAL NOT NULL,
    admission_date TEXT NOT NULL,
    discharge_date TEXT,
    document_text TEXT NOT NULL,
    supporting_documents TEXT NOT NULL DEFAULT '[]',
    metadata TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL,
    risk_score REAL NOT NULL,
    risk_band TEXT NOT NULL,
    fraud_flags TEXT NOT NULL DEFAULT '[]',
    patient_name TEXT,
    hospital_name TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
    FOREIGN KEY (hospital_id) REFERENCES hospitals(hospital_id)
);

CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_claims_patient_created_at
    ON claims(patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_claims_hospital_created_at
    ON claims(hospital_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email
    ON users(email);
""".strip()


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _read_seed(file_name: str) -> list[dict[str, Any]]:
    seed_path = SEED_DIR / file_name
    if not seed_path.exists():
        return []
    return json.loads(seed_path.read_text(encoding="utf-8"))


def _json_text(value: Any) -> str:
    return json.dumps(value if value is not None else {}, ensure_ascii=False)


def _load_json(value: str | None, default: Any) -> Any:
    if value is None or value == "":
        return default
    return json.loads(value)


def _normalize_text(value: str | None) -> str:
    if not value:
        return ""
    cleaned = value.strip().lower()
    cleaned = re.sub(r"[^a-z0-9]+", " ", cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()


def _string_similarity(left: str | None, right: str | None) -> float:
    left_norm = _normalize_text(left)
    right_norm = _normalize_text(right)
    if not left_norm or not right_norm:
        return 0.0
    return SequenceMatcher(None, left_norm, right_norm).ratio()


def _exact_match(left: str | None, right: str | None) -> float:
    left_norm = _normalize_text(left)
    right_norm = _normalize_text(right)
    if not left_norm or not right_norm:
        return 0.0
    return 1.0 if left_norm == right_norm else 0.0


def _normalize_email(value: str | None) -> str:
    return (value or "").strip().lower()


def _generate_password_salt() -> bytes:
    return os.urandom(16)


def _hash_password(password: str, salt: bytes) -> str:
    derived = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        200_000,
    )
    return derived.hex()


def _password_salt_hex(salt: bytes) -> str:
    return salt.hex()


def _password_matches(password: str, salt_hex: str, stored_hash: str) -> bool:
    try:
        salt = bytes.fromhex(salt_hex)
    except ValueError:
        return False
    computed_hash = _hash_password(password, salt)
    return hmac.compare_digest(computed_hash, stored_hash)


def _connect() -> sqlite3.Connection:
    SQLITE_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(SQLITE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def _schema_sql() -> str:
    if SCHEMA_PATH.exists():
        return SCHEMA_PATH.read_text(encoding="utf-8")
    return DEFAULT_SCHEMA_SQL


def _seed_table(
    conn: sqlite3.Connection,
    table_name: str,
    file_name: str,
    columns: list[str],
    unique_key: str,
) -> None:
    count = conn.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
    if count > 0:
        return

    rows = _read_seed(file_name)
    if not rows:
        return

    now = _utc_now()
    payloads: list[tuple[Any, ...]] = []
    for row in rows:
        row.setdefault(unique_key, str(uuid.uuid4()))
        row.setdefault("created_at", now)
        row.setdefault("updated_at", now)
        payloads.append(_row_values(table_name, row, columns))

    placeholders = ", ".join(["?"] * len(columns))
    column_list = ", ".join(columns)
    conn.executemany(
        f"INSERT OR REPLACE INTO {table_name} ({column_list}) "
        f"VALUES ({placeholders})",
        payloads,
    )


def _row_values(
    table_name: str,
    row: dict[str, Any],
    columns: list[str],
) -> tuple[Any, ...]:
    values: list[Any] = []
    for column in columns:
        value = row.get(column)
        if table_name == "patients" and column == "metadata":
            value = _json_text(value)
        elif table_name == "hospitals" and column in {
            "scheme_partners",
            "specialties",
            "metadata",
        }:
            value = _json_text(value)
        elif table_name == "claims" and column in {
            "supporting_documents",
            "metadata",
            "fraud_flags",
        }:
            value = _json_text(value)
        elif table_name == "users" and column in {
            "password_salt",
            "password_hash",
        }:
            value = str(value)
        values.append(value)
    return tuple(values)


def _user_from_row(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return dict(row)


def _ensure_store() -> None:
    global _store_ready
    if _store_ready:
        return

    with _schema_lock:
        if _store_ready:
            return

        with _connect() as conn:
            conn.executescript(_schema_sql())
            _seed_table(
                conn,
                "patients",
                "patients.json",
                PATIENT_COLUMNS,
                "patient_id",
            )
            _seed_table(
                conn,
                "hospitals",
                "hospitals.json",
                HOSPITAL_COLUMNS,
                "hospital_id",
            )
            _seed_table(
                conn,
                "claims",
                "claims.json",
                CLAIM_COLUMNS,
                "claim_id",
            )
            conn.commit()

        _store_ready = True


def _get_store_or_error() -> sqlite3.Connection:
    try:
        _ensure_store()
        return _connect()
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"SQL store unavailable: {exc}",
        ) from exc


def _signup_user(
    database: sqlite3.Connection,
    payload: AuthSignupRequest,
) -> AuthUserResponse:
    email = _normalize_email(payload.email)
    if not email:
        raise HTTPException(status_code=422, detail="Email is required")

    existing = database.execute(
        "SELECT 1 FROM users WHERE email = ?",
        (email,),
    ).fetchone()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    user_id = f"USR-{uuid.uuid4().hex[:12].upper()}"
    now = _utc_now()
    salt = _generate_password_salt()
    record = {
        "user_id": user_id,
        "full_name": payload.full_name.strip(),
        "email": email,
        "password_salt": _password_salt_hex(salt),
        "password_hash": _hash_password(payload.password, salt),
        "created_at": now,
        "updated_at": now,
    }
    database.execute(
        """
        INSERT INTO users (
            user_id, full_name, email, password_salt, password_hash,
            created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        _row_values("users", record, USER_COLUMNS),
    )
    database.commit()
    return AuthUserResponse(**record)


def _login_user(
    database: sqlite3.Connection,
    payload: AuthLoginRequest,
) -> AuthUserResponse:
    email = _normalize_email(payload.email)
    if not email:
        raise HTTPException(status_code=422, detail="Email is required")

    row = database.execute(
        "SELECT * FROM users WHERE email = ?",
        (email,),
    ).fetchone()
    user = _user_from_row(row)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not _password_matches(
        payload.password,
        str(user.get("password_salt", "")),
        str(user.get("password_hash", "")),
    ):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return AuthUserResponse(
        user_id=str(user["user_id"]),
        full_name=str(user["full_name"]),
        email=str(user["email"]),
        created_at=str(user["created_at"]),
        updated_at=str(user["updated_at"]),
    )


def _patient_from_row(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None
    record = dict(row)
    record["metadata"] = _load_json(record.get("metadata"), {})
    return record


def _hospital_from_row(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None
    record = dict(row)
    record["scheme_partners"] = _load_json(record.get("scheme_partners"), [])
    record["specialties"] = _load_json(record.get("specialties"), [])
    record["metadata"] = _load_json(record.get("metadata"), {})
    return record


def _claim_from_row(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None
    record = dict(row)
    record["supporting_documents"] = _load_json(
        record.get("supporting_documents"),
        [],
    )
    record["metadata"] = _load_json(record.get("metadata"), {})
    record["fraud_flags"] = _load_json(record.get("fraud_flags"), [])

    feature_engineering = record["metadata"].get("feature_engineering")
    if isinstance(feature_engineering, dict):
        record["feature_labels"] = feature_engineering.get("feature_labels")
        record["feature_vector"] = feature_engineering.get("feature_vector")
        record["feature_summary"] = feature_engineering.get("feature_summary")
    return record


def _parse_iso_datetime(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _city_key(city: str | None, state: str | None) -> str:
    return f"{(city or '').strip().lower()},{(state or '').strip().lower()}"


def _coordinates_for(
    city: str | None,
    state: str | None,
) -> tuple[float, float] | None:
    return CITY_COORDINATES.get(_city_key(city, state))


def _haversine_km(
    origin: tuple[float, float],
    destination: tuple[float, float],
) -> float:
    lat1, lon1 = origin
    lat2, lon2 = destination
    radius_km = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return radius_km * c


def _safe_date(value: str | None) -> datetime.date | None:
    if not value:
        return None
    try:
        return _parse_claim_date(value).date()
    except ValueError:
        return None


def _metadata_summary_default() -> dict[str, Any]:
    return {
        "metadata_flag": False,
        "reason": None,
        "signals": [],
        "documents": [],
        "reused_device_patient_count": 0,
        "location_mismatch_distance_km": 0.0,
    }


def _document_label(document: str | dict[str, Any], index: int) -> str:
    if isinstance(document, dict):
        for key in ("filename", "name", "document_id", "id"):
            value = document.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    if isinstance(document, str) and document.strip():
        raw = document.strip()
        if raw.startswith("data:"):
            return f"document_{index + 1}"
        if len(raw) <= 120:
            return raw
    return f"document_{index + 1}"


def _document_is_image(document: str | dict[str, Any]) -> bool:
    if isinstance(document, str):
        raw = document.strip().lower()
        if raw.startswith("data:image/"):
            return True
        suffix = Path(raw).suffix.lower()
        return suffix in IMAGE_EXTENSIONS

    if isinstance(document, dict):
        mime_type = str(document.get("mime_type") or document.get("mimeType") or "").lower()
        if mime_type.startswith("image/"):
            return True
        data_url = document.get("data_url") or document.get("dataUrl")
        if isinstance(data_url, str) and data_url.strip().lower().startswith("data:image/"):
            return True
        filename = str(document.get("filename") or document.get("name") or "")
        if Path(filename).suffix.lower() in IMAGE_EXTENSIONS:
            return True
        for key in ("image_base64", "content_base64", "image", "content"):
            value = document.get(key)
            if isinstance(value, str) and len(value.strip()) >= 100:
                return True
    return False


def _extract_document_image_bytes(
    document: str | dict[str, Any],
) -> bytes | None:
    candidates: list[str] = []

    if isinstance(document, str):
        candidates.append(document.strip())
    elif isinstance(document, dict):
        for key in ("data_url", "dataUrl", "image_base64", "content_base64", "image", "content"):
            value = document.get(key)
            if isinstance(value, str) and value.strip():
                candidates.append(value.strip())

    for candidate in candidates:
        payload = candidate
        if candidate.startswith("data:"):
            _, _, payload = candidate.partition(",")
        cleaned = re.sub(r"\s+", "", payload)
        if len(cleaned) < 100:
            continue
        try:
            return base64.b64decode(cleaned, validate=False)
        except (ValueError, binascii.Error):
            continue
    return None


def _parse_exif_timestamp(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    raw = value.strip()
    if not raw:
        return None
    for fmt in EXIF_TIMESTAMP_FORMATS:
        try:
            parsed = datetime.strptime(raw, fmt)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed.isoformat()
        except ValueError:
            continue
    return raw


def _coerce_rational(value: Any) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    numerator = getattr(value, "numerator", None)
    denominator = getattr(value, "denominator", None)
    if numerator is not None and denominator not in {None, 0}:
        return float(numerator) / float(denominator)
    if isinstance(value, tuple) and len(value) == 2:
        num, den = value
        if isinstance(num, (int, float)) and isinstance(den, (int, float)) and den != 0:
            return float(num) / float(den)
    return None


def _gps_to_decimal(values: Any, ref: Any) -> float | None:
    if not isinstance(values, (list, tuple)) or len(values) != 3:
        return None
    degrees = _coerce_rational(values[0])
    minutes = _coerce_rational(values[1])
    seconds = _coerce_rational(values[2])
    if degrees is None or minutes is None or seconds is None:
        return None
    decimal = degrees + (minutes / 60.0) + (seconds / 3600.0)
    if str(ref).upper() in {"S", "W"}:
        decimal *= -1.0
    return decimal


def _gps_payload_to_coordinates(gps_info: Any) -> tuple[float, float] | None:
    if not isinstance(gps_info, dict):
        return None
    latitude = _gps_to_decimal(
        gps_info.get("GPSLatitude") or gps_info.get(2),
        gps_info.get("GPSLatitudeRef") or gps_info.get(1),
    )
    longitude = _gps_to_decimal(
        gps_info.get("GPSLongitude") or gps_info.get(4),
        gps_info.get("GPSLongitudeRef") or gps_info.get(3),
    )
    if latitude is None or longitude is None:
        return None
    return latitude, longitude


def _extract_explicit_document_metadata(
    document: str | dict[str, Any],
) -> tuple[str | None, tuple[float, float] | None, str | None]:
    if not isinstance(document, dict):
        return None, None, None

    device_id = document.get("device_id") or document.get("deviceId")
    if not isinstance(device_id, str) or not device_id.strip():
        device_id = None

    timestamp = document.get("timestamp")
    parsed_timestamp = _parse_exif_timestamp(timestamp)

    gps_value = document.get("gps")
    gps_coords: tuple[float, float] | None = None
    if isinstance(gps_value, dict):
        lat = gps_value.get("lat") or gps_value.get("latitude")
        lon = gps_value.get("lon") or gps_value.get("lng") or gps_value.get("longitude")
        if isinstance(lat, (int, float)) and isinstance(lon, (int, float)):
            gps_coords = (float(lat), float(lon))

    return device_id, gps_coords, parsed_timestamp


def _extract_document_exif(
    document: str | dict[str, Any],
    index: int,
) -> dict[str, Any] | None:
    if not _document_is_image(document):
        return None

    label = _document_label(document, index)
    explicit_device_id, explicit_gps, explicit_timestamp = _extract_explicit_document_metadata(document)
    image_bytes = _extract_document_image_bytes(document)

    exif_tags: dict[str, Any] = {}
    if image_bytes and _PIL_AVAILABLE and Image is not None:
        try:
            image = Image.open(io.BytesIO(image_bytes))
            exif = image.getexif()
            if exif:
                for tag_id, value in exif.items():
                    if tag_id == GPS_INFO_TAG_ID:
                        continue
                    tag_name = ExifTags.TAGS.get(tag_id, str(tag_id)) if ExifTags else str(tag_id)
                    exif_tags[tag_name] = value
                gps_ifd = exif.get_ifd(GPS_INFO_TAG_ID) if hasattr(exif, "get_ifd") else exif.get(GPS_INFO_TAG_ID)
                if isinstance(gps_ifd, dict):
                    exif_tags["GPSInfo"] = {
                        (
                            ExifTags.GPSTAGS.get(key, str(key))
                            if ExifTags
                            else str(key)
                        ): value
                        for key, value in gps_ifd.items()
                    }
        except Exception:
            exif_tags = {}

    serial_candidates = [
        explicit_device_id,
        exif_tags.get("CameraSerialNumber"),
        exif_tags.get("BodySerialNumber"),
        exif_tags.get("SerialNumber"),
        exif_tags.get("ImageUniqueID"),
        exif_tags.get("LensSerialNumber"),
    ]
    device_id = next(
        (
            str(candidate).strip()
            for candidate in serial_candidates
            if isinstance(candidate, str) and str(candidate).strip()
        ),
        None,
    )

    gps_coords = explicit_gps or _gps_payload_to_coordinates(exif_tags.get("GPSInfo"))
    timestamp = (
        explicit_timestamp
        or _parse_exif_timestamp(exif_tags.get("DateTimeOriginal"))
        or _parse_exif_timestamp(exif_tags.get("DateTimeDigitized"))
        or _parse_exif_timestamp(exif_tags.get("DateTime"))
    )

    make = exif_tags.get("Make")
    model = exif_tags.get("Model")

    return {
        "document": label,
        "timestamp": timestamp,
        "device_id": device_id,
        "gps": (
            {
                "lat": round(gps_coords[0], 6),
                "lon": round(gps_coords[1], 6),
            }
            if gps_coords
            else None
        ),
        "camera_make": str(make).strip() if isinstance(make, str) and make.strip() else None,
        "camera_model": str(model).strip() if isinstance(model, str) and model.strip() else None,
        "has_exif": bool(exif_tags or explicit_device_id or explicit_gps or explicit_timestamp),
    }


def _device_reuse_patient_count(
    database: sqlite3.Connection,
    device_id: str,
    current_patient_id: str,
    claim_id: str,
) -> int:
    patient_ids = {current_patient_id}
    rows = database.execute(
        """
        SELECT patient_id, metadata
        FROM claims
        WHERE claim_id != ?
        """,
        (claim_id,),
    ).fetchall()
    for row in rows:
        metadata = _load_json(row["metadata"], {})
        feature_engineering = metadata.get("feature_engineering")
        if not isinstance(feature_engineering, dict):
            continue
        metadata_analysis = feature_engineering.get("metadata_analysis")
        if not isinstance(metadata_analysis, dict):
            continue
        documents = metadata_analysis.get("documents", [])
        if not isinstance(documents, list):
            continue
        for document in documents:
            if isinstance(document, dict) and document.get("device_id") == device_id:
                patient_ids.add(str(row["patient_id"]))
                break
    return len(patient_ids)


def _analyze_claim_metadata(
    database: sqlite3.Connection,
    claim: dict[str, Any],
) -> dict[str, Any]:
    metadata_summary = _metadata_summary_default()
    documents = claim.get("supporting_documents") or []
    if not isinstance(documents, list):
        return metadata_summary

    hospital_row = database.execute(
        "SELECT city, state FROM hospitals WHERE hospital_id = ?",
        (claim["hospital_id"],),
    ).fetchone()
    hospital_coords = _coordinates_for(
        hospital_row[0] if hospital_row else None,
        hospital_row[1] if hospital_row else None,
    )

    extracted_documents: list[dict[str, Any]] = []
    metadata_signals: list[str] = []
    reuse_reason: str | None = None
    location_reason: str | None = None
    highest_reuse_count = 0
    largest_distance = 0.0

    for index, document in enumerate(documents):
        exif_document = _extract_document_exif(document, index)
        if exif_document is None:
            continue
        extracted_documents.append(exif_document)

        device_id = exif_document.get("device_id")
        if isinstance(device_id, str) and device_id.strip():
            patient_count = _device_reuse_patient_count(
                database,
                device_id.strip(),
                claim["patient_id"],
                claim["claim_id"],
            )
            if patient_count > highest_reuse_count:
                highest_reuse_count = patient_count
            if patient_count >= METADATA_DEVICE_REUSE_PATIENT_THRESHOLD:
                reuse_reason = f"device reused across {patient_count} patients"

        gps_info = exif_document.get("gps")
        if hospital_coords and isinstance(gps_info, dict):
            lat = gps_info.get("lat")
            lon = gps_info.get("lon")
            if isinstance(lat, (int, float)) and isinstance(lon, (int, float)):
                distance_km = _haversine_km(hospital_coords, (float(lat), float(lon)))
                largest_distance = max(largest_distance, distance_km)
                exif_document["hospital_distance_km"] = round(distance_km, 2)
                if distance_km > METADATA_GPS_MISMATCH_DISTANCE_KM:
                    location_reason = (
                        "image GPS mismatches hospital location"
                    )

    if reuse_reason:
        metadata_signals.append("device_reuse")
    if location_reason:
        metadata_signals.append("location_mismatch")

    metadata_summary["metadata_flag"] = bool(metadata_signals)
    metadata_summary["signals"] = metadata_signals
    metadata_summary["documents"] = extracted_documents
    metadata_summary["reused_device_patient_count"] = highest_reuse_count
    metadata_summary["location_mismatch_distance_km"] = round(largest_distance, 2)

    if reuse_reason:
        metadata_summary["reason"] = reuse_reason
    elif location_reason:
        metadata_summary["reason"] = location_reason

    return metadata_summary


def _apply_metadata_risk(
    fraud_flags: list[str],
    risk_score: float,
    risk_band: str,
    metadata_analysis: dict[str, Any],
) -> tuple[list[str], float, str]:
    updated_flags = list(fraud_flags)
    updated_risk_score = risk_score

    signals = metadata_analysis.get("signals", [])
    if not isinstance(signals, list):
        signals = []

    if "device_reuse" in signals:
        if "metadata_device_reuse" not in updated_flags:
            updated_flags.append("metadata_device_reuse")
        updated_risk_score = min(1.0, updated_risk_score + 0.25)

    if "location_mismatch" in signals:
        if "metadata_location_mismatch" not in updated_flags:
            updated_flags.append("metadata_location_mismatch")
        updated_risk_score = min(1.0, updated_risk_score + 0.2)

    if len(updated_flags) >= 2:
        updated_risk_band = "high"
    elif updated_flags:
        updated_risk_band = "medium"
    else:
        updated_risk_band = risk_band

    return updated_flags, round(updated_risk_score, 4), updated_risk_band


def _compute_claim_features(
    database: sqlite3.Connection,
    claim: dict[str, Any],
) -> tuple[list[str], list[float], dict[str, float], str, bool, list[str]]:
    claim_id = claim["claim_id"]
    patient_id = claim["patient_id"]
    hospital_id = claim["hospital_id"]
    claim_amount = float(claim["claim_amount"])
    generated_at = _parse_iso_datetime(claim["created_at"])

    hospital_rows = database.execute(
        """
        SELECT claim_amount
        FROM claims
        WHERE hospital_id = ?
          AND claim_id != ?
        """,
        (hospital_id, claim_id),
    ).fetchall()
    hospital_claim_amounts = [float(row[0]) for row in hospital_rows]
    hospital_avg_claim_cost = (
        mean(hospital_claim_amounts)
        if hospital_claim_amounts
        else claim_amount
    )

    lookback_since = (
        generated_at - timedelta(days=FEATURE_LOOKBACK_DAYS)
    ).isoformat()
    patient_rows = database.execute(
        """
        SELECT created_at
        FROM claims
        WHERE patient_id = ?
          AND claim_id != ?
          AND created_at >= ?
        """,
        (patient_id, claim_id, lookback_since),
    ).fetchall()
    patient_claim_frequency_30d = float(len(patient_rows))

    previous_claim = database.execute(
        """
        SELECT created_at
        FROM claims
        WHERE patient_id = ?
          AND claim_id != ?
          AND created_at < ?
        ORDER BY created_at DESC
        LIMIT 1
        """,
        (patient_id, claim_id, claim["created_at"]),
    ).fetchone()
    if previous_claim is None:
        days_since_last_claim = 0.0
    else:
        previous_dt = _parse_iso_datetime(previous_claim[0])
        days_since_last_claim = float((generated_at - previous_dt).days)

    if hospital_avg_claim_cost > 0:
        cost_deviation_ratio = claim_amount / hospital_avg_claim_cost
    else:
        cost_deviation_ratio = 1.0

    patient_row = database.execute(
        "SELECT city, state FROM patients WHERE patient_id = ?",
        (patient_id,),
    ).fetchone()
    hospital_row = database.execute(
        "SELECT city, state FROM hospitals WHERE hospital_id = ?",
        (hospital_id,),
    ).fetchone()

    patient_coords = _coordinates_for(
        patient_row[0] if patient_row else None,
        patient_row[1] if patient_row else None,
    )
    selected_hospital_coords = _coordinates_for(
        hospital_row[0] if hospital_row else None,
        hospital_row[1] if hospital_row else None,
    )

    if patient_coords and selected_hospital_coords:
        patient_hospital_distance_km = _haversine_km(
            patient_coords,
            selected_hospital_coords,
        )
    else:
        patient_hospital_distance_km = 0.0

    nearest_hospital_distance_km = 0.0
    if patient_coords:
        hospital_locations = database.execute(
            "SELECT city, state FROM hospitals",
        ).fetchall()
        distances: list[float] = []
        for row in hospital_locations:
            coords = _coordinates_for(row[0], row[1])
            if coords:
                distances.append(_haversine_km(patient_coords, coords))
        if distances:
            nearest_hospital_distance_km = min(distances)

    claims_per_week_rows = database.execute(
        """
        SELECT COUNT(*)
        FROM claims
        WHERE patient_id = ?
          AND claim_id != ?
          AND created_at >= ?
        """,
        (
            patient_id,
            claim_id,
            (generated_at - timedelta(days=7)).isoformat(),
        ),
    ).fetchone()
    claims_per_week = float(
        claims_per_week_rows[0] if claims_per_week_rows else 0.0,
    )

    current_admission = _safe_date(claim.get("admission_date"))
    current_discharge = (
        _safe_date(claim.get("discharge_date"))
        or current_admission
    )

    overlap_flag = False
    if current_admission and current_discharge:
        visit_rows = database.execute(
            """
            SELECT admission_date, discharge_date
            FROM claims
            WHERE patient_id = ?
              AND claim_id != ?
            """,
            (patient_id, claim_id),
        ).fetchall()
        for row in visit_rows:
            admission = _safe_date(row[0])
            discharge = _safe_date(row[1]) or admission
            if not admission or not discharge:
                continue
            if (
                admission <= current_discharge
                and discharge >= current_admission
            ):
                overlap_flag = True
                break

    if claims_per_week >= 3:
        claim_velocity = "high"
    elif claims_per_week >= 1:
        claim_velocity = "medium"
    else:
        claim_velocity = "low"

    spatiotemporal_flags: list[str] = []
    if (
        patient_hospital_distance_km > 50
        and nearest_hospital_distance_km > 0
        and patient_hospital_distance_km
        > (1.8 * nearest_hospital_distance_km)
    ):
        spatiotemporal_flags.append("unnecessary_travel")
    if claim_velocity == "high":
        spatiotemporal_flags.append("claim_burst")
    if overlap_flag:
        spatiotemporal_flags.append("overlapping_visits")

    hospital_targeting_row = database.execute(
        """
        SELECT
            SUM(CASE WHEN hospital_id = ? THEN 1 ELSE 0 END) AS targeted,
            COUNT(*) AS total
        FROM claims
        WHERE patient_id = ?
          AND claim_id != ?
          AND created_at >= ?
        """,
        (
            hospital_id,
            patient_id,
            claim_id,
            (generated_at - timedelta(days=30)).isoformat(),
        ),
    ).fetchone()
    targeted = (
        float(hospital_targeting_row[0] or 0.0)
        if hospital_targeting_row
        else 0.0
    )
    total = (
        float(hospital_targeting_row[1] or 0.0)
        if hospital_targeting_row
        else 0.0
    )
    if total >= 3 and targeted / total >= 0.75:
        spatiotemporal_flags.append("hospital_targeting")

    feature_vector = [
        round(hospital_avg_claim_cost, 2),
        round(patient_claim_frequency_30d, 4),
        round(cost_deviation_ratio, 4),
        round(days_since_last_claim, 2),
        round(patient_hospital_distance_km, 2),
        round(nearest_hospital_distance_km, 2),
        round(claims_per_week, 4),
        1.0 if overlap_flag else 0.0,
    ]

    feature_summary = {
        "claim_amount": round(claim_amount, 2),
        "hospital_avg_claim_cost": round(hospital_avg_claim_cost, 2),
        "patient_claim_frequency_30d": round(patient_claim_frequency_30d, 4),
        "cost_deviation_ratio": round(cost_deviation_ratio, 4),
        "days_since_last_claim": round(days_since_last_claim, 2),
        "patient_hospital_distance_km": round(patient_hospital_distance_km, 2),
        "nearest_hospital_distance_km": round(nearest_hospital_distance_km, 2),
        "claims_per_week": round(claims_per_week, 4),
        "overlap_flag": 1.0 if overlap_flag else 0.0,
    }

    return (
        CLAIM_FEATURE_LABELS,
        feature_vector,
        feature_summary,
        claim_velocity,
        overlap_flag,
        spatiotemporal_flags,
    )


def _parse_claim_date(value: str) -> datetime:
    return datetime.strptime(value, "%Y-%m-%d")


def _run_fraud_rules(
    database: sqlite3.Connection,
    payload: ClaimSubmitRequest,
    admission_date: str,
    claim_id: str,
) -> tuple[list[str], float, str]:
    fraud_flags: list[str] = []

    try:
        admission_day = _parse_claim_date(admission_date).date()
        today = datetime.now(timezone.utc).date()
        if admission_day > today:
            fraud_flags.append("claim_before_admission")
    except ValueError:
        fraud_flags.append("invalid_admission_date")

    duplicate_claim = database.execute(
        """
        SELECT 1
        FROM claims
        WHERE patient_id = ?
          AND admission_date = ?
        LIMIT 1
        """,
        (payload.patient_id, admission_date),
    ).fetchone()
    if duplicate_claim:
        fraud_flags.append("duplicate_claim")

    if payload.claim_amount > HIGH_COST_THRESHOLD:
        fraud_flags.append("high_cost")

    risk_score = min(1.0, 0.35 * len(fraud_flags))
    if "claim_before_admission" in fraud_flags:
        risk_score = min(1.0, risk_score + 0.2)
    if "duplicate_claim" in fraud_flags:
        risk_score = min(1.0, risk_score + 0.25)
    if "high_cost" in fraud_flags:
        risk_score = min(1.0, risk_score + 0.15)

    if not fraud_flags:
        risk_band = "low"
    elif len(fraud_flags) == 1:
        risk_band = "medium"
    else:
        risk_band = "high"

    return fraud_flags, round(risk_score, 4), risk_band


def _score_beneficiary(
    payload: BeneficiaryVerifyRequest,
    candidate: dict[str, Any],
) -> tuple[float, dict[str, float], list[str]]:
    name_similarity = _string_similarity(
        payload.full_name,
        candidate.get("full_name"),
    )
    dob_match = (
        1.0
        if payload.date_of_birth == candidate.get("date_of_birth")
        else 0.0
    )
    address_similarity = _string_similarity(
        payload.address,
        candidate.get("address"),
    )
    government_match = _exact_match(
        payload.government_id,
        candidate.get("government_id"),
    )
    member_match = _exact_match(
        payload.scheme_member_id,
        candidate.get("scheme_member_id"),
    )
    city_similarity = _string_similarity(payload.city, candidate.get("city"))
    state_similarity = _string_similarity(
        payload.state,
        candidate.get("state"),
    )

    match_breakdown = {
        "name_similarity": round(name_similarity, 4),
        "dob_match": round(dob_match, 4),
        "address_similarity": round(address_similarity, 4),
        "government_id_match": round(government_match, 4),
        "scheme_member_id_match": round(member_match, 4),
        "city_similarity": round(city_similarity, 4),
        "state_similarity": round(state_similarity, 4),
    }

    score = (
        0.35 * name_similarity
        + 0.25 * dob_match
        + 0.20 * address_similarity
        + 0.10 * government_match
        + 0.05 * member_match
        + 0.03 * city_similarity
        + 0.02 * state_similarity
    )

    reasons: list[str] = []
    if payload.government_id and government_match == 0.0:
        score -= 0.12
        reasons.append(
            "government ID does not match the stored beneficiary record",
        )
    if payload.scheme_member_id and member_match == 0.0:
        score -= 0.08
        reasons.append(
            "scheme member ID does not match the stored beneficiary record",
        )
    if dob_match == 0.0:
        reasons.append("date of birth mismatch reduces confidence")
    if name_similarity < 0.75:
        reasons.append("name similarity is below the strong-match threshold")
    if address_similarity < 0.60:
        reasons.append(
            "address similarity is below the strong-match threshold",
        )

    score = max(0.0, min(score, 1.0))
    return score, match_breakdown, reasons


@app.get("/health")
def health() -> dict[str, Any]:
    try:
        with closing(_get_store_or_error()) as database:
            counts = {
                "patients": database.execute(
                    "SELECT COUNT(*) FROM patients",
                ).fetchone()[0],
                "hospitals": database.execute(
                    "SELECT COUNT(*) FROM hospitals",
                ).fetchone()[0],
                "claims": database.execute(
                    "SELECT COUNT(*) FROM claims",
                ).fetchone()[0],
            }
            return {
                "status": "ok",
                "service": "claims-assurance-service",
                "sql": "connected",
                "counts": counts,
            }
    except HTTPException as exc:
        return {
            "status": "degraded",
            "service": "claims-assurance-service",
            "sql": "disconnected",
            "sql_error": exc.detail,
        }


@app.post("/add-patient", response_model=PatientResponse)
def add_patient(payload: PatientCreateRequest) -> PatientResponse:
    with closing(_get_store_or_error()) as database:
        patient_id = payload.patient_id or (
            f"PAT-{uuid.uuid4().hex[:10].upper()}"
        )
        existing = database.execute(
            "SELECT 1 FROM patients WHERE patient_id = ?",
            (patient_id,),
        ).fetchone()
        if existing:
            raise HTTPException(
                status_code=409,
                detail="Patient already exists",
            )

        now = _utc_now()
        record = payload.model_dump()
        record["patient_id"] = patient_id
        record["created_at"] = now
        record["updated_at"] = now
        database.execute(
            """
            INSERT INTO patients (
                patient_id, full_name, date_of_birth, gender, government_id,
                scheme_id, scheme_member_id, phone_number, address,
                city, state,
                eligibility_status, metadata, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            _row_values("patients", record, PATIENT_COLUMNS),
        )
        database.commit()
        return PatientResponse(**record)


@app.post("/submit-claim", response_model=ClaimResponse)
def submit_claim(payload: ClaimSubmitRequest) -> ClaimResponse:
    with closing(_get_store_or_error()) as database:
        patient = _patient_from_row(
            database.execute(
                "SELECT * FROM patients WHERE patient_id = ?",
                (payload.patient_id,),
            ).fetchone(),
        )
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")

        hospital = _hospital_from_row(
            database.execute(
                "SELECT * FROM hospitals WHERE hospital_id = ?",
                (payload.hospital_id,),
            ).fetchone(),
        )
        if not hospital:
            raise HTTPException(status_code=404, detail="Hospital not found")

        if patient.get("scheme_id") != payload.scheme_id:
            raise HTTPException(
                status_code=422,
                detail="Patient scheme does not match claim scheme",
            )

        claim_id = payload.claim_id or f"CLM-{uuid.uuid4().hex[:12].upper()}"
        existing = database.execute(
            "SELECT 1 FROM claims WHERE claim_id = ?",
            (claim_id,),
        ).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="Claim already exists")

        now = _utc_now()
        fraud_flags, risk_score, risk_band = _run_fraud_rules(
            database,
            payload,
            payload.admission_date,
            claim_id,
        )
        temp_record = payload.model_dump()
        temp_record.update(
            {
                "claim_id": claim_id,
                "status": "submitted",
                "risk_score": risk_score,
                "risk_band": risk_band,
                "fraud_flags": fraud_flags,
                "patient_name": patient.get("full_name"),
                "hospital_name": hospital.get("name"),
                "created_at": now,
                "updated_at": now,
            }
        )
        (
            feature_labels,
            feature_vector,
            feature_summary,
            claim_velocity,
            overlap_flag,
            spatiotemporal_flags,
        ) = (
            _compute_claim_features(
                database,
                temp_record,
            )
        )
        metadata_analysis = _analyze_claim_metadata(database, temp_record)
        fraud_flags, risk_score, risk_band = _apply_metadata_risk(
            fraud_flags,
            risk_score,
            risk_band,
            metadata_analysis,
        )
        record = payload.model_dump()
        record.update(
            {
                "claim_id": claim_id,
                "status": "submitted",
                "risk_score": risk_score,
                "risk_band": risk_band,
                "fraud_flags": fraud_flags,
                "patient_name": patient.get("full_name"),
                "hospital_name": hospital.get("name"),
                "created_at": now,
                "updated_at": now,
                "feature_labels": feature_labels,
                "feature_vector": feature_vector,
                "feature_summary": feature_summary,
            }
        )
        metadata = dict(record.get("metadata") or {})
        metadata["feature_engineering"] = {
            "feature_labels": feature_labels,
            "feature_vector": feature_vector,
            "feature_summary": feature_summary,
            "claim_velocity": claim_velocity,
            "overlap_flag": overlap_flag,
            "spatiotemporal_flags": spatiotemporal_flags,
            "metadata_analysis": metadata_analysis,
        }
        record["metadata"] = metadata
        database.execute(
            """
            INSERT INTO claims (
                claim_id, patient_id, hospital_id, scheme_id, diagnosis,
                procedure,
                claim_amount, admission_date, discharge_date, document_text,
                supporting_documents, metadata, status, risk_score, risk_band,
                fraud_flags, patient_name, hospital_name,
                created_at, updated_at
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
            """,
            _row_values("claims", record, CLAIM_COLUMNS),
        )
        database.commit()
        return ClaimResponse(**record)


@app.get("/get-claim", response_model=ClaimResponse)
def get_claim(claim_id: str) -> ClaimResponse:
    with closing(_get_store_or_error()) as database:
        claim = _claim_from_row(
            database.execute(
                "SELECT * FROM claims WHERE claim_id = ?",
                (claim_id,),
            ).fetchone(),
        )
        if not claim:
            raise HTTPException(status_code=404, detail="Claim not found")
        return ClaimResponse(**claim)


@app.get("/claims/{claim_id}", response_model=ClaimResponse)
def get_claim_by_path(claim_id: str) -> ClaimResponse:
    return get_claim(claim_id)


@app.get("/claim-features/{claim_id}", response_model=ClaimFeatureResponse)
def get_claim_features(claim_id: str) -> ClaimFeatureResponse:
    with closing(_get_store_or_error()) as database:
        claim = _claim_from_row(
            database.execute(
                "SELECT * FROM claims WHERE claim_id = ?",
                (claim_id,),
            ).fetchone(),
        )
        if not claim:
            raise HTTPException(status_code=404, detail="Claim not found")

        feature_engineering = claim.get("metadata", {}).get(
            "feature_engineering",
        )
        if isinstance(feature_engineering, dict):
            feature_labels = feature_engineering.get("feature_labels")
            feature_vector = feature_engineering.get("feature_vector")
            feature_summary = feature_engineering.get("feature_summary")
            claim_velocity = feature_engineering.get("claim_velocity", "low")
            overlap_flag = bool(feature_engineering.get("overlap_flag", False))
            spatiotemporal_flags = feature_engineering.get(
                "spatiotemporal_flags",
                [],
            )
            metadata_analysis = feature_engineering.get("metadata_analysis", {})
        else:
            (
                feature_labels,
                feature_vector,
                feature_summary,
                claim_velocity,
                overlap_flag,
                spatiotemporal_flags,
            ) = (
                _compute_claim_features(
                    database,
                    claim,
                )
            )
            metadata_analysis = _analyze_claim_metadata(database, claim)

        return ClaimFeatureResponse(
            claim_id=claim["claim_id"],
            patient_id=claim["patient_id"],
            hospital_id=claim["hospital_id"],
            feature_labels=feature_labels,
            feature_vector=feature_vector,
            feature_summary=feature_summary,
            claim_velocity=claim_velocity,
            overlap_flag=overlap_flag,
            spatiotemporal_flags=spatiotemporal_flags,
            metadata_flag=bool(metadata_analysis.get("metadata_flag", False)),
            metadata_reason=metadata_analysis.get("reason"),
            metadata_signals=metadata_analysis.get("signals", []),
            metadata_summary=metadata_analysis,
            generated_at=claim["created_at"],
        )


@app.post("/verify-beneficiary", response_model=BeneficiaryVerifyResponse)
def verify_beneficiary(
    payload: BeneficiaryVerifyRequest,
) -> BeneficiaryVerifyResponse:
    with closing(_get_store_or_error()) as database:
        candidates: list[dict[str, Any]] = []

        if payload.patient_id:
            row = database.execute(
                "SELECT * FROM patients WHERE patient_id = ?",
                (payload.patient_id,),
            ).fetchone()
            patient = _patient_from_row(row)
            if patient is not None:
                candidates.append(patient)
        else:
            rows = database.execute("SELECT * FROM patients").fetchall()
            for row in rows:
                patient = _patient_from_row(row)
                if patient is not None:
                    candidates.append(patient)

        if not candidates:
            return BeneficiaryVerifyResponse(
                patient_id=payload.patient_id,
                decision="rejected",
                confidence_score=0.0,
                matched_patient_id=None,
                matched_patient_name=None,
                matched_scheme_id=None,
                match_breakdown={},
                signals=[],
                reasons=["No beneficiary records available for matching"],
            )

        scored_candidates: list[
            tuple[float, dict[str, float], list[str], dict[str, Any]]
        ] = []
        for candidate in candidates:
            score, breakdown, reasons = _score_beneficiary(payload, candidate)
            if (
                payload.scheme_id
                and candidate.get("scheme_id") != payload.scheme_id
            ):
                score -= 0.1
                reasons = reasons + [
                    "scheme ID does not match the expected benefit program",
                ]
            score = max(0.0, min(score, 1.0))
            scored_candidates.append((score, breakdown, reasons, candidate))

        scored_candidates.sort(key=lambda item: item[0], reverse=True)
        best_score, breakdown, reasons, best_candidate = scored_candidates[0]

        if best_score >= BENEFICIARY_APPROVE_THRESHOLD:
            decision = "approved"
        elif best_score >= BENEFICIARY_REVIEW_THRESHOLD:
            decision = "review"
        else:
            decision = "rejected"

        signals: list[str] = []
        if _exact_match(
            payload.date_of_birth,
            best_candidate.get("date_of_birth"),
        ):
            signals.append("dob_exact")
        if _string_similarity(
            payload.full_name,
            best_candidate.get("full_name"),
        ) >= 0.85:
            signals.append("name_close_match")
        if _string_similarity(
            payload.address,
            best_candidate.get("address"),
        ) >= 0.70:
            signals.append("address_close_match")
        if _exact_match(
            payload.government_id,
            best_candidate.get("government_id"),
        ) == 1.0:
            signals.append("government_id_exact")
        if _exact_match(
            payload.scheme_member_id,
            best_candidate.get("scheme_member_id"),
        ) == 1.0:
            signals.append("scheme_member_id_exact")

        return BeneficiaryVerifyResponse(
            patient_id=payload.patient_id,
            decision=decision,
            confidence_score=round(best_score, 4),
            matched_patient_id=best_candidate.get("patient_id"),
            matched_patient_name=best_candidate.get("full_name"),
            matched_scheme_id=best_candidate.get("scheme_id"),
            match_breakdown=breakdown,
            signals=signals,
            reasons=reasons,
        )


@app.post("/auth/signup", response_model=AuthResponse)
def auth_signup(payload: AuthSignupRequest) -> AuthResponse:
    with closing(_get_store_or_error()) as database:
        user = _signup_user(database, payload)
        return AuthResponse(
            verified=True,
            message="Signup successful",
            user=user,
        )


@app.post("/auth/login", response_model=AuthResponse)
def auth_login(payload: AuthLoginRequest) -> AuthResponse:
    with closing(_get_store_or_error()) as database:
        user = _login_user(database, payload)
        return AuthResponse(
            verified=True,
            message="Login verified",
            user=user,
        )
