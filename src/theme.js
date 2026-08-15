import { NativeModules } from 'react-native';

const { AndroidTheme } = NativeModules;

export async function getAndroidTheme() {
  return AndroidTheme.getTheme();
}
