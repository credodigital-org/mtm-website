from django.apps import AppConfig


class CmsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "cms"
    verbose_name = "MTM website admin"

    def ready(self):
        from . import signals  # noqa: F401  (registers file-cleanup handler)
