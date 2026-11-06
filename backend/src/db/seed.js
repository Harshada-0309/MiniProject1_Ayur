const patientRepository = require('../repositories/patientRepository');
const assessmentRepository = require('../repositories/assessmentRepository');
const labDataRepository = require('../repositories/labDataRepository');

async function seedData() {
  console.log('[Seed] Populating initial demo dietitian patients and assessments...');

  // 1. Patient 1: Priya Sharma (Pitta-Kapha with Acid Reflux & Weight Management)
  const patient1 = await patientRepository.create({
    patient_code: 'PAT-2026-0001',
    name: 'Priya Sharma',
    age: 38,
    sex: 'female',
    occupation: 'Financial Analyst',
    phone: '+91 98201 44552',
    email: 'priya.sharma@example.com',
    dietitian_id: 1,
  });

  const assessment1 = await assessmentRepository.create(patient1.id, {
    assessment_date: '2026-09-20',
    dietitian_id: 'dietitian-primary',
    height: 162.0,
    weight: 68.5,
    waist_circumference: 84.0,
    weight_trend: 'gaining',
    diet_goal: 'weight_loss',
    target_weight: 58.0,
    goal_notes: 'Gradual weight reduction while calming aggravated Pitta & clearing Kapha lethargy',
    activity_level: 'sedentary',
    exercise_type: 'Walking / occasional yoga',
    exercise_frequency: '2-3 times weekly',
    exercise_duration: '30 mins',
    sleep_duration: 6.5,
    sleep_quality: 'fair',
    water_intake: 2.0,
    diet_category: 'vegetarian',
    meal_frequency: 3,
    meal_timings: ['Breakfast 9:00 AM', 'Lunch 1:30 PM', 'Dinner 9:00 PM'],
    food_preferences: 'Warm cooked lentils, rice, roasted vegetables, herbal infusions',
    foods_disliked: 'Raw onion salads, fried snacks, excessive green chillies',
    food_allergies: ['Peanuts'],
    food_intolerances: ['Lactose (digestive discomfort with whole milk)'],
    dietary_restrictions: ['Moderate sodium', 'Avoid deep-fried foods'],
    existing_conditions: ['Gastroesophageal Reflux Disease (GERD)', 'Mild Dyslipidemia'],
    medical_history: 'Acid reflux for past 18 months, exacerbated by late office dinners',
    symptoms: [
      { symptom: 'Heartburn', severity: 'moderate' },
      { symptom: 'Post-lunch sluggishness', severity: 'mild' },
    ],
    supplements: 'Triphala churna (3g at bedtime with warm water), Vitamin D3 (60k IU)',
    medications: [
      {
        medication_name: 'Pantoprazole',
        dosage: '40mg',
        frequency: 'Once daily before breakfast',
        purpose: 'Acid reflux symptom control',
      },
    ],
    prakriti: 'Pitta-Kapha',
    vikriti: 'Aggravated Pitta (Ushna/Tikshna) with secondary Kapha accumulation (Ama signs)',
    appetite: 'Tikshnagni (Sharp/High)',
    digestion: 'Acidity',
    bowel_habits: 'Regular',
    meal_regularity: 'irregular',
    season_ritu: 'Sharad (Autumn)',
    dietitian_observations: 'Reddened tongue margins with yellow-white thin coating. Recommend cooling Pitta-pacifying diet with light digestive spices.',
  });

  // Lab record for Patient 1
  await labDataRepository.create(assessment1.id, patient1.id, {
    test_name: 'Fasting Blood Sugar (FBS)',
    value: '104',
    unit: 'mg/dL',
    reference_range: '70 - 99',
    test_date: '2026-09-18',
    source_laboratory: 'Metropolis Healthcare',
    reported_flag: 'abnormal',
    report_file_metadata: {
      fileName: 'metropolis_blood_panel_sept2026.pdf',
      fileSize: 524288,
      mimeType: 'application/pdf',
      uploadDate: '2026-09-20T10:30:00Z',
    },
  });

  // 2. Patient 2: Vikram Joshi (Vata constitution, IBS and irregular digestion)
  const patient2 = await patientRepository.create({
    patient_code: 'PAT-2026-0002',
    name: 'Vikram Joshi',
    age: 46,
    sex: 'male',
    occupation: 'Civil Engineer',
    phone: '+91 97112 33445',
    email: 'vikram.j@example.com',
    dietitian_id: 2,
  });

  await assessmentRepository.create(patient2.id, {
    assessment_date: '2026-09-22',
    dietitian_id: 'dietitian-primary',
    height: 178.0,
    weight: 64.0,
    waist_circumference: 78.0,
    weight_trend: 'losing',
    diet_goal: 'weight_gain',
    target_weight: 72.0,
    goal_notes: 'Brimhana nourishing diet to build Dhatu strength and stabilize erratic Vata',
    activity_level: 'moderately_active',
    exercise_type: 'On-site walking and light resistance bands',
    exercise_frequency: '4 days/wk',
    exercise_duration: '40 mins',
    sleep_duration: 6.0,
    sleep_quality: 'poor',
    water_intake: 3.0,
    diet_category: 'vegetarian',
    meal_frequency: 4,
    meal_timings: ['Breakfast 8:00 AM', 'Mid-morning 11:00 AM', 'Lunch 1:30 PM', 'Dinner 8:00 PM'],
    food_preferences: 'Ghee, warm khichdi, almond milk, stewed apples, soaked dates',
    foods_disliked: 'Raw cruciferous salads, cold drinks, astringent beans',
    food_allergies: [],
    food_intolerances: ['Gluten (bloating after wheat)'],
    dietary_restrictions: ['Avoid dry, rough and cold food items'],
    existing_conditions: ['Irritable Bowel Syndrome (IBS-C)', 'Anxiety-related insomnia'],
    medical_history: 'Frequent travel and irregular eating schedule leading to chronic Vata disturbance',
    symptoms: [
      { symptom: 'Constipation & abdominal bloating', severity: 'moderate' },
      { symptom: 'Dry skin and restlessness', severity: 'mild' },
    ],
    supplements: 'Ashwagandha lehyam 5g, Castor oil (5ml once fortnightly)',
    medications: [],
    prakriti: 'Vata',
    vikriti: 'Severe Vata aggravation (Ruksha, Chala, Shita)',
    appetite: 'Vishamagni (Irregular)',
    digestion: 'Bloating',
    bowel_habits: 'Constipated',
    meal_regularity: 'irregular',
    season_ritu: 'Sharad (Autumn)',
    dietitian_observations: 'Dry tongue, mild trembling, irregular bowel evacuation. Advise Snigdha (unctuous), warm, freshly prepared grounding foods.',
  });

  console.log('[Seed] Sample demo patients and assessments created successfully.');
}

module.exports = { seedData };

if (require.main === module) {
  seedData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
