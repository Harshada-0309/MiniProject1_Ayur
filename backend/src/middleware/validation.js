/**
 * Complete Input Validation Middleware for AyurDiet
 * Validates patient details, measurements, enums, dates, phone, email, and downstream calculation requirements.
 */

const VALID_SEX = ['male', 'female', 'other'];

const VALID_DIET_GOALS = [
  'weight_loss',
  'weight_maintenance',
  'weight_gain',
  'general_healthy_diet',
  'condition_specific_nutrition',
];

const VALID_DIET_CATEGORIES = [
  'vegetarian',
  'vegan',
  'eggetarian',
  'non_vegetarian',
  'other',
];

const VALID_PRAKRITI = [
  'Vata',
  'Pitta',
  'Kapha',
  'Vata-Pitta',
  'Pitta-Kapha',
  'Vata-Kapha',
  'Tridosha',
  'Unknown / Not assessed',
];

const VALID_ACTIVITY_LEVELS = [
  'sedentary',
  'lightly_active',
  'moderately_active',
  'very_active',
  'extremely_active',
];

const VALID_WEIGHT_TRENDS = ['stable', 'losing', 'gaining'];

const VALID_SLEEP_QUALITY = ['poor', 'fair', 'good', 'excellent'];

const VALID_APPETITE = [
  'Mandagni (Low)',
  'Tikshnagni (Sharp/High)',
  'Vishamagni (Irregular)',
  'Samagni (Balanced)',
];

const VALID_DIGESTION = [
  'Normal',
  'Bloating',
  'Gas',
  'Acidity',
  'Sluggish/Heavy',
  'Irregular',
];

const VALID_BOWEL_HABITS = [
  'Regular',
  'Constipated',
  'Loose',
  'Irregular',
];

const VALID_MEAL_REGULARITY = ['regular', 'irregular'];

const VALID_SEASONS = [
  'Shishira (Late Winter)',
  'Vasanta (Spring)',
  'Grishma (Summer)',
  'Varsha (Monsoon)',
  'Sharad (Autumn)',
  'Hemanta (Early Winter)',
];

const VALID_REPORTED_FLAGS = ['normal', 'abnormal', 'critical'];

/**
 * Validates person human names (rejects digits, whitespace-only, special symbols; permits Unicode letters, hyphens, apostrophes, spaces)
 */
function validateHumanName(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, message: 'Name is required' };
  }
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    return { valid: false, message: 'Name is required and must be at least 2 characters long' };
  }
  if (trimmed.length > 150) {
    return { valid: false, message: 'Name must be under 150 characters' };
  }
  if (/\d/.test(name)) {
    return { valid: false, message: 'Name cannot contain numerical digits' };
  }
  if (!/^[\p{L}][\p{L}\s'’\.\-]*$/u.test(trimmed)) {
    return { valid: false, message: 'Name contains invalid characters. Only letters, spaces, hyphens, and apostrophes are allowed' };
  }
  return { valid: true };
}

const validatePatientName = validateHumanName;

/**
 * Validates occupation (rejects numbers-only, allows valid job titles)
 */
function validateOccupation(occupation) {
  if (occupation === undefined || occupation === null || occupation === '') {
    return { valid: true };
  }
  if (typeof occupation !== 'string') {
    return { valid: false, message: 'Occupation must be a string' };
  }
  const trimmed = occupation.trim();
  if (trimmed.length === 0) {
    return { valid: true };
  }
  if (trimmed.length > 150) {
    return { valid: false, message: 'Occupation must be under 150 characters' };
  }
  // Reject numbers-only values (e.g. "12345")
  if (/^\d+$/.test(trimmed)) {
    return { valid: false, message: 'Occupation cannot consist solely of numbers. Please enter a valid job title.' };
  }
  return { valid: true };
}

/**
 * Validates whole-number age in completed years (range 0 to 105)
 */
function validateAge(age, isRequired = true) {
  if (age === undefined || age === null || age === '') {
    if (isRequired) {
      return { valid: false, message: 'Age is required and must be an integer between 0 and 105' };
    }
    return { valid: true };
  }

  // Reject malformed strings containing letters, decimals, or negative signs
  if (typeof age === 'string') {
    const trimmed = age.trim();
    if (!/^\d+$/.test(trimmed)) {
      return { valid: false, message: 'Age must be an integer between 0 and 105' };
    }
  }

  const ageNum = Number(age);
  if (!Number.isInteger(ageNum) || isNaN(ageNum) || ageNum < 0 || ageNum > 105) {
    return { valid: false, message: 'Age must be an integer between 0 and 105' };
  }

  return { valid: true, value: ageNum };
}

/**
 * Validates calendar date (YYYY-MM-DD), checks calendar validity, and checks future date constraints
 */
function validateDate(dateStr, fieldName = 'Date', allowFuture = false) {
  if (!dateStr) {
    return { valid: true };
  }
  if (typeof dateStr !== 'string') {
    return { valid: false, message: `${fieldName} must be a valid date string (YYYY-MM-DD)` };
  }

  const trimmed = dateStr.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return { valid: false, message: `${fieldName} must follow YYYY-MM-DD format` };
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (year < 1900 || year > 2100 || month < 1 || month > 12) {
    return { valid: false, message: `${fieldName} contains an invalid year or month` };
  }

  // Check valid day for specific month/leap year
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) {
    return { valid: false, message: `${fieldName} is not a valid calendar day for month ${month}` };
  }

  if (!allowFuture) {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    if (trimmed > todayStr) {
      return { valid: false, message: `${fieldName} cannot be a future date` };
    }
  }

  return { valid: true, value: trimmed };
}

/**
 * Validates phone numbers (permits international +, spaces, hyphens; rejects letters; requires 7-15 digits)
 */
function validatePhone(phone) {
  if (phone === undefined || phone === null || phone === '') {
    return { valid: true };
  }
  if (typeof phone !== 'string') {
    return { valid: false, message: 'Phone must be a string' };
  }
  const trimmed = phone.trim();
  if (trimmed.length === 0) {
    return { valid: true };
  }
  if (trimmed.length > 50) {
    return { valid: false, message: 'Phone number must be under 50 characters' };
  }
  if (/[a-zA-Z]/.test(trimmed)) {
    return { valid: false, message: 'Phone number cannot contain alphabetic characters' };
  }
  if (!/^\+?[\d\s\-\.\(\)]+$/.test(trimmed)) {
    return { valid: false, message: 'Phone number contains invalid characters' };
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) {
    return { valid: false, message: 'Phone number must contain between 7 and 15 digits' };
  }
  return { valid: true, value: trimmed };
}

/**
 * Validates email addresses
 */
function validateEmail(email, isRequired = false) {
  if (email === undefined || email === null || email === '') {
    if (isRequired) {
      return { valid: false, message: 'Email address is required' };
    }
    return { valid: true };
  }
  if (typeof email !== 'string') {
    return { valid: false, message: 'Email must be a string' };
  }
  const trimmed = email.trim();
  if (trimmed.length === 0) {
    if (isRequired) {
      return { valid: false, message: 'Email address is required' };
    }
    return { valid: true };
  }
  if (trimmed.length > 150) {
    return { valid: false, message: 'Email must be under 150 characters' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { valid: false, message: 'Please provide a valid email address' };
  }
  return { valid: true, value: trimmed };
}

/**
 * Validates numeric measurements with bounds and unit specifications:
 * - Accepts finite numbers and decimals
 * - Rejects malformed strings, arbitrary non-numeric text, NaN, Infinity
 */
function validateMeasurement(val, fieldName, min, max, unit = '') {
  if (val === undefined || val === null || val === '') {
    return { valid: true };
  }
  const s = String(val).trim();
  if (s === '') {
    return { valid: true };
  }
  if (!/^[+-]?(\d+(\.\d+)?|\.\d+)$/.test(s)) {
    return { valid: false, message: `${fieldName} must be a valid finite number` };
  }
  const num = Number(s);
  if (isNaN(num) || !isFinite(num)) {
    return { valid: false, message: `${fieldName} must be a valid finite number` };
  }
  if (num < min || num > max) {
    const unitSuffix = unit ? ` ${unit}` : '';
    return { valid: false, message: `${fieldName} must be between ${min} and ${max}${unitSuffix}` };
  }
  return { valid: true, value: num };
}

/**
 * Validates text fields that require meaningful names or descriptions:
 * - Rejects numeric-only values (e.g. "12345", "12.5")
 * - Requires at least one alphabetic character (Unicode letters)
 * - Preserves clinical notes, valid identifiers, units, and text legitimately containing numbers (e.g. "Walking 30 mins", "Type 2 Diabetes")
 */
function validateDescriptiveText(val, fieldName, isRequired = false, maxLength = 1000) {
  if (val === undefined || val === null || val === '') {
    if (isRequired) {
      return { valid: false, message: `${fieldName} is required` };
    }
    return { valid: true };
  }

  const trimmed = String(val).trim();
  if (trimmed.length === 0) {
    if (isRequired) {
      return { valid: false, message: `${fieldName} is required` };
    }
    return { valid: true };
  }

  if (trimmed.length > maxLength) {
    return { valid: false, message: `${fieldName} must be under ${maxLength} characters` };
  }

  // Reject numeric-only input or strings without any alphabetic letters
  if (/^[+-]?(\d+(\.\d+)?|\.\d+)$/.test(trimmed) || !/[\p{L}]/u.test(trimmed)) {
    return {
      valid: false,
      message: `${fieldName} must be descriptive text (e.g. Walking, Yoga), not numbers only`,
    };
  }

  return { valid: true, value: trimmed };
}

/**
 * Middleware: Validate Patient Creation Input
 */
function validatePatientInput(req, res, next) {
  const { name, age, sex, occupation, phone, email } = req.body;
  const errors = [];

  const nameVal = validateHumanName(name);
  if (!nameVal.valid) {
    errors.push({ field: 'name', message: nameVal.message });
  }

  const ageVal = validateAge(age, true);
  if (!ageVal.valid) {
    errors.push({ field: 'age', message: ageVal.message });
  }

  if (!sex || !VALID_SEX.includes(String(sex).toLowerCase())) {
    errors.push({ field: 'sex', message: `Sex is required and must be one of: ${VALID_SEX.join(', ')}` });
  }

  const occVal = validateOccupation(occupation);
  if (!occVal.valid) {
    errors.push({ field: 'occupation', message: occVal.message });
  }

  const phoneVal = validatePhone(phone);
  if (!phoneVal.valid) {
    errors.push({ field: 'phone', message: phoneVal.message });
  }

  const emailVal = validateEmail(email, false);
  if (!emailVal.valid) {
    errors.push({ field: 'email', message: emailVal.message });
  }

  if (errors.length > 0) {
    return res.status(400).json({
      status: 'fail',
      message: 'Validation failed',
      errors,
    });
  }

  next();
}

/**
 * Middleware: Validate Patient Update Input
 */
function validatePatientUpdateInput(req, res, next) {
  const { name, age, sex, occupation, phone, email } = req.body;
  const errors = [];

  if (name !== undefined) {
    const nameVal = validateHumanName(name);
    if (!nameVal.valid) {
      errors.push({ field: 'name', message: nameVal.message });
    }
  }

  if (age !== undefined && age !== null && age !== '') {
    const ageVal = validateAge(age, false);
    if (!ageVal.valid) {
      errors.push({ field: 'age', message: ageVal.message });
    }
  }

  if (sex !== undefined && !VALID_SEX.includes(String(sex).toLowerCase())) {
    errors.push({ field: 'sex', message: `Sex must be one of: ${VALID_SEX.join(', ')}` });
  }

  if (occupation !== undefined) {
    const occVal = validateOccupation(occupation);
    if (!occVal.valid) {
      errors.push({ field: 'occupation', message: occVal.message });
    }
  }

  if (phone !== undefined) {
    const phoneVal = validatePhone(phone);
    if (!phoneVal.valid) {
      errors.push({ field: 'phone', message: phoneVal.message });
    }
  }

  if (email !== undefined) {
    const emailVal = validateEmail(email, false);
    if (!emailVal.valid) {
      errors.push({ field: 'email', message: emailVal.message });
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      status: 'fail',
      message: 'Patient update validation failed',
      errors,
    });
  }

  next();
}

/**
 * Middleware: Validate Assessment Input (All 11 sections)
 */
function validateAssessmentInput(req, res, next) {
  const {
    diet_goal,
    target_weight,
    goal_notes,
    diet_category,
    meal_frequency,
    meal_timings,
    food_preferences,
    foods_disliked,
    food_allergies,
    food_intolerances,
    dietary_restrictions,
    existing_conditions,
    medical_history,
    symptoms,
    supplements,
    prakriti,
    vikriti,
    height,
    weight,
    waist_circumference,
    weight_trend,
    activity_level,
    exercise_type,
    exercise_frequency,
    exercise_duration,
    sleep_duration,
    sleep_quality,
    water_intake,
    appetite,
    digestion,
    bowel_habits,
    meal_regularity,
    season_ritu,
    dietitian_observations,
    assessment_date,
    medications,
    occupation,
    phone,
    email,
  } = req.body;
  const errors = [];

  // Patient demographic updates if supplied with assessment
  const candidateName = req.body.name || req.body.patient_name;
  if (candidateName !== undefined) {
    const nameVal = validateHumanName(candidateName);
    if (!nameVal.valid) {
      errors.push({ field: 'name', message: nameVal.message });
    }
  }

  if (req.body.age !== undefined && req.body.age !== null && req.body.age !== '') {
    const ageVal = validateAge(req.body.age, false);
    if (!ageVal.valid) {
      errors.push({ field: 'age', message: ageVal.message });
    }
  }

  if (req.body.sex !== undefined && !VALID_SEX.includes(String(req.body.sex).toLowerCase())) {
    errors.push({ field: 'sex', message: `Sex must be one of: ${VALID_SEX.join(', ')}` });
  }

  if (occupation !== undefined) {
    const occVal = validateOccupation(occupation);
    if (!occVal.valid) {
      errors.push({ field: 'occupation', message: occVal.message });
    }
  }

  if (phone !== undefined) {
    const phoneVal = validatePhone(phone);
    if (!phoneVal.valid) {
      errors.push({ field: 'phone', message: phoneVal.message });
    }
  }

  if (email !== undefined) {
    const emailVal = validateEmail(email, false);
    if (!emailVal.valid) {
      errors.push({ field: 'email', message: emailVal.message });
    }
  }

  // Section 1: Assessment Date
  if (assessment_date !== undefined && assessment_date !== null && assessment_date !== '') {
    const dateVal = validateDate(assessment_date, 'Assessment date', false);
    if (!dateVal.valid) {
      errors.push({ field: 'assessment_date', message: dateVal.message });
    }
  }

  // Section 2: Measurements
  if (height !== undefined && height !== null && height !== '') {
    const hVal = validateMeasurement(height, 'Height', 30.0, 300.0, 'cm');
    if (!hVal.valid) {
      errors.push({ field: 'height', message: hVal.message });
    }
  }

  if (weight !== undefined && weight !== null && weight !== '') {
    const wVal = validateMeasurement(weight, 'Weight', 10.0, 500.0, 'kg');
    if (!wVal.valid) {
      errors.push({ field: 'weight', message: wVal.message });
    }
  }

  if (waist_circumference !== undefined && waist_circumference !== null && waist_circumference !== '') {
    const waistVal = validateMeasurement(waist_circumference, 'Waist circumference', 30.0, 250.0, 'cm');
    if (!waistVal.valid) {
      errors.push({ field: 'waist_circumference', message: waistVal.message });
    }
  }

  if (weight_trend && !VALID_WEIGHT_TRENDS.includes(weight_trend)) {
    errors.push({
      field: 'weight_trend',
      message: `weight_trend must be one of: ${VALID_WEIGHT_TRENDS.join(', ')}`,
    });
  }

  // Section 3: Diet Goal
  if (!diet_goal || !VALID_DIET_GOALS.includes(diet_goal)) {
    errors.push({
      field: 'diet_goal',
      message: `diet_goal is required and must be one of: ${VALID_DIET_GOALS.join(', ')}`,
    });
  }

  if (target_weight !== undefined && target_weight !== null && target_weight !== '') {
    const twVal = validateMeasurement(target_weight, 'Target weight', 10.0, 500.0, 'kg');
    if (!twVal.valid) {
      errors.push({ field: 'target_weight', message: twVal.message });
    }
  }

  if (goal_notes !== undefined && goal_notes !== null && goal_notes !== '') {
    const gnVal = validateDescriptiveText(goal_notes, 'Goal notes', false, 1000);
    if (!gnVal.valid) {
      errors.push({ field: 'goal_notes', message: gnVal.message });
    }
  }

  // Section 4: Lifestyle
  if (activity_level && !VALID_ACTIVITY_LEVELS.includes(activity_level)) {
    errors.push({
      field: 'activity_level',
      message: `activity_level must be one of: ${VALID_ACTIVITY_LEVELS.join(', ')}`,
    });
  }

  if (exercise_type !== undefined && exercise_type !== null && exercise_type !== '') {
    const etVal = validateDescriptiveText(exercise_type, 'Exercise type', false, 100);
    if (!etVal.valid) {
      errors.push({ field: 'exercise_type', message: etVal.message });
    }
  }

  if (exercise_frequency !== undefined && exercise_frequency !== null && exercise_frequency !== '') {
    const efVal = validateDescriptiveText(exercise_frequency, 'Exercise frequency', false, 60);
    if (!efVal.valid) {
      errors.push({ field: 'exercise_frequency', message: efVal.message });
    }
  }

  if (exercise_duration !== undefined && exercise_duration !== null && exercise_duration !== '') {
    const edVal = validateDescriptiveText(exercise_duration, 'Exercise duration', false, 60);
    if (!edVal.valid) {
      errors.push({ field: 'exercise_duration', message: edVal.message });
    }
  }

  if (sleep_duration !== undefined && sleep_duration !== null && sleep_duration !== '') {
    const sdVal = validateMeasurement(sleep_duration, 'Sleep duration', 0.0, 24.0, 'hours');
    if (!sdVal.valid) {
      errors.push({ field: 'sleep_duration', message: sdVal.message });
    }
  }

  if (sleep_quality && !VALID_SLEEP_QUALITY.includes(sleep_quality)) {
    errors.push({
      field: 'sleep_quality',
      message: `sleep_quality must be one of: ${VALID_SLEEP_QUALITY.join(', ')}`,
    });
  }

  if (water_intake !== undefined && water_intake !== null && water_intake !== '') {
    const wiVal = validateMeasurement(water_intake, 'Water intake', 0.0, 20.0, 'litres');
    if (!wiVal.valid) {
      errors.push({ field: 'water_intake', message: wiVal.message });
    }
  }

  // Section 5: Dietary Profile
  if (!diet_category || !VALID_DIET_CATEGORIES.includes(diet_category)) {
    errors.push({
      field: 'diet_category',
      message: `diet_category is required and must be one of: ${VALID_DIET_CATEGORIES.join(', ')}`,
    });
  }

  if (meal_frequency !== undefined && meal_frequency !== null && meal_frequency !== '') {
    if (typeof meal_frequency === 'string' && !/^\d+$/.test(meal_frequency.trim())) {
      errors.push({ field: 'meal_frequency', message: 'Meal frequency must be an integer between 1 and 8' });
    } else {
      const mf = Number(meal_frequency);
      if (!Number.isInteger(mf) || isNaN(mf) || mf < 1 || mf > 8) {
        errors.push({ field: 'meal_frequency', message: 'Meal frequency must be an integer between 1 and 8' });
      }
    }
  }

  if (meal_timings !== undefined && meal_timings !== null && meal_timings !== '') {
    const mtList = Array.isArray(meal_timings) ? meal_timings : [meal_timings];
    for (const mt of mtList) {
      if (typeof mt === 'string' && mt.trim().length > 0) {
        const mtVal = validateDescriptiveText(mt, 'Meal timings', false, 250);
        if (!mtVal.valid) {
          errors.push({ field: 'meal_timings', message: mtVal.message });
          break;
        }
      }
    }
  }

  if (food_preferences !== undefined && food_preferences !== null && food_preferences !== '') {
    const fpVal = validateDescriptiveText(food_preferences, 'Food preferences', false, 1000);
    if (!fpVal.valid) {
      errors.push({ field: 'food_preferences', message: fpVal.message });
    }
  }

  if (foods_disliked !== undefined && foods_disliked !== null && foods_disliked !== '') {
    const fdVal = validateDescriptiveText(foods_disliked, 'Foods disliked', false, 1000);
    if (!fdVal.valid) {
      errors.push({ field: 'foods_disliked', message: fdVal.message });
    }
  }

  // Section 6: Safety Restrictions
  const validateTextList = (val, fieldName, fieldKey) => {
    if (val === undefined || val === null || val === '') return;
    const items = Array.isArray(val)
      ? val
      : typeof val === 'string'
      ? val.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    for (const item of items) {
      if (typeof item === 'string' && item.trim().length > 0) {
        const itVal = validateDescriptiveText(item, fieldName, false, 250);
        if (!itVal.valid) {
          errors.push({ field: fieldKey || fieldName, message: itVal.message });
          break;
        }
      }
    }
  };

  validateTextList(food_allergies, 'Food allergies', 'food_allergies');
  validateTextList(food_intolerances, 'Food intolerances', 'food_intolerances');
  validateTextList(dietary_restrictions, 'Dietary restrictions', 'dietary_restrictions');

  // Section 7: Medical Information
  validateTextList(existing_conditions, 'Existing conditions', 'existing_conditions');

  if (symptoms !== undefined && symptoms !== null && symptoms !== '') {
    const symList = Array.isArray(symptoms) ? symptoms : [symptoms];
    for (const sym of symList) {
      if (typeof sym === 'string' && sym.trim().length > 0) {
        const symVal = validateDescriptiveText(sym, 'Symptoms', false, 250);
        if (!symVal.valid) {
          errors.push({ field: 'symptoms', message: symVal.message });
          break;
        }
      } else if (typeof sym === 'object' && sym !== null) {
        const textToTest = sym.symptom || sym.name || sym.text;
        if (textToTest && typeof textToTest === 'string') {
          const symVal = validateDescriptiveText(textToTest, 'Symptoms', false, 250);
          if (!symVal.valid) {
            errors.push({ field: 'symptoms', message: symVal.message });
            break;
          }
        }
      }
    }
  }

  if (medical_history !== undefined && medical_history !== null && medical_history !== '') {
    const mhVal = validateDescriptiveText(medical_history, 'Medical history', false, 2000);
    if (!mhVal.valid) {
      errors.push({ field: 'medical_history', message: mhVal.message });
    }
  }

  if (supplements !== undefined && supplements !== null && supplements !== '') {
    const supVal = validateDescriptiveText(supplements, 'Supplements', false, 1000);
    if (!supVal.valid) {
      errors.push({ field: 'supplements', message: supVal.message });
    }
  }

  // Section 7: Medications Array validation
  if (medications !== undefined) {
    if (!Array.isArray(medications)) {
      errors.push({ field: 'medications', message: 'Medications must be an array of records' });
    } else {
      medications.forEach((med, idx) => {
        if (typeof med !== 'object' || med === null) {
          errors.push({ field: `medications[${idx}]`, message: 'Medication row must be an object' });
          return;
        }
        // If row has some fields filled, medication_name must be non-empty
        const nameGiven = med.medication_name && typeof med.medication_name === 'string' && med.medication_name.trim().length > 0;
        const otherFieldsFilled = (med.dosage && med.dosage.trim().length > 0) ||
                                  (med.frequency && med.frequency.trim().length > 0) ||
                                  (med.purpose && med.purpose.trim().length > 0);
        if (otherFieldsFilled && !nameGiven) {
          errors.push({ field: `medications[${idx}].medication_name`, message: `Medication name is required for row ${idx + 1}` });
        }
        if (nameGiven) {
          const mTextVal = validateDescriptiveText(med.medication_name, `Medication name for row ${idx + 1}`, false, 150);
          if (!mTextVal.valid) {
            errors.push({ field: `medications[${idx}].medication_name`, message: mTextVal.message });
          }
        }
      });
    }
  }

  // Section 8: Ayurvedic Information
  if (!prakriti || !VALID_PRAKRITI.includes(prakriti)) {
    errors.push({
      field: 'prakriti',
      message: `prakriti is required and must be one of: ${VALID_PRAKRITI.join(', ')}`,
    });
  }

  if (vikriti !== undefined && vikriti !== null && vikriti !== '') {
    const vikVal = validateDescriptiveText(vikriti, 'Vikriti', false, 500);
    if (!vikVal.valid) {
      errors.push({ field: 'vikriti', message: vikVal.message });
    }
  }

  if (appetite && !VALID_APPETITE.includes(appetite)) {
    errors.push({
      field: 'appetite',
      message: `appetite must be one of: ${VALID_APPETITE.join(', ')}`,
    });
  }

  if (digestion && !VALID_DIGESTION.includes(digestion)) {
    errors.push({
      field: 'digestion',
      message: `digestion must be one of: ${VALID_DIGESTION.join(', ')}`,
    });
  }

  if (bowel_habits && !VALID_BOWEL_HABITS.includes(bowel_habits)) {
    errors.push({
      field: 'bowel_habits',
      message: `bowel_habits must be one of: ${VALID_BOWEL_HABITS.join(', ')}`,
    });
  }

  if (meal_regularity && !VALID_MEAL_REGULARITY.includes(meal_regularity)) {
    errors.push({
      field: 'meal_regularity',
      message: `meal_regularity must be one of: ${VALID_MEAL_REGULARITY.join(', ')}`,
    });
  }

  if (season_ritu && !VALID_SEASONS.includes(season_ritu)) {
    errors.push({
      field: 'season_ritu',
      message: `season_ritu must be one of: ${VALID_SEASONS.join(', ')}`,
    });
  }

  if (dietitian_observations !== undefined && dietitian_observations !== null && dietitian_observations !== '') {
    const obsVal = validateDescriptiveText(dietitian_observations, 'Dietitian observations', false, 2000);
    if (!obsVal.valid) {
      errors.push({ field: 'dietitian_observations', message: obsVal.message });
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      status: 'fail',
      message: 'Assessment validation failed',
      errors,
    });
  }

  next();
}

/**
/**
 * Validate Lab Value:
 * Accepts valid finite numbers and decimals.
 * Rejects malformed numbers, arbitrary non-numeric text, NaN, Infinity.
 * Accepts recognized qualitative results.
 */
function isValidLabValue(val) {
  if (val === undefined || val === null) return false;
  const s = String(val).trim();
  if (!s) return false;
  if (/^(nan|infinity|-infinity)$/i.test(s)) return false;

  // Numeric check: permits optional sign, digits, decimal point
  const numericRegex = /^[+-]?(\d+(\.\d+)?|\.\d+)$/;
  if (numericRegex.test(s)) {
    const num = Number(s);
    return !isNaN(num) && isFinite(num);
  }

  // Qualitative results
  const qualitativeSet = new Set([
    'positive', 'negative', 'reactive', 'non-reactive', 'nonreactive',
    'present', 'absent', 'trace', 'normal', 'abnormal', 'borderline',
    'detected', 'not detected', 'indeterminate'
  ]);
  return qualitativeSet.has(s.toLowerCase());
}

/**
 * Validate Reference Range:
 * Validates format (numeric range e.g. "70 - 99", bound e.g. "< 100", qualitative e.g. "Negative").
 * Rejects reversed numeric ranges (e.g. "99 - 70") and malformed strings.
 */
function validateReferenceRange(rangeStr) {
  if (rangeStr === undefined || rangeStr === null || String(rangeStr).trim() === '') {
    return { valid: true };
  }
  const s = String(rangeStr).trim();
  if (s.length > 80) {
    return { valid: false, message: 'Reference range must be under 80 characters' };
  }

  // 1. Numeric range: min - max, min – max, min to max
  const rangeMatch = s.match(/^([+-]?\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*([+-]?\d+(?:\.\d+)?)$/i);
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[2]);
    if (isNaN(min) || isNaN(max)) {
      return { valid: false, message: 'Reference range contains invalid numbers' };
    }
    if (min > max) {
      return { valid: false, message: 'Reference range cannot be reversed (minimum cannot exceed maximum)' };
    }
    return { valid: true, type: 'numeric_range', min, max };
  }

  // 2. Bound / inequality: "< 100", "<= 140", "> 60", ">= 50", "under 100", "over 50", "less than 100"
  const boundMatch = s.match(/^(<|<=|>|>=|less than|greater than|under|over)\s*([+-]?\d+(?:\.\d+)?)$/i);
  if (boundMatch) {
    const val = parseFloat(boundMatch[2]);
    if (isNaN(val)) {
      return { valid: false, message: 'Reference range bound contains an invalid number' };
    }
    return { valid: true, type: 'bound', operator: boundMatch[1].toLowerCase(), value: val };
  }

  // 3. Qualitative range
  const qualSet = new Set(['negative', 'non-reactive', 'nonreactive', 'normal', 'absent', 'undetected', 'not detected']);
  if (qualSet.has(s.toLowerCase())) {
    return { valid: true, type: 'qualitative', value: s.toLowerCase() };
  }

  return { valid: false, message: 'Reference range must be a supported format like "70 - 99", "< 100", or "Negative"' };
}

/**
 * Determine Lab Status automatically from observed value and reference range.
 * Returns 'normal', 'abnormal', 'critical', or null (if unable to determine).
 * Never guesses when range is missing, invalid, or incompatible.
 */
function determineLabStatus(value, referenceRange) {
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
    if (!isNumericVal) return null; // Incompatible
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
    if (!isNumericVal) return null; // Incompatible
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
 * Middleware: Validate Clinical Laboratory Input
 */
function validateLabDataInput(req, res, next) {
  const { test_name, value, unit, reference_range, test_date, source_laboratory } = req.body;
  const errors = [];
  const isUpdate = req.method === 'PUT' || req.method === 'PATCH';

  // 1. Test Name: meaningful text, not empty or numeric-only, contains letters
  if (!isUpdate || test_name !== undefined) {
    if (!test_name || typeof test_name !== 'string' || test_name.trim().length === 0) {
      errors.push({ field: 'test_name', message: 'Test name is required' });
    } else if (test_name.trim().length > 150) {
      errors.push({ field: 'test_name', message: 'Test name must be under 150 characters' });
    } else if (/^\d+(\.\d+)?$/.test(test_name.trim()) || !/[a-zA-Z]/.test(test_name.trim())) {
      errors.push({ field: 'test_name', message: 'Test name must contain meaningful text, not numbers only' });
    }
  }

  // 2. Observed Value: valid number/decimal or legitimate qualitative result; reject arbitrary text, NaN, Infinity
  if (!isUpdate || value !== undefined) {
    if (value === undefined || value === null || String(value).trim().length === 0) {
      errors.push({ field: 'value', message: 'Test value is required' });
    } else if (String(value).trim().length > 80) {
      errors.push({ field: 'value', message: 'Test value must be under 80 characters' });
    } else if (!isValidLabValue(value)) {
      errors.push({ field: 'value', message: 'Observed value must be a valid number or recognized qualitative result' });
    }
  }

  // 3. Unit: text and symbols, not a numeric measurement
  if (unit !== undefined && unit !== null && String(unit).trim().length > 0) {
    const u = String(unit).trim();
    if (u.length > 50) {
      errors.push({ field: 'unit', message: 'Unit must be under 50 characters' });
    } else if (/^\d+(\.\d+)?$/.test(u)) {
      errors.push({ field: 'unit', message: 'Unit must be text or symbols (e.g. mg/dL, %), not a number' });
    }
  }

  // 4. Reference Range: supported format, reject reversed numeric ranges and malformed strings
  if (reference_range !== undefined && reference_range !== null && String(reference_range).trim().length > 0) {
    const rangeCheck = validateReferenceRange(reference_range);
    if (!rangeCheck.valid) {
      errors.push({ field: 'reference_range', message: rangeCheck.message });
    }
  }

  // 5. Source Laboratory: facility name, not a numeric measurement
  if (source_laboratory !== undefined && source_laboratory !== null && String(source_laboratory).trim().length > 0) {
    const lab = String(source_laboratory).trim();
    if (lab.length > 150) {
      errors.push({ field: 'source_laboratory', message: 'Source laboratory must be under 150 characters' });
    } else if (/^\d+(\.\d+)?$/.test(lab) || !/[a-zA-Z]/.test(lab)) {
      errors.push({ field: 'source_laboratory', message: 'Source laboratory must be a valid facility name, not a numeric measurement' });
    }
  }

  // 6. Test Date: valid calendar date (YYYY-MM-DD), not in the future, allows past historical dates
  if (test_date !== undefined && test_date !== null && test_date !== '') {
    const dateVal = validateDate(test_date, 'Test date', false);
    if (!dateVal.valid) {
      errors.push({ field: 'test_date', message: dateVal.message });
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      status: 'fail',
      message: 'Lab data validation failed',
      errors,
    });
  }

  next();
}

/**
 * Middleware: Validate Nutrition Target Calculation Input
 */
function validateNutritionCalculateInput(req, res, next) {
  const { age, sex, height, weight, activity_level, diet_goal, target_weight } = req.body;
  const errors = [];

  const ageVal = validateAge(age, true);
  if (!ageVal.valid) {
    errors.push({ field: 'age', message: ageVal.message });
  }

  if (!sex || !VALID_SEX.includes(String(sex).toLowerCase())) {
    errors.push({ field: 'sex', message: `Sex is required and must be one of: ${VALID_SEX.join(', ')}` });
  }

  const hVal = validateMeasurement(height, 'Height', 30.0, 300.0, 'cm');
  if (height === undefined || height === null || height === '' || !hVal.valid) {
    errors.push({ field: 'height', message: hVal.valid ? 'Height is required for calculation' : hVal.message });
  }

  const wVal = validateMeasurement(weight, 'Weight', 10.0, 500.0, 'kg');
  if (weight === undefined || weight === null || weight === '' || !wVal.valid) {
    errors.push({ field: 'weight', message: wVal.valid ? 'Weight is required for calculation' : wVal.message });
  }

  if (activity_level && !VALID_ACTIVITY_LEVELS.includes(activity_level)) {
    errors.push({ field: 'activity_level', message: `activity_level must be one of: ${VALID_ACTIVITY_LEVELS.join(', ')}` });
  }

  if (!diet_goal || !VALID_DIET_GOALS.includes(diet_goal)) {
    errors.push({ field: 'diet_goal', message: `diet_goal is required and must be one of: ${VALID_DIET_GOALS.join(', ')}` });
  }

  if (target_weight !== undefined && target_weight !== null && target_weight !== '') {
    const twVal = validateMeasurement(target_weight, 'Target weight', 10.0, 500.0, 'kg');
    if (!twVal.valid) {
      errors.push({ field: 'target_weight', message: twVal.message });
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      status: 'fail',
      message: 'Nutrition calculation input validation failed',
      errors,
    });
  }

  next();
}

/**
 * Middleware: Validate Meal Plan Generation Input
 */
function validateMealPlanGenerateInput(req, res, next) {
  const { patient_assessment, nutrition_targets } = req.body;
  if (!patient_assessment || typeof patient_assessment !== 'object') {
    return res.status(400).json({
      status: 'fail',
      message: 'patient_assessment object is required for meal plan generation',
      errors: [{ field: 'patient_assessment', message: 'patient_assessment is required' }],
    });
  }

  const errors = [];
  const { diet_category, diet_goal } = patient_assessment;

  if (diet_category && !VALID_DIET_CATEGORIES.includes(diet_category)) {
    errors.push({ field: 'patient_assessment.diet_category', message: `diet_category must be one of: ${VALID_DIET_CATEGORIES.join(', ')}` });
  }

  if (diet_goal && !VALID_DIET_GOALS.includes(diet_goal)) {
    errors.push({ field: 'patient_assessment.diet_goal', message: `diet_goal must be one of: ${VALID_DIET_GOALS.join(', ')}` });
  }

  if (errors.length > 0) {
    return res.status(400).json({
      status: 'fail',
      message: 'Meal plan generation validation failed',
      errors,
    });
  }

  next();
}

/**
 * Validate that deterministic nutrition targets are present, belong to the current patient/assessment,
 * and match clinical measurements (height, weight, age, sex, activity_level, diet_goal).
 */
function validateNutritionTargetFreshness({
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
    const currH = Number(currentInputs.height !== undefined && currentInputs.height !== '' ? currentInputs.height : (assessment?.height ?? NaN));
    const snapH = Number(snapshot.height);
    if (!isNaN(currH) && !isNaN(snapH) && Math.abs(currH - snapH) > 0.001) {
      return { valid: false, isMissing: false, isStale: true, error: ERROR_MSG };
    }

    const currW = Number(currentInputs.weight !== undefined && currentInputs.weight !== '' ? currentInputs.weight : (assessment?.weight ?? NaN));
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
    const currAct = String(currentInputs.activity_level || assessment?.activity_level || 'sedentary').trim().toLowerCase();
    const snapAct = String(snapshot.activity_level || 'sedentary').trim().toLowerCase();
    if (currAct !== snapAct) {
      return { valid: false, isMissing: false, isStale: true, error: ERROR_MSG };
    }

    // Diet goal comparison (normalized)
    const currGoal = String(currentInputs.diet_goal || assessment?.diet_goal || 'general_healthy_diet').trim().toLowerCase();
    const snapGoal = String(snapshot.diet_goal || 'general_healthy_diet').trim().toLowerCase();
    if (currGoal !== snapGoal) {
      return { valid: false, isMissing: false, isStale: true, error: ERROR_MSG };
    }
  }

  return { valid: true, isMissing: false, isStale: false, error: null };
}

module.exports = {
  validatePatientName,
  validateHumanName,
  validateOccupation,
  validateAge,
  validateDate,
  validatePhone,
  validateEmail,
  validateMeasurement,
  validateDescriptiveText,
  validatePatientInput,
  validatePatientUpdateInput,
  validateAssessmentInput,
  validateLabDataInput,
  determineLabStatus,
  validateReferenceRange,
  isValidLabValue,
  validateNutritionCalculateInput,
  validateMealPlanGenerateInput,
  validateNutritionTargetFreshness,
  VALID_SEX,
  VALID_DIET_GOALS,
  VALID_DIET_CATEGORIES,
  VALID_PRAKRITI,
  VALID_ACTIVITY_LEVELS,
  VALID_WEIGHT_TRENDS,
  VALID_SLEEP_QUALITY,
  VALID_APPETITE,
  VALID_DIGESTION,
  VALID_BOWEL_HABITS,
  VALID_MEAL_REGULARITY,
  VALID_SEASONS,
  VALID_REPORTED_FLAGS,
};

