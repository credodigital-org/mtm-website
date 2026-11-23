import json
import tempfile

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.test import APITestCase

from cms.models import Enquiry, MediaFile, SiteContent

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32


def make_admin(email="admin@example.com", password="correct-horse-battery"):
    return get_user_model().objects.create_user(
        username=email, email=email, password=password, first_name="Admin", is_staff=True, is_superuser=True
    )


class BaseTest(APITestCase):
    def setUp(self):
        cache.clear()  # the enquiry / login rate limits live in the cache

    def login_as_admin(self):
        self.client.force_authenticate(user=make_admin())


class PublicApiTests(BaseTest):
    def test_health(self):
        self.assertEqual(self.client.get("/health/").json(), {"status": "ok"})

    def test_content_is_public_and_returns_saved_values(self):
        SiteContent.objects.create(path="CONTACT.phone", value=json.dumps("+971 1"))
        res = self.client.get("/api/content/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["content"], {"CONTACT.phone": "+971 1"})

    def test_admin_endpoints_require_login(self):
        for path in ("stats", "content", "enquiries", "media", "users"):
            with self.subTest(path=path):
                self.assertIn(self.client.get(f"/api/admin/{path}/").status_code, (401, 403))

    def test_non_staff_user_is_refused(self):
        user = get_user_model().objects.create_user(username="x@example.com", password="correct-horse-battery")
        self.client.force_authenticate(user=user)
        self.assertEqual(self.client.get("/api/admin/stats/").status_code, 403)


class LoginTests(BaseTest):
    def test_login_is_case_insensitive_and_returns_tokens(self):
        make_admin()
        res = self.client.post(
            "/api/auth/token/", {"username": " Admin@Example.com ", "password": "correct-horse-battery"}, format="json"
        )
        self.assertEqual(res.status_code, 200)
        self.assertIn("access", res.json())
        me = self.client.get("/api/auth/me/", HTTP_AUTHORIZATION=f"Bearer {res.json()['access']}")
        self.assertEqual(me.json()["user"]["email"], "admin@example.com")

    def test_wrong_password_gives_readable_error(self):
        make_admin()
        res = self.client.post("/api/auth/token/", {"username": "admin@example.com", "password": "nope"}, format="json")
        self.assertEqual(res.status_code, 401)
        self.assertEqual(res.json(), {"error": "Wrong email or password"})


class EnquiryTests(BaseTest):
    payload = {"name": "Sam", "email": "sam@example.com", "phone": "+971501234567", "type": "Villa", "message": "Hello"}

    def test_visitor_can_send_an_enquiry(self):
        res = self.client.post("/api/enquiries/", self.payload, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(Enquiry.objects.count(), 1)
        self.assertEqual(Enquiry.objects.get().status, "new")

    def test_validation_errors_are_readable(self):
        res = self.client.post("/api/enquiries/", {**self.payload, "email": "not-an-email"}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json(), {"error": "Email looks invalid"})

    def test_honeypot_pretends_success_but_saves_nothing(self):
        res = self.client.post("/api/enquiries/", {**self.payload, "website": "http://spam"}, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(Enquiry.objects.count(), 0)

    @override_settings(ENQUIRY_NOTIFY_EMAILS=["team@example.com"])
    def test_team_gets_an_email(self):
        self.client.post("/api/enquiries/", self.payload, format="json")
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("Sam", mail.outbox[0].subject)

    def test_public_cannot_list_enquiries(self):
        self.assertIn(self.client.get("/api/enquiries/").status_code, (401, 403, 405))

    def test_admin_inbox_filters_update_and_delete(self):
        Enquiry.objects.create(name="A", email="a@example.com", phone="12345", message="one")
        spam = Enquiry.objects.create(name="B", email="b@example.com", phone="12345", message="two", status="spam")
        self.login_as_admin()

        inbox = self.client.get("/api/admin/enquiries/").json()
        self.assertEqual(inbox["total"], 1)  # spam is hidden by default
        self.assertEqual(self.client.get("/api/admin/enquiries/?status=spam").json()["total"], 1)
        self.assertEqual(self.client.get("/api/admin/enquiries/?q=two").json()["total"], 1)

        res = self.client.patch(f"/api/admin/enquiries/{spam.id}/", {"status": "done", "notes": "called"}, format="json")
        self.assertEqual(res.json()["enquiry"]["status"], "done")
        self.assertEqual(self.client.patch(f"/api/admin/enquiries/{spam.id}/", {"status": "bogus"}, format="json").status_code, 400)

        self.assertEqual(self.client.delete(f"/api/admin/enquiries/{spam.id}/").status_code, 200)
        self.assertEqual(Enquiry.objects.count(), 1)

    def test_csv_export_neutralises_formulas(self):
        Enquiry.objects.create(name="=1+1", email="a@example.com", phone="12345", message="x")
        self.login_as_admin()
        res = self.client.get("/api/admin/enquiries/export/")
        self.assertEqual(res.status_code, 200)
        self.assertIn("'=1+1", res.content.decode("utf-8-sig"))

    def test_stats(self):
        Enquiry.objects.create(name="A", email="a@example.com", phone="12345", message="one", type="Villa")
        self.login_as_admin()
        data = self.client.get("/api/admin/stats/").json()
        self.assertEqual(data["enquiries"]["total"], 1)
        self.assertEqual(data["enquiries"]["byStatus"]["new"], 1)
        self.assertEqual(len(data["enquiries"]["perDay"]), 14)
        self.assertEqual(data["enquiries"]["byType"], [{"type": "Villa", "n": 1}])


class ContentTests(BaseTest):
    def put(self, section, changes):
        return self.client.put(f"/api/admin/content/{section}/", {"changes": changes}, format="json")

    def test_save_replace_and_reset_a_section(self):
        self.login_as_admin()
        self.assertEqual(self.put("CONTACT_PAGE", {"CONTACT_PAGE.hero.titleTop": "Hi", "CONTACT_PAGE.cta.title": "Yo"}).json()["saved"], 2)
        self.assertEqual(SiteContent.objects.count(), 2)
        self.put("CONTACT_PAGE", {"CONTACT_PAGE.hero.titleTop": "Hello"})
        self.assertEqual(SiteContent.objects.count(), 1)
        self.put("CONTACT_PAGE", {})
        self.assertEqual(SiteContent.objects.count(), 0)

    def test_other_sections_are_untouched(self):
        self.login_as_admin()
        self.put("CONTACT", {"CONTACT.phone": "1"})
        self.put("CONTACT_PAGE", {})
        self.assertTrue(SiteContent.objects.filter(path="CONTACT.phone").exists())

    def test_rejects_bad_input(self):
        self.login_as_admin()
        self.assertEqual(self.put("NOPE", {}).status_code, 404)
        self.assertEqual(self.put("CONTACT", {"WHY.0.title": "x"}).status_code, 400)  # wrong section
        self.assertEqual(self.put("CONTACT", {"CONTACT.href": "javascript:alert(1)"}).status_code, 400)
        self.assertEqual(self.put("CONTACT", {"CONTACT.image": "javascript:alert(1)"}).status_code, 400)
        self.assertEqual(self.put("CONTACT", {"CONTACT.bad path": "x"}).status_code, 400)
        self.assertEqual(self.put("CONTACT", {"CONTACT.href": "https://example.com", "CONTACT.image": "/images/a.png"}).status_code, 200)

    def test_requires_staff(self):
        self.assertIn(self.put("CONTACT", {}).status_code, (401, 403))


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())  # uploads from the tests never touch backend/media
class MediaTests(BaseTest):
    def upload(self, data=PNG, name="Site Photo.png"):
        return self.client.post(
            "/api/admin/media/", {"file": SimpleUploadedFile(name, data, content_type="image/png")}, format="multipart"
        )

    def test_upload_list_and_delete(self):
        self.login_as_admin()
        res = self.upload()
        self.assertEqual(res.status_code, 201)
        media = res.json()["media"]
        self.assertTrue(media["url"].startswith("http"))
        self.assertIn("site-photo-", media["filename"])
        self.assertEqual(len(self.client.get("/api/admin/media/").json()["uploads"]), 1)
        self.assertEqual(self.client.delete(f"/api/admin/media/{media['id']}/").status_code, 200)
        self.assertEqual(MediaFile.objects.count(), 0)

    def test_rejects_non_images(self):
        self.login_as_admin()
        res = self.upload(data=b"<svg onload=alert(1)></svg>" + b" " * 20, name="x.png")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(MediaFile.objects.count(), 0)

    def test_cannot_delete_an_image_in_use(self):
        self.login_as_admin()
        media = self.upload().json()["media"]
        self.client.put("/api/admin/content/IMG/", {"changes": {"IMG.hero": media["url"]}}, format="json")
        res = self.client.delete(f"/api/admin/media/{media['id']}/")
        self.assertEqual(res.status_code, 409)
        self.assertEqual(MediaFile.objects.count(), 1)


class UserTests(BaseTest):
    def test_add_user_change_password_and_remove(self):
        me = make_admin()
        self.client.force_authenticate(user=me)

        res = self.client.post(
            "/api/admin/users/", {"name": "Bob", "email": "Bob@Example.com", "password": "another-long-pass"}, format="json"
        )
        self.assertEqual(res.status_code, 201)
        bob = get_user_model().objects.get(username="bob@example.com")
        self.assertTrue(bob.is_staff)
        self.assertEqual(self.client.post("/api/admin/users/", {"name": "B", "email": "bob@example.com", "password": "another-long-pass"}, format="json").status_code, 409)
        self.assertEqual(self.client.post("/api/admin/users/", {"name": "C", "email": "c@example.com", "password": "short"}, format="json").status_code, 400)

        self.assertEqual(self.client.delete(f"/api/admin/users/{me.id}/").status_code, 400)  # not yourself
        self.assertEqual(self.client.delete(f"/api/admin/users/{bob.id}/").status_code, 200)

        bad = self.client.post("/api/admin/password/", {"current": "wrong", "next": "a-brand-new-password"}, format="json")
        self.assertEqual(bad.status_code, 403)
        ok = self.client.post("/api/admin/password/", {"current": "correct-horse-battery", "next": "a-brand-new-password"}, format="json")
        self.assertEqual(ok.status_code, 200)
        me.refresh_from_db()
        self.assertTrue(me.check_password("a-brand-new-password"))

    def test_staff_cannot_remove_the_main_administrator(self):
        main = make_admin()
        helper = get_user_model().objects.create_user(username="h@example.com", password="x", is_staff=True)
        self.client.force_authenticate(user=helper)
        self.assertEqual(self.client.delete(f"/api/admin/users/{main.id}/").status_code, 403)
