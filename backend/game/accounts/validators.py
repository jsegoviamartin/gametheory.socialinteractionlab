from django.core.exceptions import ValidationError
from django.utils.translation import gettext as _

class DifferentPasswordValidator:
    """
    Validate that the new password is not the same as the old password.
    """
    def validate(self, password, user=None):
        if user and user.check_password(password):
            raise ValidationError(
                _("Your new password must be different from your previous password."),
                code='password_not_different',
            )

    def get_help_text(self):
        return _("Your new password must be different from your previous password.")
