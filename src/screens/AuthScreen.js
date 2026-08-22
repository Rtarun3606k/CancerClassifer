import React, { useEffect, useState } from 'react';

import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Image,
  ScrollView,
} from 'react-native';

import {
  authenticateWithDevice,
  canUseDeviceAuthentication,
  hasPassword,
  setPassword,
  verifyPassword,
} from '../services/authService';

export default function AuthScreen({ colors, onAuthenticated }) {
  const [loading, setLoading] = useState(true);

  const [deviceAuthAvailable, setDeviceAuthAvailable] = useState(false);

  const [passwordExists, setPasswordExists] = useState(false);

  const [mode, setMode] = useState(null);

  const [password, setPasswordValue] = useState('');

  const [confirmPassword, setConfirmPassword] = useState('');

  const [busy, setBusy] = useState(false);

  const [error, setError] = useState(null);

  const FORCE_PASSWORD_TEST = false;

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      setLoading(true);
      setError(null);

      if (FORCE_PASSWORD_TEST) {
        const exists = await hasPassword();

        setPasswordExists(exists);
        setMode(exists ? 'password' : 'setup');

        return;
      }

      const deviceAvailable = await canUseDeviceAuthentication();

      setDeviceAuthAvailable(deviceAvailable);

      if (deviceAvailable) {
        setMode('device');
        await authenticateDevice();
        return;
      }

      const exists = await hasPassword();

      setPasswordExists(exists);
      setMode(exists ? 'password' : 'setup');
    } catch (error) {
      console.error('AUTH INITIALIZATION ERROR:', error);
      setError('Unable to initialize security.');
    } finally {
      setLoading(false);
    }
  };

  const authenticateDevice = async () => {
    try {
      setBusy(true);
      setError(null);

      await authenticateWithDevice();

      onAuthenticated();
    } catch (error) {
      console.error('DEVICE AUTH ERROR:', error);

      setError(error?.message || 'Authentication cancelled or failed.');
    } finally {
      setBusy(false);
    }
  };

  const createPassword = async () => {
    setError(null);

    if (password.length < 6) {
      setError('Password must contain at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setBusy(true);

      await setPassword(password);

      setPasswordExists(true);

      setPasswordValue('');
      setConfirmPassword('');

      onAuthenticated();
    } catch (error) {
      console.error('PASSWORD SETUP ERROR:', error);

      setError(error?.message || 'Unable to create password.');
    } finally {
      setBusy(false);
    }
  };

  const loginWithPassword = async () => {
    setError(null);

    if (!password) {
      setError('Enter your password.');
      return;
    }

    try {
      setBusy(true);

      const valid = await verifyPassword(password);

      if (!valid) {
        setError('Incorrect password.');
        return;
      }

      setPasswordValue('');

      onAuthenticated();
    } catch (error) {
      console.error('PASSWORD LOGIN ERROR:', error);

      setError('Unable to verify password.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
          },
        ]}
      >
        <Image
          source={require('../../assets/oralscan.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />

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
    <ScrollView>
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
              backgroundColor: colors.background,
            },
          ]}
        >
          <Image
            source={require('../../assets/oralscan.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>

        {/* TITLE */}

        <Text
          style={[
            styles.title,
            {
              color: colors.onBackground,
            },
          ]}
        >
          OSCC
        </Text>

        <Text
          style={[
            styles.subtitle,
            {
              color: colors.onSurfaceVariant,
            },
          ]}
        >
          Patient data is protected. Authenticate to continue.
        </Text>

        {/* DEVICE AUTH */}

        {mode === 'device' && (
          <>
            <Pressable
              disabled={busy}
              onPress={authenticateDevice}
              style={({ pressed }) => [
                styles.primaryButton,
                {
                  backgroundColor: colors.primary,
                  opacity: pressed || busy ? 0.8 : 1,
                },
              ]}
            >
              {busy ? (
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
                  Unlock
                </Text>
              )}
            </Pressable>

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
                styles.hint,
                {
                  color: colors.onSurfaceVariant,
                },
              ]}
            >
              Use your fingerprint, face, or device PIN, pattern, or password.
            </Text>
          </>
        )}

        {/* PASSWORD SETUP */}

        {mode === 'setup' && (
          <View style={styles.form}>
            <Text
              style={[
                styles.formTitle,
                {
                  color: colors.onSurface,
                },
              ]}
            >
              Create OSCC Password
            </Text>

            <Text
              style={[
                styles.formSubtitle,
                {
                  color: colors.onSurfaceVariant,
                },
              ]}
            >
              Your device does not have a usable biometric or screen lock.
              Create a password to protect patient data.
            </Text>

            <TextInput
              value={password}
              onChangeText={setPasswordValue}
              placeholder="Password"
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

            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm password"
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
              disabled={busy}
              onPress={createPassword}
              style={[
                styles.primaryButton,
                {
                  backgroundColor: colors.primary,
                  opacity: busy ? 0.7 : 1,
                },
              ]}
            >
              {busy ? (
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
                  Create Password
                </Text>
              )}
            </Pressable>

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
          </View>
        )}

        {/* PASSWORD LOGIN */}

        {mode === 'password' && (
          <View style={styles.form}>
            <Text
              style={[
                styles.formTitle,
                {
                  color: colors.onSurface,
                  marginBottom: 10,
                },
              ]}
            >
              Enter OSCC Password
            </Text>

            <TextInput
              value={password}
              onChangeText={setPasswordValue}
              placeholder="Password"
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
              disabled={busy}
              onPress={loginWithPassword}
              style={[
                styles.primaryButton,
                {
                  backgroundColor: colors.primary,
                  opacity: busy ? 0.7 : 1,
                },
              ]}
            >
              {busy ? (
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
                  Unlock
                </Text>
              )}
            </Pressable>

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

            {deviceAuthAvailable && (
              <Pressable
                onPress={() => setMode('device')}
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

        <Text
          style={[
            styles.footer,
            {
              color: colors.onSurfaceVariant,
            },
          ]}
        >
          OSCC • Protected patient data
        </Text>
      </View>
    </ScrollView>
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
    marginBottom: 20,
  },

  logoText: {
    fontSize: 28,
    fontWeight: '800',
  },

  title: {
    fontSize: 30,
    fontWeight: '700',
  },

  subtitle: {
    marginTop: 8,
    maxWidth: 320,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },

  loadingText: {
    marginTop: 15,
    fontSize: 14,
  },

  form: {
    width: '100%',
    marginTop: 28,
  },

  formTitle: {
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'center',
  },

  formSubtitle: {
    marginTop: 8,
    marginBottom: 18,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },

  input: {
    height: 56,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 12,
  },

  primaryButton: {
    width: '100%',
    minHeight: 52,
    marginTop: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  primaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },

  linkButton: {
    alignItems: 'center',
    paddingVertical: 18,
  },

  linkText: {
    fontSize: 14,
    fontWeight: '600',
  },

  error: {
    marginTop: 14,
    fontSize: 13,
    textAlign: 'center',
  },

 hint: {
  marginTop: 18,
  paddingHorizontal: 20,
  fontSize: 12,
  lineHeight: 18,
  textAlign: 'center',
},

  footer: {
    marginTop: 28,
    marginBottom: 10,
    fontSize: 11,
    textAlign: 'center',
  },

  logo: {
    width: 100,
    height: 100,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },

  logoImage: {
    width: 90,
    height: 90,
    resizeMode: 'contain',
  },
});
