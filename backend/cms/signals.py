"""Keep storage (local disk or Cloudflare R2) tidy: when an uploaded image's record is
deleted (from the admin panel or from Django's own admin) its file is removed too."""

from django.db import transaction
from django.db.models.signals import post_delete
from django.dispatch import receiver

from .models import MediaFile


@receiver(post_delete, sender=MediaFile)
def delete_file_with_record(sender, instance, **kwargs):
    stored = instance.file
    if stored and stored.name:
        name, storage = stored.name, stored.storage
        transaction.on_commit(lambda: storage.delete(name))
