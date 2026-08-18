import React, { useEffect, useState } from 'react';

import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  authenticateWithDevice,
  canUseDeviceAuthentication,
} from '../services/authService';

export default function AuthScreen({ colors, onAuthenticated }) {
  const [checking, setChecking] = useState(true);

  const [deviceAuthAvailable, setDeviceAuthAvailable] = useState(false);

  const [authenticating, setAuthenticating] = useState(false);

  const [passwordMode, setPasswordMode] = useState(false);

  const [password, setPassword] = useState('');

  const [error, setError] = useState(null);

  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    try {
      setChecking(true);
      setError(null);

      const available = await canUseDeviceAuthentication();

      setDeviceAuthAvailable(available);

      if (available) {
        await handleDeviceAuthentication();
      } else {
        setPasswordMode(true);
      }
    } catch (error) {
      console.error('AUTH CHECK ERROR:', error);

      setDeviceAuthAvailable(false);
      setPasswordMode(true);
    } finally {
      setChecking(false);
    }
  };

  const handleDeviceAuthentication = async () => {
    try {
      setAuthenticating(true);
      setError(null);

      await authenticateWithDevice();

      onAuthenticated();
    } catch (error) {
      console.error('DEVICE AUTH ERROR:', error);

      /*
       * Android may return here when the
       * biometric prompt is cancelled.
       *
       * Don't immediately force the user
       * into the app password if the device
       * credential option is available.
       */

      setError('Authentication was cancelled.');
    } finally {
      setAuthenticating(false);
    }
  };

  const handlePasswordLogin = () => {
    setError(null);

    /*
     * TEMPORARY:
     * This is where the secure password
     * verification will go.
     *
     * Do NOT hardcode the final password here.
     */

    if (!password) {
      setError('Enter your OSCC password.');
      return;
    }

    setError('Password authentication is not configured yet.');
  };

  if (checking) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.onBackground,
          },
        ]}
      >
        <ActivityIndicator size="large" color={colors.primary} />

        <Text
          style={[
            styles.loadingText,
            {
              color: colors.onSurfaceVariant,
            },
          ]}
        >
          Securing OSCC...
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
        },
      ]}
    >
      {/* Logo */}

      <View
        style={[
          styles.logo,
          {
            backgroundColor: colors.primaryContainer,
          },
        ]}
      >
        <Text
          style={[
            styles.logoText,
            {
              color: colors.onPrimaryContainer,
            },
          ]}
        >
          OS
        </Text>
      </View>

      <Text
        style={[
          styles.title,
          {
            color: colors.onBackground,
          },
        ]}
      >
        Welcome to OSCC
      </Text>

      <Text
        style={[
          styles.subtitle,
          {
            color: colors.onSurfaceVariant,
          },
        ]}
      >
        Authenticate to access patient data and diagnosis history.
      </Text>

      {/* Device authentication */}

      {deviceAuthAvailable && !passwordMode && (
        <>
          <Pressable
            onPress={handleDeviceAuthentication}
            disabled={authenticating}
            style={({ pressed }) => [
              styles.primaryButton,
              {
                backgroundColor: colors.primary,
                opacity: pressed || authenticating ? 0.8 : 1,
              },
            ]}
          >
            {authenticating ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text
                style={[
                  styles.primaryButtonText,
                  {
                    color: colors.onPrimary,
                  },
                ]}
              >
                Unlock with Biometrics
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => setPasswordMode(true)}
            style={styles.linkButton}
          >
            <Text
              style={[
                styles.linkText,
                {
                  color: colors.primary,
                },
              ]}
            >
              Use OSCC password
            </Text>
          </Pressable>
        </>
      )}

      {/* Password */}

      {passwordMode && (
        <View style={styles.passwordSection}>
          <Text
            style={[
              styles.inputLabel,
              {
                color: colors.onSurface,
              },
            ]}
          >
            OSCC Password
          </Text>

          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Enter password"
            placeholderTextColor={colors.onSurfaceVariant}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            style={[
              styles.input,
              {
                color: colors.onSurface,
                backgroundColor: colors.surface,
                borderColor: colors.outlineVariant,
              },
            ]}
          />

          <Pressable
            onPress={handlePasswordLogin}
            style={({ pressed }) => [
              styles.primaryButton,
              {
                backgroundColor: colors.primary,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.primaryButtonText,
                {
                  color: colors.onPrimary,
                },
              ]}
            >
              Unlock
            </Text>
          </Pressable>

          {deviceAuthAvailable && (
            <Pressable
              onPress={() => setPasswordMode(false)}
              style={styles.linkButton}
            >
              <Text
                style={[
                  styles.linkText,
                  {
                    color: colors.primary,
                  },
                ]}
              >
                Use device authentication
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {error && (
        <Text
          style={[
            styles.error,
            {
              color: colors.error,
            },
          ]}
        >
          {error}
        </Text>
      )}

      <Text
        style={[
          styles.securityText,
          {
            color: colors.onSurfaceVariant,
          },
        ]}
      >
        Patient data is protected by device authentication.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },

  logo: {
    width: 86,
    height: 86,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },

  logoText: {
    fontSize: 28,
    fontWeight: '800',
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },

  subtitle: {
    marginTop: 10,
    maxWidth: 320,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },

  loadingText: {
    marginTop: 15,
    fontSize: 14,
  },

  primaryButton: {
    width: '100%',
    minHeight: 52,
    marginTop: 30,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  primaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },

  linkButton: {
    paddingVertical: 16,
    paddingHorizontal: 12,
  },

  linkText: {
    fontSize: 14,
    fontWeight: '600',
  },

  passwordSection: {
    width: '100%',
    marginTop: 25,
  },

  inputLabel: {
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '600',
  },

  input: {
    height: 56,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    fontSize: 16,
  },

  error: {
    marginTop: 16,
    fontSize: 13,
    textAlign: 'center',
  },

  securityText: {
    position: 'absolute',
    bottom: 30,
    fontSize: 11,
    textAlign: 'center',
  },
});
