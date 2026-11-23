"""Validation of the website-content edits the admin panel saves (so a mistake or a hostile
request can't put a script link or a broken image address on the public site)."""

import re

from rest_framework.exceptions import ValidationError

# Top-level objects of frontend/src/data.js that the admin may override.
CONTENT_ROOTS = {
    "CONTACT", "IMG", "NAV", "SERVICES", "WHY", "FOCUS", "PROCESS",
    "ABOUT_PAGE", "SERVICES_PAGE", "FOCUS_PAGE", "WHY_PAGE", "CONTACT_PAGE",
}

PATH_RE = re.compile(r"[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)*")
KEY_RE = re.compile(r"[A-Za-z0-9_]+")
IMAGE_RE = re.compile(r"((/(images|uploads)/[A-Za-z0-9_.\-]+)|(https?://\S+))?")
LINK_RE = re.compile(r"(https?:|tel:|mailto:|/|#).*", re.I | re.S)


def check_path(path, section):
    if not isinstance(path, str) or len(path) > 200 or not PATH_RE.fullmatch(path):
        raise ValidationError(f"Invalid path: {path}")
    if path != section and not path.startswith(f"{section}."):
        raise ValidationError(f"{path} does not belong to {section}")


def check_value(path, value):
    leaf = path.split(".")[-1]

    def walk(v, depth=0):
        if depth > 6:
            raise ValidationError(f"{path}: too deeply nested")
        if isinstance(v, str):
            if len(v) > 5000:
                raise ValidationError(f"{path}: text too long")
            if leaf in ("image", "mobileImage"):
                if not IMAGE_RE.fullmatch(v):
                    raise ValidationError(f"{path}: image must be an /images/… or https:// address")
            elif leaf in ("href", "whatsappLink") and v and not LINK_RE.fullmatch(v):
                raise ValidationError(f"{path}: link must start with https://, tel:, mailto:, / or #")
        elif isinstance(v, list):
            if len(v) > 100:
                raise ValidationError(f"{path}: too many items")
            for x in v:
                walk(x, depth + 1)
        elif isinstance(v, dict):
            for k, x in v.items():
                if not isinstance(k, str) or not KEY_RE.fullmatch(k):
                    raise ValidationError(f"{path}: invalid key")
                walk(x, depth + 1)
        elif v is not None and not isinstance(v, (int, float, bool)):
            raise ValidationError(f"{path}: unsupported value")

    walk(value)
