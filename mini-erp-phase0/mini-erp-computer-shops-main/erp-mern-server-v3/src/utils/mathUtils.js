/**
 * Math Utilities for Financial Calculations
 * Addresses floating point precision issues in JavaScript.
 */

/**
 * Round a number to a specific precision
 * @param {number} value
 * @param {number} decimals
 * @returns {number}
 */
export const round = (value, decimals = 2) => {
  return Number(Math.round(value + 'e' + decimals) + 'e-' + decimals);
};

/**
 * Add two numbers with precision
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
export const add = (a, b) => {
  return round((Number(a) || 0) + (Number(b) || 0));
};

/**
 * Subtract two numbers with precision
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
export const sub = (a, b) => {
  return round((Number(a) || 0) - (Number(b) || 0));
};

/**
 * Multiply two numbers with precision
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
export const mul = (a, b) => {
  return round((Number(a) || 0) * (Number(b) || 0));
};

/**
 * Divide two numbers with precision
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
export const div = (a, b) => {
  if (Number(b) === 0) return 0;
  return round((Number(a) || 0) / (Number(b) || 0));
};
