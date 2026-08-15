export function softmax(values) {
  const max = Math.max(...values);

  const exps = values.map(value => Math.exp(value - max));

  const sum = exps.reduce((total, value) => total + value, 0);

  return exps.map(value => value / sum);
}
