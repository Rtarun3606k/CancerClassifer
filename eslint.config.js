import reactPlugin from 'eslint-plugin-react';

export default [
  {
    files: ['**/*.js'], // Targets your .js files
    plugins: {
      react: reactPlugin,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      // Allows JSX syntax in files with the .js extension
      'react/jsx-filename-extension': [1, { extensions: ['.js'] }],
      // Project uses other typing strategies; disable prop-types enforcement
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
];
