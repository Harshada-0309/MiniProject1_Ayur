/**
 * Human Name Validation Utility
 *
 * Rules:
 * - Permits alphabetic characters from supported languages (Unicode letters \p{L}, including accented and Indic characters).
 * - Permits spaces, hyphens, and apostrophes.
 * - Rejects numeric digits (0-9).
 * - Rejects names consisting entirely of numbers or containing numbers.
 * - Requires trimmed length between 2 and 150 characters.
 * - Rejects invalid special symbols.
 */

export function validateHumanName(name, isSubmitting = true) {
  if (name === undefined || name === null) {
    return {
      isValid: false,
      error: 'Patient name is required.',
    };
  }

  const raw = String(name);
  const trimmed = raw.trim();

  // If empty
  if (trimmed.length === 0) {
    return {
      isValid: false,
      error: 'Patient name is required.',
    };
  }

  // Reject any numeric digits
  if (/\d/.test(raw)) {
    return {
      isValid: false,
      error: 'Name cannot contain numerical digits.',
    };
  }

  // While typing, allow single character without error unless submitting
  if (trimmed.length < 2) {
    if (isSubmitting) {
      return {
        isValid: false,
        error: 'Patient name must be at least 2 characters long.',
      };
    }
    // While typing a single letter, check if it's a valid letter
    if (!/^\p{L}$/u.test(trimmed)) {
      return {
        isValid: false,
        error: 'Only letters, spaces, hyphens, and apostrophes are allowed.',
      };
    }
    return { isValid: true, error: null };
  }

  if (trimmed.length > 150) {
    return {
      isValid: false,
      error: 'Patient name must be under 150 characters.',
    };
  }

  // Allowed characters: Unicode letters, spaces, hyphens, apostrophes (straight and curly), and period
  // Must start with a letter
  const namePattern = /^[\p{L}][\p{L}\s'’\.\-]*$/u;
  if (!namePattern.test(trimmed)) {
    return {
      isValid: false,
      error: 'Only letters, spaces, hyphens, and apostrophes are allowed.',
    };
  }

  // Must contain at least one letter
  if (!/\p{L}/u.test(trimmed)) {
    return {
      isValid: false,
      error: 'Name must contain alphabetic characters.',
    };
  }

  return { isValid: true, error: null };
}

/**
 * KeyDown event handler to prevent entering numerical digits directly into human name inputs.
 * Returns true if a number key was prevented.
 */
export function preventNumberInput(e) {
  // Allow system/navigation combos (Ctrl+C, Ctrl+V, Alt+Tab, Cmd+A, etc.)
  if (e.ctrlKey || e.metaKey || e.altKey) return false;

  // Reject digits 0-9 from main keyboard and numpad
  if (/^[0-9]$/.test(e.key)) {
    e.preventDefault();
    return true;
  }

  return false;
}

/**
 * Validates occupation:
 * - Rejects numbers-only input (e.g. "12345")
 * - Accepts valid job titles like "Student", "Teacher", "Software Engineer"
 * - Max length 150
 */
export function validateOccupation(occupation) {
  if (occupation === undefined || occupation === null || occupation === '') {
    return { isValid: true, error: null };
  }
  const trimmed = String(occupation).trim();
  if (trimmed.length === 0) {
    return { isValid: true, error: null };
  }
  if (trimmed.length > 150) {
    return { isValid: false, error: 'Occupation must be under 150 characters.' };
  }
  if (/^\d+$/.test(trimmed)) {
    return { isValid: false, error: 'Occupation cannot consist solely of numbers. Please enter a valid job title.' };
  }
  return { isValid: true, error: null };
}

/**
 * Validates whole-number age in completed years:
 * - Requires whole number (integer)
 * - Permitted range 0 to 105 (inclusive)
 * - Rejects negative values, decimals, letters, malformed strings
 */
export function validateAge(age, isRequired = true) {
  if (age === undefined || age === null || age === '') {
    if (isRequired) {
      return { isValid: false, error: 'Age is required and must be an integer between 0 and 105.' };
    }
    return { isValid: true, error: null };
  }

  const raw = String(age).trim();
  if (!/^\d+$/.test(raw)) {
    return { isValid: false, error: 'Age must be an integer between 0 and 105 (no decimals or letters).' };
  }

  const num = parseInt(raw, 10);
  if (isNaN(num) || num < 0 || num > 105) {
    return { isValid: false, error: 'Age must be between 0 and 105 years.' };
  }

  return { isValid: true, error: null, value: num };
}

/**
 * Validates calendar date (YYYY-MM-DD):
 * - Checks format and real calendar date
 * - Rejects future assessment dates if allowFuture is false
 */
export function validateDate(dateStr, fieldName = 'Assessment date', allowFuture = false) {
  if (!dateStr) {
    return { isValid: true, error: null };
  }
  const raw = String(dateStr).trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return { isValid: false, error: `${fieldName} must be a valid date in YYYY-MM-DD format.` };
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (year < 1900 || year > 2100 || month < 1 || month > 12) {
    return { isValid: false, error: `${fieldName} contains an invalid year or month.` };
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) {
    return { isValid: false, error: `${fieldName} has an invalid day for month ${month}.` };
  }

  if (!allowFuture) {
    const todayStr = new Date().toISOString().split('T')[0];
    if (raw > todayStr) {
      return { isValid: false, error: `${fieldName} cannot be in the future.` };
    }
  }

  return { isValid: true, error: null, value: raw };
}

/**
 * Validates phone numbers:
 * - Permits international formats with leading +
 * - Rejects alphabetic characters
 * - Requires 7 to 15 digits
 */
export function validatePhone(phone) {
  if (phone === undefined || phone === null || phone === '') {
    return { isValid: true, error: null };
  }
  const trimmed = String(phone).trim();
  if (trimmed.length === 0) {
    return { isValid: true, error: null };
  }
  if (trimmed.length > 50) {
    return { isValid: false, error: 'Phone number must be under 50 characters.' };
  }
  if (/[a-zA-Z]/.test(trimmed)) {
    return { isValid: false, error: 'Phone number cannot contain alphabetic characters.' };
  }
  if (!/^\+?[\d\s\-\.\(\)]+$/.test(trimmed)) {
    return { isValid: false, error: 'Phone number contains invalid characters.' };
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) {
    return { isValid: false, error: 'Phone number must contain between 7 and 15 digits.' };
  }
  return { isValid: true, error: null, value: trimmed };
}

/**
 * Validates email address syntax
 */
export function validateEmail(email, isRequired = false) {
  if (email === undefined || email === null || email === '') {
    if (isRequired) {
      return { isValid: false, error: 'Email address is required.' };
    }
    return { isValid: true, error: null };
  }
  const trimmed = String(email).trim();
  if (trimmed.length === 0) {
    if (isRequired) {
      return { isValid: false, error: 'Email address is required.' };
    }
    return { isValid: true, error: null };
  }
  if (trimmed.length > 150) {
    return { isValid: false, error: 'Email must be under 150 characters.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { isValid: false, error: 'Please enter a valid email address (e.g. name@example.com).' };
  }
  return { isValid: true, error: null, value: trimmed };
}

/**
 * Validates numeric measurement fields:
 * - Accepts finite numbers and decimals
 * - Rejects malformed strings, arbitrary non-numeric text, NaN, Infinity
 */
export function validateMeasurement(val, fieldName, min, max, unit = '') {
  if (val === undefined || val === null || val === '') {
    return { isValid: true, error: null };
  }
  const s = String(val).trim();
  if (s === '') {
    return { isValid: true, error: null };
  }
  if (!/^[+-]?(\d+(\.\d+)?|\.\d+)$/.test(s)) {
    return { isValid: false, error: `${fieldName} must be a valid number.` };
  }
  const num = Number(s);
  if (isNaN(num) || !isFinite(num)) {
    return { isValid: false, error: `${fieldName} must be a valid number.` };
  }
  if (num < min || num > max) {
    const unitSuffix = unit ? ` ${unit}` : '';
    return { isValid: false, error: `${fieldName} must be between ${min} and ${max}${unitSuffix}.` };
  }
  return { isValid: true, error: null, value: num };
}

/**
 * Validates text fields that require meaningful names or descriptions:
 * - Rejects numeric-only values (e.g. "12345", "12.5")
 * - Requires at least one alphabetic character (Unicode letters)
 * - Preserves clinical notes, valid identifiers, units, and text legitimately containing numbers (e.g. "Walking 30 mins", "Type 2 Diabetes")
 */
export function validateDescriptiveText(val, fieldName, isRequired = false, maxLength = 1000) {
  if (val === undefined || val === null || val === '') {
    if (isRequired) {
      return { isValid: false, error: `${fieldName} is required.` };
    }
    return { isValid: true, error: null };
  }

  const trimmed = String(val).trim();
  if (trimmed.length === 0) {
    if (isRequired) {
      return { isValid: false, error: `${fieldName} is required.` };
    }
    return { isValid: true, error: null };
  }

  if (trimmed.length > maxLength) {
    return { isValid: false, error: `${fieldName} must be under ${maxLength} characters.` };
  }

  // Reject numeric-only input or strings without any alphabetic letters
  if (/^[+-]?(\d+(\.\d+)?|\.\d+)$/.test(trimmed) || !/[\p{L}]/u.test(trimmed)) {
    return {
      isValid: false,
      error: `${fieldName} must be descriptive text (e.g. Walking, Yoga), not numbers only.`,
    };
  }

  return { isValid: true, error: null, value: trimmed };
}

/**
 * Validates Lab Observed Value:
 * Accepts numbers and decimals; rejects malformed numbers, arbitrary non-numeric text, NaN, Infinity.
 * Accepts recognized qualitative results.
 */
export function isValidLabValue(val) {
  if (val === undefined || val === null) return false;
  const s = String(val).trim();
  if (!s) return false;
  if (/^(nan|infinity|-infinity)$/i.test(s)) return false;

  const numericRegex = /^[+-]?(\d+(\.\d+)?|\.\d+)$/;
  if (numericRegex.test(s)) {
    const num = Number(s);
    return !isNaN(num) && isFinite(num);
  }

  const qualitativeSet = new Set([
    'positive', 'negative', 'reactive', 'non-reactive', 'nonreactive',
    'present', 'absent', 'trace', 'normal', 'abnormal', 'borderline',
    'detected', 'not detected', 'indeterminate'
  ]);
  return qualitativeSet.has(s.toLowerCase());
}

/**
 * Validates Reference Range:
 * Validates format (numeric range e.g. "70 - 99", bound e.g. "< 100", qualitative e.g. "Negative").
 * Rejects reversed numeric ranges (e.g. "99 - 70") and malformed strings.
 */
export function validateReferenceRange(rangeStr) {
  if (rangeStr === undefined || rangeStr === null || String(rangeStr).trim() === '') {
    return { valid: true, error: null };
  }
  const s = String(rangeStr).trim();
  if (s.length > 80) {
    return { valid: false, error: 'Reference range must be under 80 characters.' };
  }

  // 1. Numeric range: min - max, min – max, min to max
  const rangeMatch = s.match(/^([+-]?\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*([+-]?\d+(?:\.\d+)?)$/i);
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[2]);
    if (isNaN(min) || isNaN(max)) {
      return { valid: false, error: 'Reference range contains invalid numbers.' };
    }
    if (min > max) {
      return { valid: false, error: 'Reference range cannot be reversed (minimum cannot exceed maximum).' };
    }
    return { valid: true, error: null, type: 'numeric_range', min, max };
  }

  // 2. Bound / inequality: "< 100", "<= 140", "> 60", ">= 50", "under 100", "over 50", "less than 100"
  const boundMatch = s.match(/^(<|<=|>|>=|less than|greater than|under|over)\s*([+-]?\d+(?:\.\d+)?)$/i);
  if (boundMatch) {
    const val = parseFloat(boundMatch[2]);
    if (isNaN(val)) {
      return { valid: false, error: 'Reference range bound contains an invalid number.' };
    }
    return { valid: true, error: null, type: 'bound', operator: boundMatch[1].toLowerCase(), value: val };
  }

  // 3. Qualitative range
  const qualSet = new Set(['negative', 'non-reactive', 'nonreactive', 'normal', 'absent', 'undetected', 'not detected']);
  if (qualSet.has(s.toLowerCase())) {
    return { valid: true, error: null, type: 'qualitative', value: s.toLowerCase() };
  }

  return { valid: false, error: 'Reference range must be a supported format like "70 - 99", "< 100", or "Negative".' };
}

/**
 * Determine Lab Status automatically from observed value and reference range.
 * Returns 'normal', 'abnormal', 'critical', or null (if unable to determine).
 * Never guesses when range is missing, invalid, or incompatible.
 */
export function determineLabStatus(value, referenceRange) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return null;
  }
  if (referenceRange === undefined || referenceRange === null || String(referenceRange).trim() === '') {
    return null;
  }

  const rangeCheck = validateReferenceRange(referenceRange);
  if (!rangeCheck.valid) {
    return null;
  }

  const valStr = String(value).trim();
  const numericRegex = /^[+-]?(\d+(\.\d+)?|\.\d+)$/;
  const isNumericVal = numericRegex.test(valStr);

  // If reference range is numeric range
  if (rangeCheck.type === 'numeric_range') {
    if (!isNumericVal) return null;
    const num = parseFloat(valStr);
    if (isNaN(num)) return null;

    const { min, max } = rangeCheck;
    if (num >= min && num <= max) {
      return 'normal';
    }

    const span = max - min;
    if (span > 0 && (num < min - span || num > max + span)) {
      return 'critical';
    }
    return 'abnormal';
  }

  // If reference range is bound
  if (rangeCheck.type === 'bound') {
    if (!isNumericVal) return null;
    const num = parseFloat(valStr);
    if (isNaN(num)) return null;

    const bound = rangeCheck.value;
    const op = rangeCheck.operator;

    if (op === '<' || op === '<=' || op === 'less than' || op === 'under') {
      if (num <= bound) {
        return 'normal';
      }
      if (num > (bound > 0 ? bound * 1.5 : bound + Math.abs(bound) * 0.5)) {
        return 'critical';
      }
      return 'abnormal';
    }

    if (op === '>' || op === '>=' || op === 'greater than' || op === 'over') {
      if (num >= bound) {
        return 'normal';
      }
      if (num < (bound > 0 ? bound * 0.5 : bound - Math.abs(bound) * 0.5)) {
        return 'critical';
      }
      return 'abnormal';
    }
  }

  // If reference range is qualitative
  if (rangeCheck.type === 'qualitative') {
    const valLower = valStr.toLowerCase();
    const normalSet = new Set(['negative', 'non-reactive', 'nonreactive', 'absent', 'undetected', 'not detected', 'normal']);
    const abnormalSet = new Set(['positive', 'reactive', 'present', 'detected', 'abnormal']);

    if (normalSet.has(valLower)) {
      return 'normal';
    }
    if (abnormalSet.has(valLower)) {
      return 'abnormal';
    }
    return null;
  }

  return null;
}

/**
 * Validate that deterministic nutrition targets are present, belong to the current patient/assessment,
 * and match clinical measurements (height, weight, age, sex, activity_level, diet_goal).
 */
export function validateNutritionTargetFreshness({
  nutritionTargets,
  currentInputs = {},
  targetInputsSnapshot = null,
  patient = null,
  assessment = null,
}) {
  const ERROR_MSG = 'Deterministic nutrition targets are out of date or missing. Please recompute targets in Section 10 before generating a 7-day diet plan.';

  // 1. Missing target check
  if (!nutritionTargets || typeof nutritionTargets !== 'object' || Object.keys(nutritionTargets).length === 0) {
    return { valid: false, isMissing: true, isStale: false, error: ERROR_MSG };
  }

  // Ensure it has basic target output (energy or macros)
  const hasTargetEnergy = Boolean(
    nutritionTargets.energy?.target_energy_kcal_day ||
    nutritionTargets.target_energy_kcal_day
  );
  if (!hasTargetEnergy) {
    return { valid: false, isMissing: true, isStale: false, error: ERROR_MSG };
  }

  // 2. Patient association check: if targets specify patient_id, must match current patient
  if (patient && nutritionTargets.patient_id) {
    const targetPatientId = String(nutritionTargets.patient_id);
    const currId = patient.id !== undefined && patient.id !== null ? String(patient.id) : null;
    const currCode = patient.patient_code ? String(patient.patient_code) : null;
    const isTemp = targetPatientId === 'TEMP' || targetPatientId === 'temp';
    if (!isTemp) {
      if (currId && currCode) {
        if (targetPatientId !== currId && targetPatientId !== currCode) {
          return { valid: false, isMissing: false, isStale: true, error: ERROR_MSG };
        }
      } else if (currId && targetPatientId !== currId) {
        return { valid: false, isMissing: false, isStale: true, error: ERROR_MSG };
      } else if (currCode && targetPatientId !== currCode) {
        return { valid: false, isMissing: false, isStale: true, error: ERROR_MSG };
      }
    }
  }

  // 3. Assessment association check: if both target and assessment have IDs and differ
  if (assessment?.id && nutritionTargets.assessment_id) {
    if (String(nutritionTargets.assessment_id) !== String(assessment.id)) {
      return { valid: false, isMissing: false, isStale: true, error: ERROR_MSG };
    }
  }

  // 4. Input Freshness Check
  const snapshot = targetInputsSnapshot || (nutritionTargets.anthropometrics ? {
    height: nutritionTargets.anthropometrics.height_cm,
    weight: nutritionTargets.anthropometrics.weight_kg,
    age: nutritionTargets.energy?.age ?? (patient?.age ?? ''),
    sex: nutritionTargets.energy?.sex ?? (patient?.sex ?? 'male'),
    activity_level: nutritionTargets.energy?.activity_level || 'sedentary',
    diet_goal: nutritionTargets.energy?.goal || 'general_healthy_diet',
  } : null);

  if (snapshot) {
    // Numeric comparison for height and weight (handles 175 vs 175.00)
    const currH = Number(currentInputs.height);
    const snapH = Number(snapshot.height);
    if (!isNaN(currH) && !isNaN(snapH) && Math.abs(currH - snapH) > 0.001) {
      return { valid: false, isMissing: false, isStale: true, error: ERROR_MSG };
    }

    const currW = Number(currentInputs.weight);
    const snapW = Number(snapshot.weight);
    if (!isNaN(currW) && !isNaN(snapW) && Math.abs(currW - snapW) > 0.001) {
      return { valid: false, isMissing: false, isStale: true, error: ERROR_MSG };
    }

    // Age comparison
    const currAge = Number(currentInputs.age !== undefined && currentInputs.age !== '' ? currentInputs.age : (patient?.age ?? NaN));
    const snapAge = Number(snapshot.age);
    if (!isNaN(currAge) && !isNaN(snapAge) && Math.abs(currAge - snapAge) > 0.001) {
      return { valid: false, isMissing: false, isStale: true, error: ERROR_MSG };
    }

    // Sex comparison (case-insensitive)
    const currSex = String(currentInputs.sex || patient?.sex || '').trim().toLowerCase();
    const snapSex = String(snapshot.sex || '').trim().toLowerCase();
    if (currSex && snapSex && currSex !== snapSex) {
      return { valid: false, isMissing: false, isStale: true, error: ERROR_MSG };
    }

    // Activity level comparison (normalized)
    const currAct = String(currentInputs.activity_level || 'sedentary').trim().toLowerCase();
    const snapAct = String(snapshot.activity_level || 'sedentary').trim().toLowerCase();
    if (currAct !== snapAct) {
      return { valid: false, isMissing: false, isStale: true, error: ERROR_MSG };
    }

    // Diet goal comparison (normalized)
    const currGoal = String(currentInputs.diet_goal || 'general_healthy_diet').trim().toLowerCase();
    const snapGoal = String(snapshot.diet_goal || 'general_healthy_diet').trim().toLowerCase();
    if (currGoal !== snapGoal) {
      return { valid: false, isMissing: false, isStale: true, error: ERROR_MSG };
    }
  }

  return { valid: true, isMissing: false, isStale: false, error: null };
}
