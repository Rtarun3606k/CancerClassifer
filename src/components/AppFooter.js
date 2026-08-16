import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';

export default function AppFooter({ colors }) {
  return (
    <View
      style={[
        styles.disclaimer,
        {
          backgroundColor:
            colors.surfaceContainer,
        },
      ]}
    >
      <Text
        style={[
          styles.disclaimerTitle,
          {
            color: colors.onSurface,
          },
        ]}
      >
        For research purposes
      </Text>

      <Text
        style={[
          styles.disclaimerText,
          {
            color: colors.onSurfaceVariant,
          },
        ]}
      >
        This application provides an AI model
        prediction and is not a medical diagnosis.
        Consult a qualified healthcare professional
        for clinical evaluation.
      </Text>

      <Text
        style={[
          styles.footer,
          {
            color: colors.onSurfaceVariant,
          },
        ]}
      >
        AI-assisted • On-device inference
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  disclaimer: {
    marginTop: 20,
    padding: 17,
    borderRadius: 19,
  },

  disclaimerTitle: {
    fontSize: 13,
    fontWeight: '700',
  },

  disclaimerText: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
  },

  footer: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 11,
  },
});
