import { NativeModules } from 'react-native';

const { Auth } = NativeModules;

export async function canUseDeviceAuthentication() {
  if (!Auth) {
    throw new Error(
      'Auth native module is not available.',
    );
  }

  return await Auth.canAuthenticate();
}

export async function authenticateWithDevice() {
  if (!Auth) {
    throw new Error(
      'Auth native module is not available.',
    );
  }

  return await Auth.authenticate();
}
