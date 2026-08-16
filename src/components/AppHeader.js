import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
} from 'react-native';

export default function AppHeader({
  colors,
  title = 'OralScan',
  subtitle = 'AI-powered oral analysis',
  status = 'READY',
}) {
  return (
    <View style={styles.header}>
      <View>
        <View style={styles.brandRow}>
          <View style={styles.brandIcon}>
            <Image
              source={require('../../oralscan.png')}
              style={styles.brandIconImage}
              resizeMode="contain"
            />
          </View>

          <Text
            style={[
              styles.title,
              { color: colors.onBackground },
            ]}
          >
            {title}
          </Text>
        </View>

        <Text
          style={[
            styles.subtitle,
            { color: colors.onSurfaceVariant },
          ]}
        >
          {subtitle}
        </Text>
      </View>

      <View
        style={[
          styles.status,
          {
            backgroundColor:
              colors.primaryContainer,
          },
        ]}
      >
        <View
          style={[
            styles.statusDot,
            {
              backgroundColor:
                colors.primary,
            },
          ]}
        />

        <Text
          style={[
            styles.statusText,
            {
              color: colors.primary,
            },
          ]}
        >
          {status}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
  },

  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  brandIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },

  brandIconImage: {
    width: 42,
    height: 42,
  },

  title: {
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -0.7,
  },

  subtitle: {
    marginTop: 5,
    marginLeft: 48,
    fontSize: 13,
  },

  status: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },

  statusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
