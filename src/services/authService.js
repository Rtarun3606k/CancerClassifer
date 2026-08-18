import { NativeModules } from 'react-native';

const { Auth } = NativeModules;

function checkModule() {
  if (!Auth) {
    throw new Error(
      'Auth native module is not available.',
    );
  }
}

export async function canUseDeviceAuthentication() {
  checkModule();

  return await Auth.canAuthenticate();
}

export async function authenticateWithDevice() {
  checkModule();

  return await Auth.authenticate();
}

export async function hasPassword() {
  checkModule();

  return await Auth.hasPassword();
}

export async function setPassword(password) {
  checkModule();

  return await Auth.setPassword(password);
}

export async function verifyPassword(password) {
  checkModule();

  return await Auth.verifyPassword(password);
}
