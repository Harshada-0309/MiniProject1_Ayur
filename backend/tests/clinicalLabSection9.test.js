const request = require('supertest');
const app = require('../src/app');
const patientRepository = require('../src/repositories/patientRepository');
const assessmentRepository = require('../src/repositories/assessmentRepository');
const labDataRepository = require('../src/repositories/labDataRepository');
const { generateToken } = require('../src/services/authService');

describe('Section 9: Clinical & Laboratory Data - Validation, Status, and Attachment Deletion', () => {
  let token;
  let patientId;
  let assessmentId;

  const validAssessment = {
    assessment_date: '2026-10-20',
    diet_goal: 'general_healthy_diet',
    diet_category: 'vegetarian',
    prakriti: 'Pitta-Kapha',
    height: 165,
    weight: 60,
  };

  beforeEach(async () => {
    patientRepository._resetMemoryStore();
    assessmentRepository._resetMemoryStore();
    labDataRepository._resetMemoryStore();

    token = generateToken({
      id: 1,
      dietitian_code: 'DIET-2026-001',
      name: 'Dr. Vaidya',
      email: 'vaidya@ayurdiet.clinic',
      role: 'Chief Clinical Dietitian',
    });

    // Create a base test patient
    const pRes = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Aditi Sharma',
        age: 34,
        sex: 'female',
        occupation: 'Researcher',
        phone: '+91 98765 43210',
      });
    patientId = pRes.body.data.patient.id;

    // Create an assessment
    const aRes = await request(app)
      .post(`/api/patients/${patientId}/assessments`)
      .set('Authorization', `Bearer ${token}`)
      .send(validAssessment);
    assessmentId = aRes.body.data.assessment.id;
  });

  describe('A. Field Validation', () => {
    it('1. should reject numeric-only test name', async () => {
      const res = await request(app)
        .post(`/api/assessments/${assessmentId}/lab-data`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          test_name: '12345',
          value: '100',
          unit: 'mg/dL',
        });
      expect(res.status).toBe(400);
      expect(res.body.errors.some((e) => e.field === 'test_name')).toBe(true);
    });

    it('2. should accept valid test names like Complete Blood Count, Fasting Blood Sugar, HbA1c, Vitamin B12', async () => {
      const testNames = [
        'Complete Blood Count',
        'Fasting Blood Sugar',
        'HbA1c',
        'Vitamin B12',
      ];

      for (const name of testNames) {
        const res = await request(app)
          .post(`/api/assessments/${assessmentId}/lab-data`)
          .set('Authorization', `Bearer ${token}`)
          .send({
            test_name: name,
            value: '95',
            unit: 'mg/dL',
            reference_range: '70 - 99',
          });
        expect(res.status).toBe(201);
        expect(res.body.data.labData.test_name).toBe(name);
      }
    });

    it('3. should reject arbitrary text, NaN, and Infinity in observed value', async () => {
      const invalidValues = ['jjgh', 'NaN', 'Infinity', '-Infinity', '12.34.56'];

      for (const val of invalidValues) {
        const res = await request(app)
          .post(`/api/assessments/${assessmentId}/lab-data`)
          .set('Authorization', `Bearer ${token}`)
          .send({
            test_name: 'Fasting Blood Sugar',
            value: val,
            unit: 'mg/dL',
          });
        expect(res.status).toBe(400);
        expect(res.body.errors.some((e) => e.field === 'value')).toBe(true);
      }
    });

    it('4. should accept valid numerical results, decimals, and supported units', async () => {
      const validCases = [
        { value: '115', unit: 'mg/dL' },
        { value: '5.7', unit: '%' },
        { value: '0.8', unit: 'mg/dL' },
        { value: '14.2', unit: 'g/dL' },
        { value: '350', unit: 'IU/L' },
        { value: '4.5', unit: 'mmol/L' },
      ];

      for (const c of validCases) {
        const res = await request(app)
          .post(`/api/assessments/${assessmentId}/lab-data`)
          .set('Authorization', `Bearer ${token}`)
          .send({
            test_name: 'Serum Biomarker',
            value: c.value,
            unit: c.unit,
          });
        expect(res.status).toBe(201);
        expect(res.body.data.labData.value).toBe(c.value);
        expect(res.body.data.labData.unit).toBe(c.unit);
      }
    });

    it('5. should reject numeric-only units', async () => {
      const res = await request(app)
        .post(`/api/assessments/${assessmentId}/lab-data`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          test_name: 'Fasting Blood Sugar',
          value: '100',
          unit: '12345',
        });
      expect(res.status).toBe(400);
      expect(res.body.errors.some((e) => e.field === 'unit')).toBe(true);
    });

    it('6. should reject reversed numeric reference ranges like 99 - 70', async () => {
      const res = await request(app)
        .post(`/api/assessments/${assessmentId}/lab-data`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          test_name: 'Fasting Blood Sugar',
          value: '85',
          unit: 'mg/dL',
          reference_range: '99 - 70',
        });
      expect(res.status).toBe(400);
      expect(res.body.errors.some((e) => e.field === 'reference_range')).toBe(true);
    });

    it('7. should accept valid reference ranges like 70 - 99, < 100, and Negative', async () => {
      const validRanges = ['70 - 99', '4.0 - 5.6', '< 100', '<= 140', '> 60', 'Negative', 'Non-reactive'];

      for (const r of validRanges) {
        const res = await request(app)
          .post(`/api/assessments/${assessmentId}/lab-data`)
          .set('Authorization', `Bearer ${token}`)
          .send({
            test_name: 'Serum Test',
            value: '85',
            unit: 'mg/dL',
            reference_range: r,
          });
        expect(res.status).toBe(201);
      }
    });

    it('8. should reject numeric-only source laboratory', async () => {
      const res = await request(app)
        .post(`/api/assessments/${assessmentId}/lab-data`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          test_name: 'Fasting Blood Sugar',
          value: '85',
          unit: 'mg/dL',
          source_laboratory: '98765',
        });
      expect(res.status).toBe(400);
      expect(res.body.errors.some((e) => e.field === 'source_laboratory')).toBe(true);
    });
  });

  describe('B. Automatic Reported Status', () => {
    it('1. should automatically determine status as normal when within reference range', async () => {
      const res = await request(app)
        .post(`/api/assessments/${assessmentId}/lab-data`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          test_name: 'Fasting Blood Sugar',
          value: '85',
          unit: 'mg/dL',
          reference_range: '70 - 99',
        });
      expect(res.status).toBe(201);
      expect(res.body.data.labData.reported_flag).toBe('normal');
    });

    it('2. should automatically determine status as abnormal when outside reference range', async () => {
      const res = await request(app)
        .post(`/api/assessments/${assessmentId}/lab-data`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          test_name: 'Fasting Blood Sugar',
          value: '115',
          unit: 'mg/dL',
          reference_range: '70 - 99',
        });
      expect(res.status).toBe(201);
      expect(res.body.data.labData.reported_flag).toBe('abnormal');
    });

    it('3. should automatically determine status as critical when significantly deviated', async () => {
      const res = await request(app)
        .post(`/api/assessments/${assessmentId}/lab-data`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          test_name: 'Fasting Blood Sugar',
          value: '250',
          unit: 'mg/dL',
          reference_range: '70 - 99',
        });
      expect(res.status).toBe(201);
      expect(res.body.data.labData.reported_flag).toBe('critical');
    });

    it('4. should produce null (unable to determine) when reference range is missing', async () => {
      const res = await request(app)
        .post(`/api/assessments/${assessmentId}/lab-data`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          test_name: 'Fasting Blood Sugar',
          value: '115',
          unit: 'mg/dL',
        });
      expect(res.status).toBe(201);
      expect(res.body.data.labData.reported_flag).toBeNull();
    });

    it('5. should ignore client-supplied reported_flag and calculate on backend', async () => {
      const res = await request(app)
        .post(`/api/assessments/${assessmentId}/lab-data`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          test_name: 'Fasting Blood Sugar',
          value: '115',
          unit: 'mg/dL',
          reference_range: '70 - 99',
          reported_flag: 'normal', // Client attempt to forge status
        });
      expect(res.status).toBe(201);
      // Backend calculation takes precedence: 115 is abnormal for 70-99
      expect(res.body.data.labData.reported_flag).toBe('abnormal');
    });

    it('6. should recalculate status upon updating value or reference range', async () => {
      const createRes = await request(app)
        .post(`/api/assessments/${assessmentId}/lab-data`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          test_name: 'Fasting Blood Sugar',
          value: '115',
          unit: 'mg/dL',
          reference_range: '70 - 99',
        });
      const labId = createRes.body.data.labData.id;
      expect(createRes.body.data.labData.reported_flag).toBe('abnormal');

      // Update value to 85 (now normal)
      const updateRes = await request(app)
        .put(`/api/lab-data/${labId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          value: '85',
        });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.labData.reported_flag).toBe('normal');
    });
  });

  describe('C. Delete Lab Report Attachment', () => {
    it('1. should delete attachment metadata and leave lab record intact', async () => {
      const createRes = await request(app)
        .post(`/api/assessments/${assessmentId}/lab-data`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          test_name: 'Lipid Panel',
          value: '185',
          unit: 'mg/dL',
          reference_range: '< 200',
          report_file_metadata: {
            fileName: 'lipid_report_oct2026.pdf',
            fileSize: 1048576,
            mimeType: 'application/pdf',
          },
        });
      expect(createRes.status).toBe(201);
      const labId = createRes.body.data.labData.id;
      expect(createRes.body.data.labData.report_file_metadata).toBeDefined();

      // Delete only attachment
      const deleteAttachRes = await request(app)
        .delete(`/api/lab-data/${labId}/attachment`)
        .set('Authorization', `Bearer ${token}`);
      expect(deleteAttachRes.status).toBe(200);
      expect(deleteAttachRes.body.status).toBe('success');
      expect(deleteAttachRes.body.data.labData.report_file_metadata).toBeNull();
      expect(deleteAttachRes.body.data.labData.test_name).toBe('Lipid Panel');
      expect(deleteAttachRes.body.data.labData.value).toBe('185');

      // Verify the record still exists in assessment lab list without attachment
      const getRes = await request(app)
        .get(`/api/assessments/${assessmentId}/lab-data`)
        .set('Authorization', `Bearer ${token}`);
      expect(getRes.status).toBe(200);
      const record = getRes.body.data.labData.find((item) => item.id === labId);
      expect(record).toBeDefined();
      expect(record.test_name).toBe('Lipid Panel');
      expect(record.report_file_metadata).toBeNull();
    });

    it('2. should preserve existing record deletion functionality', async () => {
      const createRes = await request(app)
        .post(`/api/assessments/${assessmentId}/lab-data`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          test_name: 'Thyroid Panel',
          value: '2.5',
          unit: 'mIU/L',
          reference_range: '0.4 - 4.0',
        });
      const labId = createRes.body.data.labData.id;

      // Delete entire record
      const delRes = await request(app)
        .delete(`/api/lab-data/${labId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(delRes.status).toBe(200);

      // Verify record is gone
      const getRes = await request(app)
        .get(`/api/assessments/${assessmentId}/lab-data`)
        .set('Authorization', `Bearer ${token}`);
      expect(getRes.body.data.labData.some((item) => item.id === labId)).toBe(false);
    });
  });
});
