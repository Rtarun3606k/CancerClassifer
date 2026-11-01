const {
  deriveDiagnosisSource,
  diagnosisSourceFromRow,
  getDiagnosisSourceLabel,
  normalizeDiagnosisSource,
} = require('../src/utils/diagnosisSource');

describe('diagnosisSource', () => {
  test('normalizes known sources and ignores unknown values', () => {
    expect(normalizeDiagnosisSource('live_video')).toBe('live_video');
    expect(normalizeDiagnosisSource('audio_analysis')).toBe('audio_analysis');
    expect(normalizeDiagnosisSource('image_analysis')).toBe('image_analysis');
    expect(normalizeDiagnosisSource('other')).toBeNull();
    expect(normalizeDiagnosisSource(null)).toBeNull();
  });

  test('prefers an explicit source over analysis flags', () => {
    expect(
      deriveDiagnosisSource({
        source: 'live_video',
        hasImage: true,
        hasAudio: false,
      }),
    ).toBe('live_video');
  });

  test('falls back to analysis flags for older records', () => {
    expect(deriveDiagnosisSource({ hasImage: true })).toBe(
      'image_analysis',
    );
    expect(deriveDiagnosisSource({ hasAudio: true })).toBe(
      'audio_analysis',
    );
    expect(deriveDiagnosisSource()).toBe('image_analysis');
  });

  test('derives a source from a database row', () => {
    expect(
      diagnosisSourceFromRow({
        source: 'live_video',
        image_selected: 1,
      }),
    ).toBe('live_video');

    expect(
      diagnosisSourceFromRow({
        image_selected: 0,
        audio_selected: 1,
      }),
    ).toBe('audio_analysis');

    expect(
      diagnosisSourceFromRow({
        image_count: 2,
      }),
    ).toBe('image_analysis');
  });

  test('returns human-readable labels with a safe fallback', () => {
    expect(getDiagnosisSourceLabel('image_analysis')).toBe(
      'Image Analysis',
    );
    expect(getDiagnosisSourceLabel('audio_analysis')).toBe(
      'Audio Analysis',
    );
    expect(getDiagnosisSourceLabel('live_video')).toBe(
      'Live Video Detection',
    );
    expect(getDiagnosisSourceLabel('unknown')).toBe('Image Analysis');
  });
});
