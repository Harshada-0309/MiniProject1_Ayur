const { validateHumanName } = require('../src/middleware/validation');

describe('BUG 2: Human Name Validation Requirements', () => {
  describe('Valid Human Names', () => {
    test('accepts standard Indian names with multiple words', () => {
      expect(validateHumanName('Vikram Joshi').valid).toBe(true);
      expect(validateHumanName('Aarav Sharma').valid).toBe(true);
      expect(validateHumanName('Priya Devi Patel').valid).toBe(true);
    });

    test('accepts names with spaces, hyphens, and apostrophes', () => {
      expect(validateHumanName('Mary-Jane Smith').valid).toBe(true);
      expect(validateHumanName("O'Connor").valid).toBe(true);
      expect(validateHumanName("D'Souza-Fernandes").valid).toBe(true);
      expect(validateHumanName('A. K. Sharma').valid).toBe(true);
    });

    test('accepts international / accented names', () => {
      expect(validateHumanName('José Müller').valid).toBe(true);
      expect(validateHumanName('Renée').valid).toBe(true);
      expect(validateHumanName('François').valid).toBe(true);
    });
  });

  describe('Invalid Human Names Containing Digits', () => {
    test('rejects names with numbers at the end (Vikram123)', () => {
      const res = validateHumanName('Vikram123');
      expect(res.valid).toBe(false);
      expect(res.message).toMatch(/cannot contain numerical digits/i);
    });

    test('rejects names consisting entirely of digits (12345)', () => {
      const res = validateHumanName('12345');
      expect(res.valid).toBe(false);
      expect(res.message).toMatch(/cannot contain numerical digits/i);
    });

    test('rejects names with spaces and digits (Rahul 7)', () => {
      const res = validateHumanName('Rahul 7');
      expect(res.valid).toBe(false);
      expect(res.message).toMatch(/cannot contain numerical digits/i);
    });
  });

  describe('Invalid Characters and Edge Cases', () => {
    test('rejects empty or whitespace-only names', () => {
      expect(validateHumanName('').valid).toBe(false);
      expect(validateHumanName('   ').valid).toBe(false);
      expect(validateHumanName(null).valid).toBe(false);
      expect(validateHumanName(undefined).valid).toBe(false);
    });

    test('rejects single-character names (min 2 chars required)', () => {
      const res = validateHumanName('A');
      expect(res.valid).toBe(false);
      expect(res.message).toMatch(/at least 2 characters/i);
    });

    test('rejects special symbols and punctuation', () => {
      expect(validateHumanName('Vikram@Joshi').valid).toBe(false);
      expect(validateHumanName('Mary#Jane').valid).toBe(false);
      expect(validateHumanName('<script>alert(1)</script>').valid).toBe(false);
    });
  });
});
