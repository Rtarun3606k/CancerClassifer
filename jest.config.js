module.exports = {
  preset: '@react-native/jest-preset',
  collectCoverageFrom: [
    'src/{services,report,ml}/**/*.js',
    '!src/screens/**',
    '!src/ml/audio/audioRecorder.js',
  ],
  coverageThreshold: {
    global: {
      statements: 85,
      branches: 80,
      functions: 85,
      lines: 85,
    },
  },
};
