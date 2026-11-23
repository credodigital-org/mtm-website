import getpass

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = (
        "Creates the main administrator who signs in at /admin on the website "
        "(or resets that person's password if the e-mail already exists)."
    )

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True, help="Login e-mail address")
        parser.add_argument("--name", default="Administrator", help="Display name")
        parser.add_argument("--password", help="Leave out to be asked for it (recommended)")

    def handle(self, *args, **options):
        User = get_user_model()
        email = options["email"].strip().lower()
        if "@" not in email:
            raise CommandError("Enter a valid e-mail address.")

        password = options["password"]
        if not password:
            password = getpass.getpass("Password (min. 10 characters): ")
            if password != getpass.getpass("Repeat password: "):
                raise CommandError("The passwords do not match.")
        try:
            validate_password(password)
        except ValidationError as exc:
            raise CommandError(" ".join(exc.messages))

        user, created = User.objects.get_or_create(
            username=email, defaults={"email": email, "first_name": options["name"]}
        )
        user.email = email
        user.is_staff = True
        user.is_superuser = True
        user.is_active = True
        user.set_password(password)
        user.save()
        self.stdout.write(self.style.SUCCESS(f"{'Created' if created else 'Updated'} administrator {email}"))
