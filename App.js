import React, { useEffect, useState } from 'react';

import {
  ActivityIndicator,
  NativeModules,
  StatusBar,
  View,
  Image,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import Onboarding from './src/Onboarding';

import PatientDetailsScreen from './src/screens/PatientDetailsScreen';

import ImageAnalysisScreen from './src/screens/ImageAnalysisScreen';

import AudioAnalysisScreen from './src/screens/AudioAnalysisScreen';
import AnalysisSelectionScreen from './src/screens/AnalysisSelectionScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import HomeScreen from './src/screens/HomeScreen';

import { DiagnosisProvider } from './src/context/DiagnosisContext';
import DisclaimerScreen from './src/screens/DisclaimerScreen';
import AppHeader from './src/components/AppHeader';

import { useDiagnosis } from './src/context/DiagnosisContext';
import ResultsScreen from './src/screens/ResultsScreen';

import { initializeDatabase } from './src/services/database';
import DiagnosisDetailsScreen from './src/screens/DiagnosisDetailsScreen';

const { AndroidTheme } = NativeModules;

import AuthScreen from './src/screens/AuthScreen';

function androidColorToHex(color) {
  const unsigned = color >>> 0;

  return `#${(unsigned & 0xffffff).toString(16).padStart(6, '0')}`;
}

function createColors(theme) {
  const dark = theme.isDark;

  return {
    primary: theme.primary,
    secondary: theme.secondary,
    tertiary: theme.tertiary,

    background: theme.background,

    surface: dark ? '#202124' : '#FFFFFF',

    surfaceContainer: dark ? '#292A2D' : '#F1F3F4',

    surfaceContainerHighest: dark ? '#333537' : '#E8EAED',

    surfaceContainerLow: dark ? '#242528' : '#F8F9FA',

    onSurface: theme.onBackground,

    onSurfaceVariant: dark ? '#C4C7C5' : '#5F6368',

    outline: dark ? '#444746' : '#DADCE0',

    outlineVariant: dark ? '#5F6368' : '#C4C7C5',

    primaryContainer: dark ? '#304B3A' : '#D9F2E2',

    onPrimaryContainer: dark ? '#B8F0C8' : '#12351E',

    onPrimary: '#FFFFFF',

    error: theme.error,

    errorContainer: dark ? '#5C2B2B' : '#F9DEDC',

    onErrorContainer: dark ? '#F9DEDC' : '#410E0B',
  };
}

function AppContent() {
  const [theme, setTheme] = useState(null);

  const [showOnboarding, setShowOnboarding] = useState(null);

  const [screen, setScreen] = useState('home');

  const { diagnosis } = useDiagnosis();

  const [selectedDiagnosisId, setSelectedDiagnosisId] = useState(null);

  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    initializeDatabase().catch(error => {
      console.error('DATABASE INITIALIZATION ERROR:', error);
    });
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('onboarding_complete').then(value => {
      setShowOnboarding(value !== 'true');
    });
  }, []);

  useEffect(() => {
    AndroidTheme.getTheme()
      .then(nativeTheme => {
        setTheme({
          primary: androidColorToHex(nativeTheme.primary),

          secondary: androidColorToHex(nativeTheme.secondary),

          tertiary: androidColorToHex(nativeTheme.tertiary),

          background: androidColorToHex(nativeTheme.background),

          onBackground: androidColorToHex(nativeTheme.onBackground),

          error: androidColorToHex(nativeTheme.error),

          isDark: nativeTheme.isDark,
        });
      })
      .catch(error => {
        console.error('Theme error:', error);
      });
  }, []);

  const completeOnboarding = async () => {
    await AsyncStorage.setItem('onboarding_complete', 'true');

    setShowOnboarding(false);

    // Start the actual diagnosis flow
    setScreen('disclaimer');
  };

  if (showOnboarding === null || theme === null) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: theme?.isDark ? '#202124' : '#FFFFFF',
        }}
      >
        <Image
          source={require('./assets/oralscan.png')}
          style={{
            width: 270,
            height: 270,
            resizeMode: 'contain',
          }}
        />
      </View>
    );
  }
  const colors = createColors(theme);

  if (showOnboarding) {
    return <Onboarding onComplete={completeOnboarding} />;
  }


  if (!authenticated) {
    return (
      <AuthScreen
        colors={colors}
        onAuthenticated={() => {
          setAuthenticated(true);
        }}
      />
    );
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
      }}
    >
      <StatusBar
        barStyle={theme.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
        translucent={false}
      />

      <View
        style={{
          marginTop: 30,
          marginBottom: -20,
          backgroundColor: colors.background,
        }}
      >
        <AppHeader colors={colors} />
      </View>
      {screen === 'disclaimer' && (
        <DisclaimerScreen
          colors={colors}
          onContinue={() => setScreen('patientDetails')}
        />
      )}

      {screen === 'patientDetails' && (
        <PatientDetailsScreen
          colors={colors}
          onContinue={() => setScreen('analysisSelection')}
          onBack={() => setScreen('disclaimer')}
        />
      )}

      {screen === 'home' && (
        <HomeScreen
          colors={colors}
          onImage={() => setScreen('image')}
          onAudio={() => setScreen('audio')}
          onStartDiagnosis={() => setScreen('disclaimer')}
          onHistory={() => setScreen('history')}
        />
      )}

      {screen === 'image' && (
        <ImageAnalysisScreen
          colors={colors}
          onAudio={() => {
            if (diagnosis.selectedAnalyses.audio) {
              setScreen('audio');
            } else {
              setScreen('results');
            }
          }}
          onHome={() => setScreen('home')}
          onComplete={() => {
            if (diagnosis.selectedAnalyses.audio) {
              setScreen('audio');
            } else {
              setScreen('results');
            }
          }}
        />
      )}

      {screen === 'audio' && (
        <AudioAnalysisScreen
          colors={colors}
          onComplete={() => {
            setScreen('results');
          }}
          onImage={() => setScreen('image')}
          onHome={() => setScreen('home')}
        />
      )}

      {screen === 'analysisSelection' && (
        <AnalysisSelectionScreen
          colors={colors}
          onBack={() => setScreen('patientDetails')}
          onStart={({ image, audio }) => {
            if (image) {
              setScreen('image');
            } else if (audio) {
              setScreen('audio');
            }
          }}
        />
      )}

      {screen === 'results' && (
        <ResultsScreen colors={colors} onHome={() => setScreen('home')} />
      )}

      {screen === 'history' && (
        <HistoryScreen
          colors={colors}
          onBack={() => setScreen('home')}
          onSelectDiagnosis={diagnosis => {
            setSelectedDiagnosisId(diagnosis.id);
            setScreen('diagnosisDetails');
          }}
        />
      )}

      {screen === 'diagnosisDetails' && (
        <DiagnosisDetailsScreen
          colors={colors}
          diagnosisId={selectedDiagnosisId}
          onBack={() => setScreen('history')}
        />
      )}
    </View>
  );
}

export default function App() {
  return (
    <DiagnosisProvider>
      <AppContent />
    </DiagnosisProvider>
  );
}
