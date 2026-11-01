const React = require('react');
const { act, create } = require('react-test-renderer');

const {
  DiagnosisProvider,
  useDiagnosis,
} = require('../../src/context/DiagnosisContext');

describe('DiagnosisContext', () => {
  function renderContext() {
    let root;
    let valueRef;

    function Harness() {
      const value = useDiagnosis();
      valueRef = value;
      return null;
    }

    act(() => {
      root = create(
        React.createElement(
          DiagnosisProvider,
          null,
          React.createElement(Harness),
        ),
      );
    });

    return { root, getValue: () => valueRef };
  }

  test('initializes with an empty diagnosis state', () => {
    const { getValue } = renderContext();

    expect(getValue().diagnosis).toMatchObject({
      id: expect.any(String),
      createdAt: expect.any(String),
      patient: {
        name: '',
        dateOfBirth: '',
        gender: '',
        country: '',
        state: '',
        city: '',
      },
      hospitalDetails: { doctorName: '', hospitalName: '' },
      selectedAnalyses: { image: false, audio: false },
      reportPath: null,
    });
  });

  test('updates patient details correctly', () => {
    const { getValue } = renderContext();

    act(() => {
      getValue().updatePatient({ name: 'John Doe', gender: 'Male' });
    });

    expect(getValue().diagnosis.patient.name).toBe('John Doe');
    expect(getValue().diagnosis.patient.gender).toBe('Male');
    expect(getValue().diagnosis.patient.city).toBe('');
  });

  test('updates hospital details correctly', () => {
    const { getValue } = renderContext();

    act(() => {
      getValue().setHospitalDetails({
        doctorName: 'Dr. Smith',
        hospitalName: 'General Hospital',
      });
    });

    expect(getValue().diagnosis.hospitalDetails).toEqual({
      doctorName: 'Dr. Smith',
      hospitalName: 'General Hospital',
    });
  });

  test('updates image results correctly', () => {
    const { getValue } = renderContext();

    act(() => {
      getValue().setImageResult({
        uri: 'file://image.jpg',
        result: 'Positive',
        doctorAssessment: 'Needs biopsy',
        doctorRemarks: 'Urgent',
      });
    });

    const images = getValue().diagnosis.image.images;

    expect(images).toHaveLength(1);

    expect(images[0]).toMatchObject({
      uri: 'file://image.jpg',
      result: 'Positive',
      doctorAssessment: 'Needs biopsy',
      doctorRemarks: 'Urgent',
    });
  });

  test('adds multiple images without losing individual data', () => {
    const { getValue } = renderContext();

    let ids;

    act(() => {
      ids = getValue().addImages([
        { uri: 'file://a.jpg', fileName: 'a.jpg' },
        { uri: 'file://b.jpg', fileName: 'b.jpg' },
      ]);
    });

    expect(ids).toHaveLength(2);
    expect(getValue().diagnosis.image.images).toHaveLength(2);
    expect(getValue().diagnosis.image.images[1].fileName).toBe('b.jpg');

    act(() => {
      getValue().updateImage(ids[0], {
        result: { className: 'CANCER' },
        status: 'completed',
      });
    });

    const [first, second] = getValue().diagnosis.image.images;

    expect(first.result).toEqual({ className: 'CANCER' });
    expect(second.result).toBeNull();

    act(() => {
      getValue().removeImage(ids[0]);
    });

    expect(getValue().diagnosis.image.images).toHaveLength(1);
    expect(getValue().diagnosis.image.images[0].id).toBe(ids[1]);
  });

  test('stores a doctor assessment per image', () => {
    const { getValue } = renderContext();

    let ids;

    act(() => {
      ids = getValue().addImages([{ uri: 'file://a.jpg' }, { uri: 'file://b.jpg' }]);
    });

    act(() => {
      getValue().setImageAssessment(ids[1], {
        doctorAssessment: 'Cancer',
        doctorRemarks: 'Biopsy advised',
      });
    });

    expect(getValue().diagnosis.image.images[0].doctorAssessment).toBe('');
    expect(getValue().diagnosis.image.images[1]).toMatchObject({
      doctorAssessment: 'Cancer',
      doctorRemarks: 'Biopsy advised',
    });
  });

  test('starts with an empty image list', () => {
    const { getValue } = renderContext();

    expect(getValue().diagnosis.image).toEqual({ images: [] });
  });

  test('updates audio results correctly', () => {
    const { getValue } = renderContext();

    act(() => {
      getValue().setAudioResult({
        path: 'file://audio.wav',
        result: 'Negative',
        doctorAssessment: 'Normal breath sounds',
        doctorRemarks: 'No action needed',
      });
    });

    expect(getValue().diagnosis.audio).toEqual({
      path: 'file://audio.wav',
      result: 'Negative',
      doctorAssessment: 'Normal breath sounds',
      doctorRemarks: 'No action needed',
    });
  });

  test('updates selected analyses correctly', () => {
    const { getValue } = renderContext();

    act(() => {
      getValue().setSelectedAnalyses({ image: true });
    });

    expect(getValue().diagnosis.selectedAnalyses).toEqual({
      image: true,
      audio: false,
    });
  });

  test('updates report path correctly', () => {
    const { getValue } = renderContext();

    act(() => {
      getValue().setReportPath('/path/to/report.pdf');
    });

    expect(getValue().diagnosis.reportPath).toBe('/path/to/report.pdf');
  });

  test('clears the diagnosis back to an empty state', () => {
    const { getValue } = renderContext();

    act(() => {
      getValue().updatePatient({ name: 'Jane Doe' });
    });
    expect(getValue().diagnosis.patient.name).toBe('Jane Doe');

    act(() => {
      getValue().clearDiagnosis();
    });

    expect(getValue().diagnosis.patient.name).toBe('');
    expect(getValue().diagnosis.id).toEqual(expect.any(String));
  });

  test('starts a new diagnosis and returns the new ID', () => {
    const { getValue } = renderContext();

    act(() => {
      getValue().updatePatient({ name: 'Old Patient' });
    });

    let returnedId;
    act(() => {
      returnedId = getValue().startNewDiagnosis();
    });

    expect(returnedId).toEqual(expect.any(String));
    expect(getValue().diagnosis.id).toBe(returnedId);
    expect(getValue().diagnosis.patient.name).toBe('');
  });
});
