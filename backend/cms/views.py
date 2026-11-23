"""API for the MTM website.

Public:   GET  /api/content/        content edits made in the admin (the site merges them over data.js)
          POST /api/enquiries/      contact-form submissions (rate limited, spam-trap field)
Auth:     POST /api/auth/token/     e-mail + password  ->  JWT access / refresh tokens
Admin:    everything under /api/admin/  (staff JWT required)
"""

import csv
import json
import os
import re
import secrets
from datetime import datetime, time, timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.core.validators import validate_email
from django.db import transaction
from django.db.models import Case, CharField, Count, F, Max, Q, Value, When
from django.db.models.functions import TruncDate
from django.http import HttpResponse, JsonResponse
from django.utils import timezone
from django.utils.text import slugify
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework.throttling import BaseThrottle, ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

from .content_rules import CONTENT_ROOTS, check_path, check_value
from .exceptions import Conflict
from .models import Enquiry, MediaFile, SiteContent

User = get_user_model()

STATUSES = [value for value, _label in Enquiry.Status.choices]
MAX_UPLOAD = 8 * 1024 * 1024  # 8 MB


def health_check(request):
    """For UptimeRobot / Render."""
    return JsonResponse({"status": "ok"})


# ====================== helpers ======================
def clean_str(value, max_len, field, required=True, min_len=0):
    if value is None or value == "":
        if required:
            raise ValidationError(f"{field} is required")
        return ""
    if not isinstance(value, str):
        raise ValidationError(f"{field} must be text")
    s = value.strip()
    if required and not s:
        raise ValidationError(f"{field} is required")
    if len(s) < min_len:
        raise ValidationError(f"{field} must be at least {min_len} characters")
    if len(s) > max_len:
        raise ValidationError(f"{field} is too long (max {max_len})")
    return s


def clean_email(value):
    email = clean_str(value, 200, "Email")
    try:
        validate_email(email)
    except DjangoValidationError:
        raise ValidationError("Email looks invalid")
    return email


def clean_password(value, field, user=None):
    password = clean_str(value, 200, field, min_len=10)
    try:
        validate_password(password, user)
    except DjangoValidationError as exc:
        raise ValidationError(" ".join(exc.messages))
    return password


def body_of(request):
    data = request.data
    if not hasattr(data, "get"):
        raise ValidationError("Body must be a JSON object")
    return data


def to_int(value, default):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def public_user(u):
    return {
        "id": u.id,
        "email": u.email or u.username,
        "name": u.get_full_name() or u.first_name or u.username,
        "created_at": u.date_joined.isoformat(),
    }


def enquiry_dict(e):
    return {
        "id": e.id,
        "name": e.name,
        "email": e.email,
        "phone": e.phone,
        "type": e.type,
        "message": e.message,
        "status": e.status,
        "notes": e.notes,
        "ip": e.ip,
        "created_at": e.created_at.isoformat(),
        "updated_at": e.updated_at.isoformat(),
    }


def media_url(request, m):
    url = m.file.url
    return url if re.match(r"^https?://", url) else request.build_absolute_uri(url)


class AdminView(APIView):
    """Base class: staff JWT required."""

    permission_classes = [IsAdminUser]


# ====================== auth ======================
class EmailTokenSerializer(TokenObtainPairSerializer):
    """Admins sign in with their e-mail address; it is stored in lower case."""

    def validate(self, attrs):
        attrs[self.username_field] = str(attrs.get(self.username_field, "")).strip().lower()
        return super().validate(attrs)


class LoginView(TokenObtainPairView):
    serializer_class = EmailTokenSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"


class MeView(AdminView):
    def get(self, request):
        return Response({"user": public_user(request.user)})


# ====================== public ======================
class PublicContentView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        content = {row.path: row.data for row in SiteContent.objects.all()}
        response = Response({"content": content})
        response["Cache-Control"] = "no-cache"
        return response


def notify_new_enquiry(enquiry):
    """Email the team about a new enquiry (only if ENQUIRY_NOTIFY_EMAILS is configured)."""
    recipients = settings.ENQUIRY_NOTIFY_EMAILS
    if not recipients:
        return
    lines = [
        f"Name: {enquiry.name}",
        f"Phone: {enquiry.phone}",
        f"Email: {enquiry.email}",
        f"Project type: {enquiry.type or '-'}",
        "",
        enquiry.message,
    ]
    send_mail(
        subject=f"New website enquiry — {enquiry.name}",
        message="\n".join(lines),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=recipients,
        fail_silently=True,  # a mail problem must never lose the enquiry or break the form
    )


class EnquiryCreateView(APIView):
    """Visitors may only create an enquiry; the team reads and manages them in the admin."""

    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "enquiry"

    def post(self, request):
        data = body_of(request)
        # Honeypot: real visitors never see or fill this field, bots do.
        if str(data.get("website") or "").strip():
            return Response({"ok": True}, status=201)

        enquiry = Enquiry.objects.create(
            name=clean_str(data.get("name"), 120, "Name"),
            email=clean_email(data.get("email")),
            phone=clean_str(data.get("phone"), 40, "Phone", min_len=5),
            type=clean_str(data.get("type"), 80, "Project type", required=False),
            message=clean_str(data.get("message"), 4000, "Message"),
            ip=BaseThrottle().get_ident(request)[:64],
        )
        notify_new_enquiry(enquiry)
        return Response({"ok": True, "id": enquiry.id}, status=201)


# ====================== admin: dashboard ======================
class StatsView(AdminView):
    def get(self, request):
        counts = {s: 0 for s in STATUSES}
        for row in Enquiry.objects.values("status").annotate(n=Count("id")).order_by():
            counts[row["status"]] = row["n"]

        today = timezone.localdate()
        start = timezone.make_aware(datetime.combine(today - timedelta(days=13), time.min))
        per_day = {
            row["day"]: row["n"]
            for row in Enquiry.objects.filter(created_at__gte=start)
            .annotate(day=TruncDate("created_at"))
            .values("day")
            .annotate(n=Count("id"))
            .order_by()
        }
        days = []
        for i in range(13, -1, -1):
            d = today - timedelta(days=i)
            days.append({"day": d.isoformat(), "count": per_day.get(d, 0)})

        by_type = (
            Enquiry.objects.exclude(status="spam")
            .annotate(
                label=Case(
                    When(type="", then=Value("Not specified")),
                    default=F("type"),
                    output_field=CharField(),
                )
            )
            .values("label")
            .annotate(n=Count("id"))
            .order_by("-n", "label")
        )
        recent = [
            {
                "id": e.id,
                "name": e.name,
                "type": e.type,
                "status": e.status,
                "created_at": e.created_at.isoformat(),
                "snippet": e.message[:120],
            }
            for e in Enquiry.objects.order_by("-id")[:5]
        ]
        last_edit = SiteContent.objects.aggregate(t=Max("updated_at"))["t"]

        return Response(
            {
                "enquiries": {
                    "total": Enquiry.objects.count(),
                    "last7": Enquiry.objects.filter(created_at__gte=timezone.now() - timedelta(days=7)).count(),
                    "byStatus": counts,
                    "byType": [{"type": r["label"], "n": r["n"]} for r in by_type],
                    "perDay": days,
                    "recent": recent,
                },
                "content": {
                    "changedFields": SiteContent.objects.count(),
                    "lastEdit": last_edit.isoformat() if last_edit else None,
                },
                "media": {"count": MediaFile.objects.count()},
            }
        )


# ====================== admin: site content ======================
class AdminContentView(AdminView):
    def get(self, request):
        content, meta = {}, {}
        for row in SiteContent.objects.all():
            content[row.path] = row.data
            meta[row.path.split(".")[0]] = {"updated_at": row.updated_at.isoformat(), "updated_by": row.updated_by}
        return Response({"content": content, "meta": meta})


class AdminContentSectionView(AdminView):
    """Replace every override of one section (e.g. ABOUT_PAGE) with `changes`: {"path": value}.
    Sending {} resets the section back to the defaults in data.js."""

    parser_classes = [JSONParser]

    def put(self, request, section):
        if section not in CONTENT_ROOTS:
            raise NotFound("Unknown content section")
        changes = body_of(request).get("changes")
        if not isinstance(changes, dict):
            raise ValidationError("`changes` must be an object")
        if len(changes) > 500:
            raise ValidationError("Too many changes")
        for path, value in changes.items():
            check_path(path, section)
            check_value(path, value)

        who = request.user.email or request.user.username
        with transaction.atomic():
            SiteContent.objects.filter(Q(path=section) | Q(path__startswith=f"{section}.")).delete()
            SiteContent.objects.bulk_create(
                [SiteContent(path=p, value=json.dumps(v), updated_by=who) for p, v in changes.items()]
            )
        return Response({"ok": True, "saved": len(changes)})


# ====================== admin: enquiries ======================
class EnquiryListView(AdminView):
    def get(self, request):
        q = request.query_params
        qs = Enquiry.objects.all()
        status = q.get("status")
        term = (q.get("q") or "").strip()[:100]
        if status and status != "all":
            if status not in STATUSES:
                raise ValidationError("Invalid status")
            qs = qs.filter(status=status)
        elif status != "all" and not term:
            qs = qs.exclude(status="spam")  # the default inbox hides spam
        if term:
            qs = qs.filter(
                Q(name__icontains=term) | Q(email__icontains=term) | Q(phone__icontains=term) | Q(message__icontains=term)
            )
        per = min(100, max(1, to_int(q.get("per"), 20)))
        page = max(1, to_int(q.get("page"), 1))
        total = qs.count()
        items = qs.order_by("-id")[(page - 1) * per : page * per]
        return Response({"items": [enquiry_dict(e) for e in items], "total": total, "page": page, "per": per})


def csv_cell(value):
    s = str(value if value is not None else "")
    if re.match(r"^[=+\-@\t\r]", s):
        s = "'" + s  # stop spreadsheet formula injection
    return s


class EnquiryExportView(AdminView):
    def get(self, request):
        head = ["id", "created_at", "status", "name", "email", "phone", "type", "message", "notes"]
        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="enquiries-{timezone.localdate().isoformat()}.csv"'
        response["Cache-Control"] = "no-store"
        response.write("\ufeff")
        writer = csv.writer(response, quoting=csv.QUOTE_ALL)
        writer.writerow(head)
        for e in Enquiry.objects.all():
            row = enquiry_dict(e)
            row["created_at"] = timezone.localtime(e.created_at).strftime("%Y-%m-%d %H:%M:%S")
            writer.writerow([csv_cell(row[h]) for h in head])
        return response


class EnquiryDetailView(AdminView):
    def get_object(self, pk):
        try:
            return Enquiry.objects.get(pk=pk)
        except Enquiry.DoesNotExist:
            raise NotFound("Enquiry not found")

    def patch(self, request, pk):
        data = body_of(request)
        enquiry = self.get_object(pk)
        touched = False
        if data.get("status") is not None:
            if data["status"] not in STATUSES:
                raise ValidationError("Invalid status")
            enquiry.status = data["status"]
            touched = True
        if data.get("notes") is not None:
            enquiry.notes = clean_str(data["notes"], 4000, "Notes", required=False)
            touched = True
        if not touched:
            raise ValidationError("Nothing to update")
        enquiry.save()
        return Response({"enquiry": enquiry_dict(enquiry)})

    def delete(self, request, pk):
        self.get_object(pk).delete()
        return Response({"ok": True})


# ====================== admin: media ======================
def sniff_image(head):
    """Identify the image type from its first bytes (never trust the file name or browser type).
    SVG is deliberately not accepted (script risk)."""
    if len(head) < 12:
        return None
    if head[:3] == b"\xff\xd8\xff":
        return "jpg", "image/jpeg"
    if head[:8] == b"\x89PNG\r\n\x1a\n":
        return "png", "image/png"
    if head[:4] == b"GIF8":
        return "gif", "image/gif"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "webp", "image/webp"
    return None


class MediaListView(AdminView):
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        rows = [(r.path, r.value) for r in SiteContent.objects.all()]
        uploads = []
        for m in MediaFile.objects.all():
            url = media_url(request, m)
            needle = json.dumps(url)
            uploads.append(
                {
                    "id": m.id,
                    "filename": os.path.basename(m.file.name),
                    "original": m.original,
                    "mime": m.mime,
                    "size": m.size,
                    "created_at": m.created_at.isoformat(),
                    "url": url,
                    "usedBy": [p for p, v in rows if needle in v],
                }
            )
        return Response({"uploads": uploads})

    def post(self, request):
        f = request.FILES.get("file")
        if f is None:
            raise ValidationError("No file was sent")
        if f.size > MAX_UPLOAD:
            raise ValidationError("Image is larger than 8 MB")
        head = f.read(12)
        f.seek(0)
        kind = sniff_image(head)
        if not kind:
            raise ValidationError("Only JPG, PNG, WebP or GIF images are allowed")
        ext, mime = kind

        original = os.path.basename(f.name or "image")[:120]
        base = slugify(os.path.splitext(original)[0])[:40] or "image"
        filename = f"{base}-{secrets.token_hex(4)}.{ext}"

        media = MediaFile(original=original, mime=mime, size=f.size)
        media.file.save(filename, f, save=False)
        media.save()
        url = media_url(request, media)
        return Response(
            {
                "media": {
                    "id": media.id,
                    "filename": os.path.basename(media.file.name),
                    "original": media.original,
                    "mime": media.mime,
                    "size": media.size,
                    "created_at": media.created_at.isoformat(),
                    "url": url,
                    "usedBy": [],
                }
            },
            status=201,
        )


class MediaDetailView(AdminView):
    def delete(self, request, pk):
        try:
            media = MediaFile.objects.get(pk=pk)
        except MediaFile.DoesNotExist:
            raise NotFound("File not found")
        needle = json.dumps(media_url(request, media))
        used = [r.path for r in SiteContent.objects.all() if needle in r.value]
        if used and request.query_params.get("force") != "1":
            raise Conflict(f"This image is used on the site ({', '.join(used[:3])}). Change it there first.")
        media.delete()  # the post_delete signal removes the file from storage
        return Response({"ok": True})


# ====================== admin: users ======================
class UserListView(AdminView):
    def get(self, request):
        return Response({"users": [public_user(u) for u in User.objects.filter(is_staff=True).order_by("id")]})

    def post(self, request):
        data = body_of(request)
        email = clean_email(data.get("email")).lower()
        name = clean_str(data.get("name"), 100, "Name")
        if User.objects.filter(Q(username__iexact=email) | Q(email__iexact=email)).exists():
            raise Conflict("A user with that email already exists")
        password = clean_password(data.get("password"), "Password")
        User.objects.create_user(username=email, email=email, password=password, first_name=name, is_staff=True)
        return Response({"ok": True}, status=201)


class UserDetailView(AdminView):
    def delete(self, request, pk):
        if pk == request.user.id:
            raise ValidationError("You can't delete your own account")
        try:
            user = User.objects.get(pk=pk, is_staff=True)
        except User.DoesNotExist:
            raise NotFound("User not found")
        if user.is_superuser and not request.user.is_superuser:
            raise PermissionDenied("Only the main administrator can remove that account")
        user.delete()
        return Response({"ok": True})


class PasswordView(AdminView):
    def post(self, request):
        data = body_of(request)
        current = clean_str(data.get("current"), 200, "Current password")
        if not request.user.check_password(current):
            raise PermissionDenied("Current password is wrong")
        request.user.set_password(clean_password(data.get("next"), "New password", request.user))
        request.user.save()
        return Response({"ok": True})
