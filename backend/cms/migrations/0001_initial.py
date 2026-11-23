from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="SiteContent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("path", models.CharField(max_length=200, unique=True)),
                ("value", models.TextField(help_text="JSON-encoded value")),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("updated_by", models.CharField(blank=True, max_length=254)),
            ],
            options={
                "verbose_name": "content override",
                "verbose_name_plural": "content overrides",
                "ordering": ["path"],
            },
        ),
        migrations.CreateModel(
            name="Enquiry",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120)),
                ("email", models.EmailField(max_length=200)),
                ("phone", models.CharField(max_length=40)),
                ("type", models.CharField(blank=True, max_length=80, verbose_name="project type")),
                ("message", models.TextField()),
                (
                    "status",
                    models.CharField(
                        choices=[("new", "New"), ("in_progress", "In progress"), ("done", "Done"), ("spam", "Spam")],
                        db_index=True,
                        default="new",
                        max_length=20,
                    ),
                ),
                ("notes", models.TextField(blank=True)),
                ("ip", models.CharField(blank=True, max_length=64)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "enquiry",
                "verbose_name_plural": "enquiries",
                "ordering": ["-id"],
            },
        ),
        migrations.CreateModel(
            name="MediaFile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("file", models.FileField(upload_to="uploads/")),
                ("original", models.CharField(max_length=120)),
                ("mime", models.CharField(max_length=40)),
                ("size", models.PositiveIntegerField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "verbose_name": "uploaded image",
                "verbose_name_plural": "uploaded images",
                "ordering": ["-id"],
            },
        ),
    ]
