import React, { useState } from 'react';
import { TextInput } from 'react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDiagnosis } from '../context/DiagnosisContext';

export default function AnalysisSelectionScreen({ colors, onStart, onBack }) {
  const [imageSelected, setImageSelected] = useState(false);

  const [audioSelected, setAudioSelected] = useState(false);
  const [doctorName, setDoctorName] = useState('');
  const [hospitalName, setHospitalName] = useState('');

  const canContinue = imageSelected || audioSelected;
  const { setSelectedAnalyses, setHospitalDetails } = useDiagnosis();

  const handleContinue = () => {
    if (!canContinue) {
      return;
    }

    setSelectedAnalyses({
      image: imageSelected,
      audio: audioSelected,
    });

    setHospitalDetails({
      hospitalName: hospitalName,
      doctorName: doctorName,
    });

    onStart({
      image: imageSelected,
      audio: audioSelected,
    });
  };

  return (
    <ScrollView
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
        },
      ]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}

      <Pressable onPress={onBack} style={styles.backButton}>
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
          styles.title,
          {
            color: colors.onBackground,
          },
        ]}
      >
        Choose analysis
      </Text>

      <Text
        style={[
          styles.subtitle,
          {
            color: colors.onSurfaceVariant,
          },
        ]}
      >
        Select the screening methods you want to perform for this diagnosis.
      </Text>

      {/* Doctor / Hospital Details */}

      <View
        style={[
          styles.detailsCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.outlineVariant,
          },
        ]}
      >
        <Text
          style={[
            styles.sectionLabel,
            {
              color: colors.onSurface,
            },
          ]}
        >
          DOCTOR DETAILS
        </Text>

        <Text
          style={[
            styles.inputLabel,
            {
              color: colors.onSurfaceVariant,
            },
          ]}
        >
          Doctor Name
        </Text>

        <TextInput
          value={doctorName}
          onChangeText={setDoctorName}
          placeholder="Enter doctor's name"
          placeholderTextColor={colors.onSurfaceVariant}
          style={[
            styles.input,
            {
              color: colors.onSurface,
              backgroundColor: colors.surfaceContainerLow,
              borderColor: colors.outlineVariant,
            },
          ]}
        />

        <Text
          style={[
            styles.inputLabel,
            {
              color: colors.onSurfaceVariant,
            },
          ]}
        >
          Hospital / Clinic
        </Text>

        <TextInput
          value={hospitalName}
          onChangeText={setHospitalName}
          placeholder="Enter hospital or clinic name"
          placeholderTextColor={colors.onSurfaceVariant}
          style={[
            styles.input,
            {
              color: colors.onSurface,
              backgroundColor: colors.surfaceContainerLow,
              borderColor: colors.outlineVariant,
            },
          ]}
        />

        <Text
          style={[
            styles.optionalText,
            {
              color: colors.onSurfaceVariant,
            },
          ]}
        >
          Optional
        </Text>
      </View>

      {/* Image */}

      <AnalysisOption
        title="Image Analysis"
        description="Analyze an oral image using the on-device image classification model."
        icon="◎"
        selected={imageSelected}
        onPress={() => setImageSelected(!imageSelected)}
        colors={colors}
      />

      {/* Voice */}

      <AnalysisOption
        title="Voice Analysis"
        description="Analyze a voice recording for vocal pathology."
        icon="♫"
        selected={audioSelected}
        onPress={() => setAudioSelected(!audioSelected)}
        colors={colors}
      />

      {/* Selection summary */}

      {canContinue && (
        <View
          style={[
            styles.summary,
            {
              backgroundColor: colors.surfaceContainerLow,
            },
          ]}
        >
          <Text
            style={[
              styles.summaryTitle,
              {
                color: colors.onSurface,
              },
            ]}
          >
            Selected analyses
          </Text>

          <Text
            style={[
              styles.summaryText,
              {
                color: colors.onSurfaceVariant,
              },
            ]}
          >
            {[imageSelected ? 'Image' : null, audioSelected ? 'Voice' : null]
              .filter(Boolean)
              .join(' + ')}
          </Text>
        </View>
      )}

      {/* Continue */}

      <Pressable
        disabled={!canContinue}
        onPress={handleContinue}
        style={({ pressed }) => [
          styles.continueButton,
          {
            backgroundColor: canContinue
              ? colors.primary
              : colors.surfaceContainerHighest,

            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <Text
          style={[
            styles.continueText,
            {
              color: canContinue ? colors.onPrimary : colors.onSurfaceVariant,
            },
          ]}
        >
          Start Analysis
        </Text>
      </Pressable>

      <Text
        style={[
          styles.helper,
          {
            color: colors.onSurfaceVariant,
          },
        ]}
      >
        You can perform either analysis or both. Unselected analyses will be
        marked as not performed in the report.
      </Text>
    </ScrollView>
  );
}

function AnalysisOption({
  title,
  description,
  icon,
  selected,
  onPress,
  colors,
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        {
          backgroundColor: selected ? colors.primaryContainer : colors.surface,

          borderColor: selected ? colors.primary : colors.outlineVariant,

          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {/* Icon */}

      <View
        style={[
          styles.iconContainer,
          {
            backgroundColor: selected
              ? colors.primary
              : colors.surfaceContainerHighest,
          },
        ]}
      >
        <Text
          style={[
            styles.icon,
            {
              color: selected ? colors.onPrimary : colors.onSurfaceVariant,
            },
          ]}
        >
          {icon}
        </Text>
      </View>

      {/* Text */}

      <View style={styles.optionContent}>
        <Text
          style={[
            styles.optionTitle,
            {
              color: selected ? colors.onPrimaryContainer : colors.onSurface,
            },
          ]}
        >
          {title}
        </Text>

        <Text
          style={[
            styles.optionDescription,
            {
              color: selected
                ? colors.onPrimaryContainer
                : colors.onSurfaceVariant,
            },
          ]}
        >
          {description}
        </Text>
      </View>

      {/* Checkbox */}

      <View
        style={[
          styles.checkbox,
          {
            backgroundColor: selected ? colors.primary : 'transparent',

            borderColor: selected ? colors.primary : colors.outline,
          },
        ]}
      >
        {selected && (
          <Text
            style={[
              styles.checkmark,
              {
                color: colors.onPrimary,
              },
            ]}
          >
            ✓
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 40,
  },

  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginBottom: 12,
  },

  backText: {
    fontSize: 36,
    lineHeight: 36,
    fontWeight: '300',
  },

  title: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '600',
  },

  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 7,
    marginBottom: 28,
  },

  option: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 118,
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
  },

  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },

  icon: {
    fontSize: 24,
  },

  optionContent: {
    flex: 1,
    marginLeft: 14,
    marginRight: 12,
  },

  optionTitle: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '600',
  },

  optionDescription: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },

  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },

  checkmark: {
    fontSize: 15,
    fontWeight: '700',
  },

  summary: {
    borderRadius: 16,
    padding: 16,
    marginTop: 4,
  },

  summaryTitle: {
    fontSize: 12,
    fontWeight: '600',
  },

  summaryText: {
    fontSize: 14,
    marginTop: 4,
  },

  continueButton: {
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },

  continueText: {
    fontSize: 15,
    fontWeight: '600',
  },

  helper: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 8,
  },
  detailsCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
  },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 16,
  },

  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 7,
  },

  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 14,
    marginBottom: 14,
  },

  optionalText: {
    fontSize: 11,
    marginTop: -4,
  },
});
