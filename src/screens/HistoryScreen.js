import React, { useEffect, useState } from 'react';

import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { getAllDiagnoses } from '../services/database';

export default function HistoryScreen({
  colors,
  onBack,
  onSelectDiagnosis,
}) {
  const [diagnoses, setDiagnoses] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = async () => {
    try {
      setLoading(true);

      const data = await getAllDiagnoses();

      setDiagnoses(data);
    } catch (error) {
      console.error('HISTORY ERROR:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const reportsCount = diagnoses.filter(
    item => item.report_path,
  ).length;

  const formatDate = value => {
    if (!value) return '';

    return new Date(value).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <View
        style={[
          styles.loading,
          {
            backgroundColor: colors.background,
          },
        ]}
      >
        <ActivityIndicator color={colors.primary} />
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
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}

        <Pressable
          onPress={onBack}
          style={styles.backButton}
        >
          <Text
            style={[
              styles.backText,
              {
                color: colors.primary,
              },
            ]}
          >
            ‹
          </Text>
        </Pressable>

        <Text
          style={[
            styles.eyebrow,
            {
              color: colors.onSurfaceVariant,
            },
          ]}
        >
          ORALSCAN
        </Text>

        <Text
          style={[
            styles.title,
            {
              color: colors.onBackground,
            },
          ]}
        >
          History
        </Text>

        <Text
          style={[
            styles.subtitle,
            {
              color: colors.onSurfaceVariant,
            },
          ]}
        >
          Previous screening sessions
        </Text>

        {/* Statistics */}

        <View style={styles.statsRow}>
          <StatCard
            value={diagnoses.length}
            label="Diagnoses"
            colors={colors}
          />

          <StatCard
            value={reportsCount}
            label="Reports"
            colors={colors}
          />
        </View>

        {/* Recent */}

        <Text
          style={[
            styles.sectionTitle,
            {
              color: colors.onSurfaceVariant,
            },
          ]}
        >
          RECENT
        </Text>

        {diagnoses.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.outlineVariant,
              },
            ]}
          >
            <Text
              style={[
                styles.emptyTitle,
                {
                  color: colors.onSurface,
                },
              ]}
            >
              No diagnoses yet
            </Text>

            <Text
              style={[
                styles.emptyText,
                {
                  color: colors.onSurfaceVariant,
                },
              ]}
            >
              Completed diagnoses will appear here.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {diagnoses.map(item => (
              <DiagnosisCard
                key={item.id}
                diagnosis={item}
                colors={colors}
                formatDate={formatDate}
                onPress={() =>
                  onSelectDiagnosis(item)
                }
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function StatCard({
  value,
  label,
  colors,
}) {
  return (
    <View
      style={[
        styles.statCard,
        {
          backgroundColor: colors.surfaceContainer,
        },
      ]}
    >
      <Text
        style={[
          styles.statValue,
          {
            color: colors.onSurface,
          },
        ]}
      >
        {value}
      </Text>

      <Text
        style={[
          styles.statLabel,
          {
            color: colors.onSurfaceVariant,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function DiagnosisCard({
  diagnosis,
  colors,
  formatDate,
  onPress,
}) {
  const hasImage =
    diagnosis.image_selected === 1;

  const hasAudio =
    diagnosis.audio_selected === 1;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.outlineVariant,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text
            style={[
              styles.patientName,
              {
                color: colors.onSurface,
              },
            ]}
            numberOfLines={1}
          >
            {diagnosis.patient_name ||
              'Unknown patient'}
          </Text>

          <Text
            style={[
              styles.date,
              {
                color: colors.onSurfaceVariant,
              },
            ]}
          >
            {formatDate(diagnosis.created_at)}
            {diagnosis.gender
              ? ` • ${diagnosis.gender}`
              : ''}
          </Text>
        </View>

        <Text
          style={[
            styles.arrow,
            {
              color: colors.onSurfaceVariant,
            },
          ]}
        >
          ›
        </Text>
      </View>

      <View
        style={[
          styles.divider,
          {
            backgroundColor:
              colors.outlineVariant,
          },
        ]}
      />

      {/* Analysis results */}

      <View style={styles.results}>
        {hasImage && (
          <Result
            label="IMAGE"
            value={
              diagnosis.image_prediction ||
              'Completed'
            }
            danger={
              diagnosis.image_prediction ===
              'CANCER'
            }
            colors={colors}
          />
        )}

        {hasAudio && (
          <Result
            label="VOICE"
            value={
              diagnosis.audio_prediction ||
              'Completed'
            }
            danger={
              diagnosis.audio_prediction ===
              'Vocal Pathology'
            }
            colors={colors}
          />
        )}
      </View>

      {/* Report */}

      {diagnosis.report_path && (
        <View
          style={[
            styles.reportBadge,
            {
              backgroundColor:
                colors.primaryContainer,
            },
          ]}
        >
          <View
            style={[
              styles.dot,
              {
                backgroundColor: colors.primary,
              },
            ]}
          />

          <Text
            style={[
              styles.reportText,
              {
                color:
                  colors.onPrimaryContainer,
              },
            ]}
          >
            Report available
          </Text>
        </View>
      )}
    </Pressable>
  );
}

function Result({
  label,
  value,
  danger,
  colors,
}) {
  return (
    <View style={styles.result}>
      <Text
        style={[
          styles.resultLabel,
          {
            color: colors.onSurfaceVariant,
          },
        ]}
      >
        {label}
      </Text>

      <Text
        style={[
          styles.resultValue,
          {
            color: danger
              ? colors.error
              : colors.primary,
          },
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    padding: 20,
    paddingBottom: 40,
  },

  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginBottom: 12,
  },

  backText: {
    fontSize: 32,
    fontWeight: '300',
  },

  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },

  title: {
    marginTop: 4,
    fontSize: 32,
    fontWeight: '700',
  },

  subtitle: {
    marginTop: 5,
    fontSize: 14,
  },

  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },

  statCard: {
    flex: 1,
    minHeight: 92,
    borderRadius: 18,
    padding: 16,
    justifyContent: 'center',
  },

  statValue: {
    fontSize: 26,
    fontWeight: '700',
  },

  statLabel: {
    marginTop: 2,
    fontSize: 12,
  },

  sectionTitle: {
    marginTop: 30,
    marginBottom: 12,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },

  list: {
    gap: 12,
  },

  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  patientName: {
    fontSize: 18,
    fontWeight: '600',
  },

  date: {
    marginTop: 4,
    fontSize: 13,
  },

  arrow: {
    fontSize: 28,
    fontWeight: '300',
  },

  divider: {
    height: 1,
    marginVertical: 15,
  },

  results: {
    flexDirection: 'row',
    gap: 28,
  },

  result: {
    flex: 1,
  },

  resultLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },

  resultValue: {
    marginTop: 5,
    fontSize: 14,
    fontWeight: '600',
  },

  reportBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },

  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 7,
  },

  reportText: {
    fontSize: 11,
    fontWeight: '600',
  },

  emptyCard: {
    padding: 24,
    borderWidth: 1,
    borderRadius: 20,
    alignItems: 'center',
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
  },

  emptyText: {
    marginTop: 6,
    fontSize: 13,
    textAlign: 'center',
  },
});
