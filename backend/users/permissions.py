from django.contrib.auth import get_user_model
from rest_framework import permissions

User = get_user_model()


class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == User.Roles.ADMIN
        )


class IsProfessionalOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in [User.Roles.PROFESSIONAL, User.Roles.ADMIN]
        )

