import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import DatePicker from 'react-native-date-picker';

import { useDiagnosis } from '../context/DiagnosisContext';

export default function PatientDetailsScreen({ colors, onContinue, onBack }) {
  const { diagnosis, updatePatient } = useDiagnosis();

  const patient = diagnosis.patient;

  const [patientName, setPatientName] = useState(patient.name || '');

  const [dateOfBirth, setDateOfBirth] = useState(patient.dateOfBirth || '');

  const [selectedDate, setSelectedDate] = useState(
    patient.dateOfBirth ? new Date(patient.dateOfBirth) : new Date(),
  );

  const [gender, setGender] = useState(patient.gender || '');

  const [country, setCountry] = useState(patient.country || '');

  const [state, setState] = useState(patient.state || '');

  const [city, setCity] = useState(patient.city || '');

  const [showDatePicker, setShowDatePicker] = useState(false);

  const [showGenderPicker, setShowGenderPicker] = useState(false);

  const handleContinue = () => {
    if (!patientName.trim()) {
      return;
    }

    if (!dateOfBirth) {
      return;
    }

    if (!gender) {
      return;
    }

    updatePatient({
      name: patientName.trim(),
      dateOfBirth,
      gender,
      country: country.trim(),
      state: state.trim(),
      city: city.trim(),
    });

    onContinue();
  };

  const handleDateConfirm = date => {
    setShowDatePicker(false);
    setSelectedDate(date);

    const year = date.getFullYear();

    const month = String(date.getMonth() + 1).padStart(2, '0');

    const day = String(date.getDate()).padStart(2, '0');

    setDateOfBirth(`${year}-${month}-${day}`);
  };

  const canContinue = patientName.trim() && dateOfBirth && gender;

  return (
    <ScrollView
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
        },
      ]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}

      <View style={styles.header}>
        {onBack && (
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
        )}

        <Text
          style={[
            styles.title,
            {
              color: colors.onBackground,
            },
          ]}
        >
          Patient Details
        </Text>

        <Text
          style={[
            styles.subtitle,
            {
              color: colors.onSurfaceVariant,
            },
          ]}
        >
          Enter patient information before starting the analysis.
        </Text>
      </View>

      {/* Patient Name */}

      <View style={styles.field}>
        <Text
          style={[
            styles.label,
            {
              color: colors.onBackground,
            },
          ]}
        >
          Patient name
        </Text>

        <TextInput
          value={patientName}
          onChangeText={setPatientName}
          placeholder="Enter patient name"
          placeholderTextColor={colors.onSurface}
          autoCapitalize="words"
          style={[
            styles.input,
            {
              color: colors.onSurface,
              backgroundColor: colors.surfaceContainerHighest,
              borderColor: colors.outline,
            },
          ]}
        />
      </View>

      {/* Date of Birth */}

      <View style={styles.field}>
        <Text
          style={[
            styles.label,
            {
              color: colors.onSurface,
            },
          ]}
        >
          Date of birth
        </Text>

        <Pressable
          onPress={() => setShowDatePicker(true)}
          style={[
            styles.input,
            styles.dateInput,
            {
              backgroundColor: colors.surfaceContainerHighest,
              borderColor: colors.outline,
            },
          ]}
        >
          <Text
            style={{
              color: dateOfBirth ? colors.onSurface : colors.onSurface,
              fontSize: 16,
            }}
          >
            {dateOfBirth || 'Select date of birth'}
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
          Age will be calculated automatically.
        </Text>
      </View>

      <DatePicker
        modal
        open={showDatePicker}
        date={selectedDate}
        mode="date"
        maximumDate={new Date()}
        onConfirm={handleDateConfirm}
        onCancel={() => setShowDatePicker(false)}
      />

      {/* Gender */}

      <View style={styles.field}>
        <Text
          style={[
            styles.label,
            {
              color: colors.onBackground,
            },
          ]}
        >
          Gender
        </Text>

        <Pressable
          onPress={() => setShowGenderPicker(!showGenderPicker)}
          style={[
            styles.input,
            styles.dateInput,
            {
              backgroundColor: colors.surfaceContainerHighest,
              borderColor: colors.outline,
            },
          ]}
        >
          <View style={styles.rowBetween}>
            <Text
              style={{
                color: gender ? colors.onSurface : colors.onSurfaceVariant,
                fontSize: 16,
              }}
            >
              {gender || 'Select gender'}
            </Text>

            <Text
              style={{
                color: colors.onSurface,
                fontSize: 16,
              }}
            >
              ▼
            </Text>
          </View>
        </Pressable>

        {showGenderPicker && (
          <View
            style={[
              styles.genderMenu,
              {
                backgroundColor: colors.onBackground,
                borderColor: colors.outlineVariant,
              },
            ]}
          >
            {['Male', 'Female', 'Other', 'Prefer not to say'].map(option => (
              <Pressable
                key={option}
                onPress={() => {
                  setGender(option);
                  setShowGenderPicker(false);
                }}
                style={[
                  styles.genderOption,
                  gender === option && {
                    backgroundColor: colors.primaryContainer,
                  },
                ]}
              >
                <Text
                  style={{
                    color:
                      gender === option ? colors.onSurface : colors.onSurface,
                    fontSize: 15,
                  }}
                >
                  {option}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* Location */}

      <Text
        style={[
          styles.sectionTitle,
          {
            color: colors.onBackground,
          },
        ]}
      >
        Location
      </Text>

      <Text
        style={[
          styles.sectionSubtitle,
          {
            color: colors.onSurfaceVariant,
          },
        ]}
      >
        Optional. Used as patient information in the report.
      </Text>

      <View style={styles.field}>
        <Text
          style={[
            styles.label,
            {
              color: colors.onBackground,
            },
          ]}
        >
          Country
        </Text>

        <TextInput
          value={country}
          onChangeText={setCountry}
          placeholder="Enter country"
          placeholderTextColor={colors.onSurfaceVariant}
          autoCapitalize="words"
          style={[
            styles.input,
            {
              color: colors.onSurface,
              backgroundColor: colors.surfaceContainerHighest,
              borderColor: colors.outline,
            },
          ]}
        />
      </View>

      <View style={styles.field}>
        <Text
          style={[
            styles.label,
            {
              color: colors.onBackground,
            },
          ]}
        >
          State
        </Text>

        <TextInput
          value={state}
          onChangeText={setState}
          placeholder="Enter state"
          placeholderTextColor={colors.onSurfaceVariant}
          autoCapitalize="words"
          style={[
            styles.input,
            {
              color: colors.onSurface,
              backgroundColor: colors.surfaceContainerHighest,
              borderColor: colors.outline,
            },
          ]}
        />
      </View>

      <View style={styles.field}>
        <Text
          style={[
            styles.label,
            {
              color: colors.onBackground,
            },
          ]}
        >
          City
        </Text>

        <TextInput
          value={city}
          onChangeText={setCity}
          placeholder="Enter city"
          placeholderTextColor={colors.onSurfaceVariant}
          autoCapitalize="words"
          style={[
            styles.input,
            {
              color: colors.onSurface,
              backgroundColor: colors.surfaceContainerHighest,
              borderColor: colors.outline,
            },
          ]}
        />
      </View>

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
          style={{
            color: canContinue ? colors.onPrimary : colors.onSurfaceVariant,
            fontSize: 15,
            fontWeight: '600',
          }}
        >
          Continue
        </Text>
      </Pressable>

      <Text
        style={[
          styles.privacyText,
          {
            color: colors.onSurfaceVariant,
          },
        ]}
      >
        Patient information is used only to generate the diagnosis report.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 24,
    // paddingTop: 32,
    paddingBottom: 40,
  },

  header: {
    // marginBottom: 32,
  },

  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginBottom: 8,
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
    marginTop: 6,
    maxWidth: 340,
  },

  field: {
    marginBottom: 20,
  },

  label: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    marginBottom: 8,
  },

  input: {
    height: 52,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },

  dateInput: {
    justifyContent: 'center',
  },

  helper: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 6,
  },

  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  genderMenu: {
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 6,
    overflow: 'hidden',
  },

  genderOption: {
    minHeight: 48,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },

  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
    marginTop: 8,
  },

  sectionSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
    marginBottom: 18,
  },

  continueButton: {
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },

  privacyText: {
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 14,
  },
});
