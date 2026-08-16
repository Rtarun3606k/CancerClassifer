import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  Pressable,
  Image,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  NativeModules,
} from 'react-native';

const slides = [
  {
    type: 'welcome',
    title: 'Welcome to OralScan',
    text: 'AI-powered oral image analysis designed to provide an on-device model prediction.',
    button: 'Next',
  },
  {
    type: 'warning',
    title: 'Important information',
    text: 'OralScan provides an AI-generated prediction for research and demonstration purposes. It is not a medical diagnosis.',
    secondary:
      'Always consult a qualified medical professional for proper evaluation and diagnosis.',
    button: 'I Understand',
  },
  {
    type: 'ready',
    title: "You're ready",
    text: 'Select an oral image from your gallery and let OralScan analyze it directly on your device.',
    button: 'Get Started',
  },
];

const { AndroidTheme } = NativeModules;

function androidColorToHex(color) {
  const unsigned = color >>> 0;
  return `#${(unsigned & 0xffffff).toString(16).padStart(6, '0')}`;
}

export default function Onboarding({ onComplete }) {
  const [current, setCurrent] = useState(0);
  const [theme, setTheme] = useState(null);

  useEffect(() => {
    AndroidTheme.getTheme()
      .then(nativeTheme => {
        setTheme({
          primary: androidColorToHex(nativeTheme.primary),
          primaryContainer: androidColorToHex(nativeTheme.primaryContainer),
          onPrimary: androidColorToHex(nativeTheme.onPrimary),
          background: androidColorToHex(nativeTheme.background),
          onBackground: androidColorToHex(nativeTheme.onBackground),
          surface: androidColorToHex(nativeTheme.surface),
          onSurface: androidColorToHex(nativeTheme.onSurface),
          onSurfaceVariant: androidColorToHex(nativeTheme.onSurfaceVariant),
          error: androidColorToHex(nativeTheme.error),
          errorContainer: androidColorToHex(nativeTheme.errorContainer),
          onErrorContainer: androidColorToHex(nativeTheme.onErrorContainer),
        });
      })
      .catch(error => {
        console.error('Onboarding theme error:', error);
      });
  }, []);

  const slide = slides[current];
  const next = () => {
    if (current === slides.length - 1) {
      onComplete();
      return;
    }

    setCurrent(current + 1);
  };

  if (!theme) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        {
          backgroundColor: theme.background,
        },
      ]}
    >
      <StatusBar
  barStyle={theme.isDark ? 'light-content' : 'dark-content'}
  backgroundColor={theme.background}
  translucent={false}
/>

      <View style={styles.container}>
        {/* Progress */}
        <View style={styles.progressContainer}>
          {slides.map((_, index) => (
            <View
              key={index}
              style={[
                styles.progress,
                {
                  backgroundColor:
                    index === current ? theme.primary : theme.surface,
                },
              ]}
            />
          ))}
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Welcome icon */}
          {slide.type === 'welcome' && (
            <View
              style={[
                styles.iconContainer,
                {
                  backgroundColor: theme.surface,
                },
              ]}
            >
              <Image
                source={require('../oralscan.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
          )}

          {/* Ready icon */}
          {slide.type === 'ready' && (
            <View
              style={[
                styles.smallIconContainer,
                {
                  backgroundColor: theme.surface,
                },
              ]}
            >
              <Image
                source={require('../oralscan.png')}
                style={styles.smallLogo}
                resizeMode="contain"
              />
            </View>
          )}

          {/* Warning */}
          {slide.type === 'warning' && (
            <View
              style={[
                styles.warningIcon,
                {
                  backgroundColor: theme.errorContainer,
                },
              ]}
            >
              <Text
                style={[
                  styles.warningIconText,
                  {
                    color: 'white',
                  },
                ]}
              >
                !
              </Text>
            </View>
          )}

          {/* Title */}
          <Text
            style={[
              styles.title,
              {
                color: theme.onBackground,
              },
            ]}
          >
            {slide.title}
          </Text>

          {/* Description */}
          <Text
            style={[
              styles.text,
              {
                color: theme.onSurfaceVariant,
              },
            ]}
          >
            {slide.text}
          </Text>

          {/* Warning notice */}
          {slide.secondary && (
            <View
              style={[
                styles.notice,
                {
                  backgroundColor: theme.errorContainer,
                },
              ]}
            >
              <Text
                style={[
                  styles.noticeText,
                  {
                    color: theme.onErrorContainer,
                  },
                ]}
              >
                {slide.secondary}
              </Text>
            </View>
          )}
        </View>

        {/* Bottom */}
        <View style={styles.bottom}>
          {/* Skip */}
          {current < slides.length - 1 && (
            <Pressable onPress={onComplete} style={styles.skipButton}>
              <Text
                style={[
                  styles.skipText,
                  {
                    color: theme.onSurfaceVariant,
                  },
                ]}
              >
                Skip
              </Text>
            </Pressable>
          )}

          {/* Main button */}
          <Pressable
            onPress={next}
            style={({ pressed }) => [
              styles.button,
              {
                backgroundColor: theme.primary,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.buttonText,
                {
                  color: theme.onPrimary,
                },
              ]}
            >
              {slide.button}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  safeArea: {
    flex: 1,
  },

  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 24,
  },

  progressContainer: {
    flexDirection: 'row',
    gap: 6,
  },

  progress: {
    height: 4,
    flex: 1,
    borderRadius: 4,
  },

  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 30,
  },

  iconContainer: {
    width: 190,
    height: 190,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 45,

    elevation: 4,

    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 15,
    shadowOffset: {
      width: 0,
      height: 5,
    },
  },

  logo: {
    width: 145,
    height: 145,
  },

  smallIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },

  smallLogo: {
    width: 90,
    height: 90,
  },

  warningIcon: {
    width: 100,
    height: 100,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },

  warningIconText: {
    fontSize: 52,
    fontWeight: '800',
  },

  title: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.7,
    textAlign: 'center',
  },

  text: {
    marginTop: 14,
    maxWidth: 340,
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
  },

  notice: {
    marginTop: 20,
    maxWidth: 350,
    padding: 16,
    borderRadius: 18,
  },

  noticeText: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    fontWeight: '600',
  },

  bottom: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  skipButton: {
    paddingHorizontal: 12,
    height: 56,
    justifyContent: 'center',
  },

  skipText: {
    fontSize: 15,
    fontWeight: '600',
  },

  button: {
    flex: 1,
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },

  buttonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
