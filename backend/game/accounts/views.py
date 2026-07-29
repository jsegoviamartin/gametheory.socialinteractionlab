from django.shortcuts import render
from rest_framework import generics, permissions, status, serializers
from rest_framework.response import Response
from django.contrib.auth.models import User
from .serializers import UserSerializer, RegisterSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django_otp import devices_for_user
from two_factor.utils import default_device

class TwoFactorTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        print(f"DEBUG: Validating login for data: {self.initial_data}")
        # We don't call super().validate(attrs) yet because it issues tokens
        # We handle authentication manually first
        from django.contrib.auth import authenticate
        user = authenticate(username=attrs[self.username_field], password=attrs['password'])
        
        if not user:
            raise serializers.ValidationError('No active account found with the given credentials')

        device = default_device(user)
        otp_token = self.initial_data.get('otp_token')

        import sys
        if device:
            sys.stderr.write(f"DEBUG: 2FA required for user {user.username}. Device: {device}\n")
            if not otp_token:
                # Signal that 2FA is required
                raise serializers.ValidationError({
                    'mfa_required': True,
                    'user_id': user.id
                })
            
            # Ensure it's a string
            otp_token = str(otp_token).strip()
            verified = device.verify_token(otp_token)
            sys.stderr.write(f"DEBUG: Received token: [{otp_token}]. Verified: {verified}\n")
            if not verified:
                raise serializers.ValidationError({'otp_token': 'Invalid 2FA code'})
        else:
            # User hasn't set up 2FA yet
            # We can either force them now or just warn them
            # The user wants "after login or register it requires him to setup 2fa"
            # So we flag that setup is required
            pass

        # If we reach here, either 2FA is verified or not set up
        data = super().validate(attrs)
        data['mfa_setup_required'] = device is None
        sys.stderr.write(f"DEBUG: MFA setup required for {user.username}: {data['mfa_setup_required']}\n")
        return data

from django.contrib import auth

class TwoFactorTokenObtainPairView(TokenObtainPairView):
    serializer_class = TwoFactorTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        try:
            # We must validate here to get the user object for session sync
            serializer.is_valid(raise_exception=True)
            user = serializer.user # TokenObtainPairSerializer sets this
            
            # Synchronize Django session with JWT user
            auth.logout(request) # Clear any old session
            auth.login(request, user)
            
            # Now return the tokens
            return Response(serializer.validated_data, status=status.HTTP_200_OK)
            
        except serializers.ValidationError as e:
            if isinstance(e.detail, dict) and e.detail.get('mfa_required'):
                # We still need to sync the session even if MFA is required 
                # but not yet verified, because the setup wizard needs it.
                # However, for security, we only do this if password is valid.
                from django.contrib.auth import authenticate
                user = authenticate(
                    username=request.data.get('username'), 
                    password=request.data.get('password')
                )
                if user:
                    auth.logout(request)
                    auth.login(request, user)
                return Response(e.detail, status=status.HTTP_200_OK)
            return Response(e.detail, status=status.HTTP_401_UNAUTHORIZED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_401_UNAUTHORIZED)

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (permissions.AllowAny,)
    serializer_class = RegisterSerializer

    def perform_create(self, serializer):
        super().perform_create(serializer)
        try:
            from game.exports import export_registered_users
            export_registered_users()
        except Exception as e:
            import sys
            sys.stderr.write(f"Error exporting registered users: {e}\n")

class UserView(generics.RetrieveAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


