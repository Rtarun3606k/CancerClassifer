jest.mock('react-native', () => {
  const React = require('react');
  const element =
    name =>
    ({ children, ...props }) =>
      React.createElement(name, props, children);

  return {
    View: element('View'),
    Text: element('Text'),
    Image: element('Image'),
    Pressable: element('Pressable'),
    ActivityIndicator: element('ActivityIndicator'),
    TextInput: element('TextInput'),
    ScrollView: element('ScrollView'),
    StyleSheet: { create: styles => styles },
  };
});

const React = require('react');
const { create, act } = require('react-test-renderer');

jest.mock('../../oralscan.png', () => 'mocked-image', { virtual: true });

const AppFooter = require('../../src/components/AppFooter').default;
const AppHeader = require('../../src/components/AppHeader').default;
const ProbabilityBar = require('../../src/components/ProbabilityBar').default;

const mockColors = {
  surfaceContainer: '#111111',
  onSurface: '#222222',
  onSurfaceVariant: '#333333',
  primary: '#444444',
  primaryContainer: '#555555',
  onBackground: '#666666',
};

describe('UI Components', () => {
  test('AppFooter renders the disclaimer text correctly', () => {
    let component;

    act(() => {
      component = create(
        React.createElement(AppFooter, { colors: mockColors }),
      );
    });

    const tree = JSON.stringify(component.toJSON());

    expect(tree).toContain('For research purposes');
    expect(tree).toContain('AI-assisted • On-device inference');
  });

  test('AppHeader renders with default props', () => {
    let component;

    act(() => {
      component = create(
        React.createElement(AppHeader, { colors: mockColors }),
      );
    });

    const tree = JSON.stringify(component.toJSON());

    expect(tree).toContain('OralScan');
    expect(tree).toContain('Beta 2.7.4');
  });

  test('AppHeader renders with custom props', () => {
    let component;

    act(() => {
      component = create(
        React.createElement(AppHeader, {
          colors: mockColors,
          title: 'CustomTitle',
          subtitle: 'Patient view',
          status: 'v1.0',
        }),
      );
    });

    const tree = JSON.stringify(component.toJSON());

    expect(tree).toContain('CustomTitle');
    expect(tree).toContain('Patient view');
    expect(tree).toContain('v1.0');
  });

  test('ProbabilityBar calculates and renders the percentage correctly', () => {
    let component;

    act(() => {
      component = create(
        React.createElement(ProbabilityBar, {
          label: 'Malignant',
          value: 0.854,
          colors: mockColors,
        }),
      );
    });

    const tree = JSON.stringify(component.toJSON());

    expect(tree).toContain('Malignant');
    expect(tree).toContain('85.4');
    expect(tree).toContain('%');
  });
});
