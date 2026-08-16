import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function ProbabilityBar({ label, value, colors }) {
  const percentage = value * 100;

  return (
    <View style={styles.probabilityRow}>
      <View style={styles.probabilityTop}>
        <Text
          style={[
            styles.probabilityLabel,
            {
              color: colors.onSurface,
            },
          ]}
        >
          {label}
        </Text>

        <Text
          style={[
            styles.probabilityValue,
            {
              color: colors.onSurfaceVariant,
            },
          ]}
        >
          {percentage.toFixed(1)}%
        </Text>
      </View>

      <View
        style={[
          styles.barBackground,
          {
            backgroundColor: colors.surfaceContainer,
          },
        ]}
      >
        <View
          style={[
            styles.barFill,
            {
              width: `${percentage}%`,
              backgroundColor: colors.primary,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  probabilityRow: {
    marginBottom: 17,
  },

  probabilityTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  probabilityLabel: {
    fontSize: 12,
    fontWeight: '700',
  },

  probabilityValue: {
    fontSize: 12,
    fontWeight: '600',
  },

  barBackground: {
    height: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },

  barFill: {
    height: '100%',
    borderRadius: 8,
  },
});
