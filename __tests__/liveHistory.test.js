const mockSaveDiagnosis = jest.fn();
const mockSaveDiagnosisImageBuffer = jest.fn();
const mockDeleteDiagnosisFolder = jest.fn();

jest.mock('../src/services/database', () => ({
  saveDiagnosis: (...args) => mockSaveDiagnosis(...args),
}));

jest.mock('../src/services/diagnosisStorage', () => ({
  saveDiagnosisImageBuffer: (...args) =>
    mockSaveDiagnosisImageBuffer(...args),
  deleteDiagnosisFolder: (...args) =>
    mockDeleteDiagnosisFolder(...args),
}));

const {
  buildLiveDiagnosis,
  buildLivePatient,
  LIVE_HISTORY_PLACEHOLDER_PATIENT,
  saveLiveDiagnosisToHistory,
} = require('../src/services/liveHistory');

const prediction = {
  classIndex: 0,
  className: 'CANCER',
  probability: 0.82,
  probabilities: {
    CANCER: 0.82,
    'NON CANCER': 0.18,
  },
  logits: [1.5, -0.2],
};

describe('liveHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSaveDiagnosis.mockResolvedValue('diag-saved');
    mockSaveDiagnosisImageBuffer.mockResolvedValue(
      '/documents/OralScan/diagnoses/diag/images/live.jpg',
    );
    mockDeleteDiagnosisFolder.mockResolvedValue(undefined);
  });

  test('uses a safe patient placeholder when no patient is available', () => {
    expect(buildLivePatient()).toEqual({
      name: LIVE_HISTORY_PLACEHOLDER_PATIENT,
      dateOfBirth: '',
      age: 0,
      gender: '',
      country: '',
      state: '',
      city: '',
    });
  });

  test('preserves context patient and hospital details', () => {
    const patient = buildLivePatient({
      name: 'Alice',
      dateOfBirth: '1990-01-01',
      gender: 'Female',
      country: 'India',
      state: 'Kerala',
      city: 'Kochi',
    });

    expect(patient.name).toBe('Alice');
    expect(patient.gender).toBe('Female');
    expect(patient.city).toBe('Kochi');
    expect(patient.age).toBeGreaterThanOrEqual(0);
  });

  test('builds a live diagnosis with its own image, timestamp and model', () => {
    const capturedAt = Date.UTC(2026, 9, 31, 12, 30, 5);

    const diagnosis = buildLiveDiagnosis({
      diagnosisId: 'diag-live',
      imageId: 'img-live',
      imagePath:
        '/documents/OralScan/diagnoses/diag-live/images/live.jpg',
      prediction,
      capturedAt,
      modelName: 'MobileNetV3',
      modelVersion: '1.0',
    });

    expect(diagnosis).toMatchObject({
      id: 'diag-live',
      source: 'live_video',
      selectedAnalyses: { image: true, audio: false },
      createdAt: new Date(capturedAt).toISOString(),
    });
    expect(diagnosis.image.images[0]).toMatchObject({
      id: 'img-live',
      path: '/documents/OralScan/diagnoses/diag-live/images/live.jpg',
      fileName: 'live.jpg',
      status: 'completed',
      inferenceTimestamp: new Date(capturedAt).toISOString(),
      modelName: 'MobileNetV3',
      modelVersion: '1.0',
      result: {
        className: 'CANCER',
        probability: 0.82,
        probabilities: prediction.probabilities,
      },
    });
  });

  test('falls back to the default model name in a built diagnosis', () => {
    const diagnosis = buildLiveDiagnosis({
      diagnosisId: 'diag-live',
      imageId: 'img-live',
      imagePath: '/documents/live.jpg',
      prediction,
    });

    expect(diagnosis.image.images[0].modelName).toBe('MobileNetV3');
    expect(diagnosis.image.images[0].modelVersion).toBeNull();
  });

  test('writes the frame and saves a live diagnosis to the database', async () => {
    const frameBuffer = new ArrayBuffer(8);

    const result = await saveLiveDiagnosisToHistory({
      prediction,
      frameBuffer,
      capturedAt: Date.UTC(2026, 9, 31, 12, 30, 5),
      patient: {
        name: 'Alice',
        dateOfBirth: '1990-01-01',
      },
      hospitalDetails: {
        doctorName: 'Dr. Lee',
        hospitalName: 'City Clinic',
      },
      modelName: 'MobileNetV3',
      modelVersion: '1.0',
    });

    expect(result.imagePath).toBe(
      '/documents/OralScan/diagnoses/diag/images/live.jpg',
    );
    expect(result.diagnosisId).toEqual(expect.any(String));
    expect(mockSaveDiagnosisImageBuffer).toHaveBeenCalledWith(
      frameBuffer,
      result.diagnosisId,
      expect.stringMatching(/^images\/live-\d+-img_.*\.jpg$/),
    );
    expect(mockSaveDiagnosis).toHaveBeenCalledWith(
      expect.objectContaining({
        id: result.diagnosisId,
        source: 'live_video',
        patient: expect.objectContaining({
          name: 'Alice',
        }),
        hospitalDetails: {
          doctorName: 'Dr. Lee',
          hospitalName: 'City Clinic',
        },
      }),
    );
  });

  test('cleans up the image folder when the database write fails', async () => {
    mockSaveDiagnosis.mockRejectedValueOnce(new Error('database is locked'));

    await expect(
      saveLiveDiagnosisToHistory({
        prediction,
        frameBuffer: new ArrayBuffer(8),
      }),
    ).rejects.toThrow('database is locked');

    expect(mockDeleteDiagnosisFolder).toHaveBeenCalledWith(
      expect.any(String),
    );
  });

  test('keeps the original error when cleanup also fails', async () => {
    mockSaveDiagnosis.mockRejectedValueOnce(new Error('disk full'));
    mockDeleteDiagnosisFolder.mockRejectedValueOnce(
      new Error('cleanup failed'),
    );

    await expect(
      saveLiveDiagnosisToHistory({
        prediction,
        frameBuffer: new ArrayBuffer(8),
      }),
    ).rejects.toThrow('disk full');
  });

  test('rejects missing predictions and frames', async () => {
    await expect(
      saveLiveDiagnosisToHistory({
        frameBuffer: new ArrayBuffer(8),
      }),
    ).rejects.toThrow('A prediction is required to save to history.');

    await expect(
      saveLiveDiagnosisToHistory({
        prediction,
      }),
    ).rejects.toThrow('A camera frame is required to save to history.');
  });
});
