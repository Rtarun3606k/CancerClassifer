import React, {
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  NativeModules,
  StatusBar,
  View,
} from 'react-native';

import AsyncStorage from
  '@react-native-async-storage/async-storage';

import Onboarding from './src/Onboarding';

import ImageAnalysisScreen
  from './src/screens/ImageAnalysisScreen';

import AudioAnalysisScreen
  from './src/screens/AudioAnalysisScreen';

const {
  AndroidTheme,
} = NativeModules;

function androidColorToHex(color) {
  const unsigned =
    color >>> 0;

  return `#${(
    unsigned & 0xffffff
  )
    .toString(16)
    .padStart(6, '0')}`;
}

function createColors(theme) {
  const dark = theme.isDark;

  return {
    primary: theme.primary,
    secondary: theme.secondary,
    tertiary: theme.tertiary,

    background:
      theme.background,

    surface:
      dark
        ? '#202124'
        : '#FFFFFF',

    surfaceContainer:
      dark
        ? '#292A2D'
        : '#F1F3F4',

    onSurface:
      theme.onBackground,

    onSurfaceVariant:
      dark
        ? '#C4C7C5'
        : '#5F6368',

    outline:
      dark
        ? '#444746'
        : '#DADCE0',

    primaryContainer:
      dark
        ? '#304B3A'
        : '#D9F2E2',

    onPrimaryContainer:
      dark
        ? '#B8F0C8'
        : '#12351E',

    onPrimary: '#FFFFFF',

    error: theme.error,

    errorContainer:
      dark
        ? '#5C2B2B'
        : '#F9DEDC',

    onErrorContainer:
      dark
        ? '#F9DEDC'
        : '#410E0B',
  };
}

export default function App() {
  const [theme, setTheme] =
    useState(null);

  const [showOnboarding, setShowOnboarding] =
    useState(null);

  const [screen, setScreen] =
    useState('image');

  useEffect(() => {
    AsyncStorage
      .getItem('onboarding_complete')
      .then(value => {
        setShowOnboarding(
          value !== 'true',
        );
      });
  }, []);

  useEffect(() => {
    AndroidTheme
      .getTheme()
      .then(nativeTheme => {
        setTheme({
          primary:
            androidColorToHex(
              nativeTheme.primary,
            ),

          secondary:
            androidColorToHex(
              nativeTheme.secondary,
            ),

          tertiary:
            androidColorToHex(
              nativeTheme.tertiary,
            ),

          background:
            androidColorToHex(
              nativeTheme.background,
            ),

          onBackground:
            androidColorToHex(
              nativeTheme.onBackground,
            ),

          error:
            androidColorToHex(
              nativeTheme.error,
            ),

          isDark:
            nativeTheme.isDark,
        });
      })
      .catch(error => {
        console.error(
          'Theme error:',
          error,
        );
      });
  }, []);

  const completeOnboarding =
    async () => {
      await AsyncStorage.setItem(
        'onboarding_complete',
        'true',
      );

      setShowOnboarding(false);
    };

  if (
    showOnboarding === null ||
    theme === null
  ) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent:
            'center',
          alignItems:
            'center',
        }}
      >
        <ActivityIndicator />
      </View>
    );
  }

  if (showOnboarding) {
    return (
      <Onboarding
        onComplete={
          completeOnboarding
        }
      />
    );
  }

  const colors =
    createColors(theme);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor:
          colors.background,
      }}
    >
      <StatusBar
        barStyle={
          theme.isDark
            ? 'light-content'
            : 'dark-content'
        }
        backgroundColor={
          theme.background
        }
        translucent={false}
      />

      {screen === 'image' ? (
        <ImageAnalysisScreen
          colors={colors}
          onAudio={() =>
            setScreen('audio')
          }
        />
      ) : (
        <AudioAnalysisScreen
          colors={colors}
          onImage={() =>
            setScreen('image')
          }
        />
      )}
    </View>
  );
}
