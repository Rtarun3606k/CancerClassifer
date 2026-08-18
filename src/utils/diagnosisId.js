export function createDiagnosisId() {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '');

  const random = Math.random().toString(36).substring(2, 8);

  return `${timestamp}_${random}`;
}
