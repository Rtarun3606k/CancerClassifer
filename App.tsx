import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  Button,
  Image,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';

import { classifyImage } from './src/ml/model';

export default function App() {
  const [imageUri, setImageUri] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    const response = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
    });

    if (response.didCancel || !response.assets?.length) {
      return;
    }

    const uri = response.assets[0].uri;

    setImageUri(uri);
    setResult(null);
    setLoading(true);

    try {
      const prediction = await classifyImage(uri);
      setResult(prediction);
    } catch (error) {
      console.error('Classification error:', error);
      setResult({
        error: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Oral Cancer Classifier</Text>

      <Button title="Choose Image" onPress={pickImage} />

      {imageUri && (
        <Image
          source={{ uri: imageUri }}
          style={styles.image}
          resizeMode="contain"
        />
      )}

      {loading && <ActivityIndicator size="large" />}

      {result && !result.error && (
        <View style={styles.result}>
          <Text style={styles.resultTitle}>Result</Text>

          <Text style={styles.label}>{result.className}</Text>

          <Text>Probability: {(result.probability * 100).toFixed(2)}%</Text>
        </View>
      )}

      {result?.error && <Text style={styles.error}>Error: {result.error}</Text>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },

  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 30,
  },

  image: {
    width: 300,
    height: 300,
    marginTop: 30,
  },

  result: {
    marginTop: 30,
    alignItems: 'center',
  },

  resultTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },

  label: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 10,
  },

  error: {
    marginTop: 20,
    color: 'red',
  },
});
