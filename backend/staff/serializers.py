from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import ProfessionalProfile
from users.serializers import UserSerializer

User = get_user_model()


class ProfessionalSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source='user',
        write_only=True,
    )

    class Meta:
        model = ProfessionalProfile
        fields = [
            'id',
            'user',
            'user_id',
            'specialty',
            'license_number',
            'bio',
            'working_days',
            'start_hour',
            'end_hour',
        ]

