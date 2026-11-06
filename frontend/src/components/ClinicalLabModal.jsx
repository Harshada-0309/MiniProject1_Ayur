
const COMMON_LAB_PRESETS = [
  { name: 'Fasting Blood Glucose', unit: 'mg/dL', range: '70 - 99' },
  { name: 'Postprandial Blood Glucose', unit: 'mg/dL', range: '70 - 140' },
  { name: 'HbA1c', unit: '%', range: '< 5.7' },
  { name: 'Serum Calcium', unit: 'mg/dL', range: '8.5 - 10.5' },
  { name: 'Serum Potassium', unit: 'mmol/L', range: '3.5 - 5.1' },
  { name: 'Serum Sodium', unit: 'mmol/L', range: '135 - 145' },
  { name: 'Serum Creatinine', unit: 'mg/dL', range: '0.7 - 1.3' },
  { name: 'eGFR', unit: 'mL/min/1.73m2', range: '> 60' },
  { name: 'Blood Urea Nitrogen (BUN)', unit: 'mg/dL', range: '7 - 20' },
  { name: 'Serum Uric Acid', unit: 'mg/dL', range: '3.5 - 7.2' },
  { name: 'ALT (SGPT)', unit: 'U/L', range: '7 - 56' },
  { name: 'AST (SGOT)', unit: 'U/L', range: '10 - 40' },
  { name: 'Serum Bilirubin Total', unit: 'mg/dL', range: '0.2 - 1.2' },
  { name: 'Serum Albumin', unit: 'g/dL', range: '3.5 - 5.0' },
  { name: 'Alkaline Phosphatase (ALP)', unit: 'U/L', range: '44 - 147' },
  { name: 'Hemoglobin', unit: 'g/dL', range: '12.0 - 16.5' },
  { name: 'Serum Ferritin', unit: 'ng/mL', range: '30 - 300' },
  { name: 'Total Cholesterol', unit: 'mg/dL', range: '< 200' },
  { name: 'LDL Cholesterol', unit: 'mg/dL', range: '< 100' },
  { name: 'HDL Cholesterol', unit: 'mg/dL', range: '> 40' },
  { name: 'Serum Triglycerides', unit: 'mg/dL', range: '< 150' },
  { name: 'TSH (Thyroid Stimulating Hormone)', unit: 'uIU/mL', range: '0.4 - 4.5' },
  { name: 'Free T3', unit: 'pg/mL', range: '2.3 - 4.2' },
  { name: 'Free T4', unit: 'ng/dL', range: '0.8 - 1.8' },
  { name: 'Vitamin B12', unit: 'pg/mL', range: '200 - 900' },
  { name: 'Vitamin D (25-OH)', unit: 'ng/mL', range: '30 - 100' },
];

import React, { useState, useEffect } from 'react';
import {
  validateDate,
  isValidLabValue,
  validateReferenceRange,
  determineLabStatus,
} from '../utils/nameValidation';

export default function ClinicalLabModal({ isOpen, onClose, onSave, initialData }) {
  const [formData, setFormData] = useState({
    test_name: '',
    value: '',
    unit: '',
    reference_range: '',
    test_date: new Date().toISOString().split('T')[0],
    source_laboratory: '',
    report_file_metadata: null,
  });
  const [simulatedFile, setSimulatedFile] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    setFieldErrors({});
    setError(null);
    if (initialData) {
      setFormData({
        test_name: initialData.test_name || '',
        value: initialData.value || '',
        unit: initialData.unit || '',
        reference_range: initialData.reference_range || '',
        test_date: initialData.test_date ? initialData.test_date.split('T')[0] : new Date().toISOString().split('T')[0],
        source_laboratory: initialData.source_laboratory || '',
        report_file_metadata: initialData.report_file_metadata || null,
      });
      if (initialData.report_file_metadata) {
        setSimulatedFile(initialData.report_file_metadata.fileName);
      }
    } else {
      setFormData({
        test_name: '',
        value: '',
        unit: '',
        reference_range: '',
        test_date: new Date().toISOString().split('T')[0],
        source_laboratory: '',
        report_file_metadata: null,
      });
      setSimulatedFile(null);
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'test_name') {
      const match = COMMON_LAB_PRESETS.find(
        (p) => p.name.toLowerCase() === value.trim().toLowerCase()
      );
      if (match && !formData.unit && !formData.reference_range) {
        setFormData((prev) => ({
          ...prev,
          test_name: value,
          unit: match.unit,
          reference_range: match.range,
        }));
        return;
      }
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleSimulateFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSimulatedFile(file.name);
      setFormData((prev) => ({
        ...prev,
        report_file_metadata: {
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || 'application/pdf',
          uploadDate: new Date().toISOString(),
        },
      }));
    }
  };

  const computedStatus = determineLabStatus(formData.value, formData.reference_range);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    const newErrors = {};

    // 1. Test Name
    if (!formData.test_name || !formData.test_name.trim()) {
      newErrors.test_name = 'Test name is required.';
    } else if (formData.test_name.trim().length > 150) {
      newErrors.test_name = 'Test name must be under 150 characters.';
    } else if (/^\d+(\.\d+)?$/.test(formData.test_name.trim()) || !/[a-zA-Z]/.test(formData.test_name.trim())) {
      newErrors.test_name = 'Test name must contain meaningful text, not numbers only.';
    }

    // 2. Observed Value
    if (!formData.value || !formData.value.trim()) {
      newErrors.value = 'Observed value is required.';
    } else if (formData.value.trim().length > 80) {
      newErrors.value = 'Observed value must be under 80 characters.';
    } else if (!isValidLabValue(formData.value)) {
      newErrors.value = 'Observed value must be a valid number or recognized qualitative result (e.g. Positive, Negative). Arbitrary text is rejected.';
    }

    // 3. Unit
    if (formData.unit && formData.unit.trim()) {
      const u = formData.unit.trim();
      if (u.length > 50) {
        newErrors.unit = 'Unit must be under 50 characters.';
      } else if (/^\d+(\.\d+)?$/.test(u)) {
        newErrors.unit = 'Unit must be text or symbols (e.g. mg/dL, %), not a number.';
      }
    }

    // 4. Reference Range
    if (formData.reference_range && formData.reference_range.trim()) {
      const rangeCheck = validateReferenceRange(formData.reference_range);
      if (!rangeCheck.valid) {
        newErrors.reference_range = rangeCheck.error || 'Invalid reference range format.';
      }
    }

    // 5. Source Laboratory
    if (formData.source_laboratory && formData.source_laboratory.trim()) {
      const lab = formData.source_laboratory.trim();
      if (lab.length > 150) {
        newErrors.source_laboratory = 'Source laboratory must be under 150 characters.';
      } else if (/^\d+(\.\d+)?$/.test(lab) || !/[a-zA-Z]/.test(lab)) {
        newErrors.source_laboratory = 'Source laboratory must be a valid facility name, not a numeric measurement.';
      }
    }

    // 6. Test Date
    if (formData.test_date) {
      const dateCheck = validateDate(formData.test_date, 'Test date', false);
      if (!dateCheck.isValid) {
        newErrors.test_date = dateCheck.error;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      setError('Please resolve the highlighted field errors.');
      return;
    }

    onSave({
      test_name: formData.test_name.trim(),
      value: formData.value.trim(),
      unit: formData.unit ? formData.unit.trim() : '',
      reference_range: formData.reference_range ? formData.reference_range.trim() : '',
      test_date: formData.test_date ? formData.test_date.trim() : '',
      source_laboratory: formData.source_laboratory ? formData.source_laboratory.trim() : '',
      reported_flag: computedStatus,
      report_file_metadata: formData.report_file_metadata || null,
    });
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h3>{initialData ? 'Edit Clinical / Lab Test' : 'Add Clinical / Lab Test (Optional)'}</h3>
          <button className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="toast-banner toast-error">{error}</div>}

            <div className="form-group">
              <label className="form-label">
                Test Name <span className="required">*</span>
              </label>
              <input
                type="text"
                name="test_name"
                list="common-lab-test-options"
                className={`form-input ${fieldErrors.test_name ? 'input-error' : ''}`}
                placeholder="Type or select test (e.g. HbA1c, Calcium, Potassium, Creatinine, Ferritin)"
                value={formData.test_name}
                onChange={handleChange}
              />
              <datalist id="common-lab-test-options">
                {COMMON_LAB_PRESETS.map((p, idx) => (
                  <option key={idx} value={p.name}>{p.name} ({p.unit})</option>
                ))}
              </datalist>
              {fieldErrors.test_name && (
                <span className="field-error-text" style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                  {fieldErrors.test_name}
                </span>
              )}
            </div>

            <div className="grid-3">
              <div className="form-group">
                <label className="form-label">
                  Observed Value <span className="required">*</span>
                </label>
                <input
                  type="text"
                  name="value"
                  className={`form-input ${fieldErrors.value ? 'input-error' : ''}`}
                  placeholder="e.g. 115"
                  value={formData.value}
                  onChange={handleChange}
                />
                {fieldErrors.value && (
                  <span className="field-error-text" style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                    {fieldErrors.value}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Unit</label>
                <input
                  type="text"
                  name="unit"
                  className={`form-input ${fieldErrors.unit ? 'input-error' : ''}`}
                  placeholder="e.g. mg/dL, %"
                  value={formData.unit}
                  onChange={handleChange}
                />
                {fieldErrors.unit && (
                  <span className="field-error-text" style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                    {fieldErrors.unit}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Reference Range</label>
                <input
                  type="text"
                  name="reference_range"
                  className={`form-input ${fieldErrors.reference_range ? 'input-error' : ''}`}
                  placeholder="e.g. 70 - 99"
                  value={formData.reference_range}
                  onChange={handleChange}
                />
                {fieldErrors.reference_range && (
                  <span className="field-error-text" style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                    {fieldErrors.reference_range}
                  </span>
                )}
              </div>
            </div>

            <div className="grid-3">
              <div className="form-group">
                <label className="form-label">Test Date</label>
                <input
                  type="date"
                  name="test_date"
                  className={`form-input ${fieldErrors.test_date ? 'input-error' : ''}`}
                  value={formData.test_date}
                  onChange={handleChange}
                />
                {fieldErrors.test_date && (
                  <span className="field-error-text" style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                    {fieldErrors.test_date}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Source Laboratory</label>
                <input
                  type="text"
                  name="source_laboratory"
                  className={`form-input ${fieldErrors.source_laboratory ? 'input-error' : ''}`}
                  placeholder="e.g. Metropolis Lab"
                  value={formData.source_laboratory}
                  onChange={handleChange}
                />
                {fieldErrors.source_laboratory && (
                  <span className="field-error-text" style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                    {fieldErrors.source_laboratory}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Reported Status</label>
                <div style={{ paddingTop: '0.4rem' }}>
                  <span className={`badge-flag ${computedStatus ? `badge-${computedStatus}` : 'badge-undetermined'}`}>
                    {computedStatus ? (computedStatus.charAt(0).toUpperCase() + computedStatus.slice(1)) : 'Unable to determine'}
                  </span>
                  <div style={{ fontSize: '0.72rem', color: '#788d84', marginTop: '0.35rem' }}>
                    Automatic (from value &amp; range)
                  </div>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                Upload Report File Metadata (PDF / JPG / PNG)
              </label>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                className="form-input"
                onChange={handleSimulateFileUpload}
                style={{ padding: '0.45rem' }}
              />
              {simulatedFile && (
                <div style={{ fontSize: '0.78rem', color: '#15803d', marginTop: '0.35rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>✓ Attached file: <strong>{simulatedFile}</strong></span>
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.75rem', textDecoration: 'underline' }}
                    onClick={() => {
                      setSimulatedFile(null);
                      setFormData((prev) => ({ ...prev, report_file_metadata: null }));
                    }}
                  >
                    Remove attachment
                  </button>
                </div>
              )}
              <div style={{ fontSize: '0.75rem', color: '#788d84', marginTop: '0.25rem' }}>
                Note: In Phase 2, this securely stores structured report metadata. OCR &amp; automated interpretation will be added in future phases.
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              {initialData ? 'Update Test' : 'Add Test Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
