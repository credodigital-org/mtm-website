import json

from django.db import models


class SiteContent(models.Model):
    """One row per website field the admin has changed, e.g.
    path = "CONTACT_PAGE.hero.titleTop", value = JSON text of the new value.
    Anything without a row falls back to the defaults in frontend/src/data.js."""

    path = models.CharField(max_length=200, unique=True)
    value = models.TextField(help_text="JSON-encoded value")
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.CharField(max_length=254, blank=True)

    class Meta:
        ordering = ["path"]
        verbose_name = "content override"
        verbose_name_plural = "content overrides"

    def __str__(self):
        return self.path

    @property
    def data(self):
        return json.loads(self.value)


class Enquiry(models.Model):
    """A message sent from the website's contact form."""

    class Status(models.TextChoices):
        NEW = "new", "New"
        IN_PROGRESS = "in_progress", "In progress"
        DONE = "done", "Done"
        SPAM = "spam", "Spam"

    name = models.CharField(max_length=120)
    email = models.EmailField(max_length=200)
    phone = models.CharField(max_length=40)
    type = models.CharField("project type", max_length=80, blank=True)
    message = models.TextField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.NEW, db_index=True)
    notes = models.TextField(blank=True)
    ip = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-id"]
        verbose_name = "enquiry"
        verbose_name_plural = "enquiries"

    def __str__(self):
        return f"{self.name} ({self.created_at:%Y-%m-%d})"


class MediaFile(models.Model):
    """An image uploaded in the admin (stored on Cloudflare R2 in production)."""

    file = models.FileField(upload_to="uploads/")
    original = models.CharField(max_length=120)
    mime = models.CharField(max_length=40)
    size = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-id"]
        verbose_name = "uploaded image"
        verbose_name_plural = "uploaded images"

    def __str__(self):
        return self.original
