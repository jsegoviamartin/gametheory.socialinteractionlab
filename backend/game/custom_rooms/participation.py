import random

from django.db import transaction
from rest_framework.exceptions import PermissionDenied, ValidationError

from .models import (
    CustomCommonPool, CustomExperiment, CustomPrisoner, CustomPublicGoods,
    CustomUltimatum, ExperimentParticipation,
)


CONDITION_MODELS = {
    'prisoner': CustomPrisoner,
    'ultimatum': CustomUltimatum,
    'public_goods': CustomPublicGoods,
    'common_pool': CustomCommonPool,
}


def get_assigned_condition(experiment, player_fingerprint, requested_condition_id=None, game_type=None):
    if game_type is not None and experiment.game_type != game_type:
        raise ValidationError('This experiment uses a different game type.')

    participation = ExperimentParticipation.objects.filter(
        experiment=experiment, player_fingerprint=player_fingerprint,
    ).first()
    if participation is None:
        raise PermissionDenied('Please accept the consent form before joining this experiment.')

    if requested_condition_id is not None and str(requested_condition_id) != str(participation.condition_id):
        raise ValidationError('You can only play your assigned condition.')

    condition = CONDITION_MODELS[experiment.game_type].objects.filter(
        experiment=experiment, id=participation.condition_id,
    ).first()
    if condition is None:
        raise ValidationError('Your assigned condition is no longer available. Please contact the researcher.')
    return condition


@transaction.atomic
def accept_and_assign(experiment, player_fingerprint):
    # Serialize simultaneous acceptance requests so retries keep the first assignment.
    experiment = CustomExperiment.objects.select_for_update().get(id=experiment.id)
    if not hasattr(experiment, 'consent_form'):
        raise ValidationError('This experiment does not have a consent form configured.')

    if ExperimentParticipation.objects.filter(
        experiment=experiment, player_fingerprint=player_fingerprint,
    ).exists():
        return get_assigned_condition(experiment, player_fingerprint)

    condition_ids = list(CONDITION_MODELS[experiment.game_type].objects.filter(
        experiment=experiment,
    ).values_list('id', flat=True))
    if not condition_ids:
        raise ValidationError('No conditions are available for this experiment.')

    ExperimentParticipation.objects.create(
        experiment=experiment,
        player_fingerprint=player_fingerprint,
        condition_id=random.choice(condition_ids),
    )
    return get_assigned_condition(experiment, player_fingerprint)
