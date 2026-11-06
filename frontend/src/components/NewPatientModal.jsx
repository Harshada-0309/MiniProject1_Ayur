import React, { useState, useEffect } from 'react';
import {
  validateHumanName,
  preventNumberInput,
  validateOccupation,
  validateAge,
  validatePhone,
  validateEmail,
} from '../utils/nameValidation';

export default function NewPatientModal({ isOpen, onClose, onPatientCreated }) {
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    sex: 'male',
    occupation: '',
    phone: '',
    email: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setFieldErrors({});
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear field-specific error as user edits
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleNameKeyDown = (e) => {
    if (preventNumberInput(e)) {
      setFieldErrors((prev) => ({ ...prev, name: 'Name cannot contain numerical digits.' }));
    }
  };

  const handleNameChange = (e) => {
    const val = e.target.value;
    setFormData((prev) => ({ ...prev, name: val }));
    const check = validateHumanName(val, false);
    if (!check.isValid) {
      setFieldErrors((prev) => ({ ...prev, name: check.error }));
    } else {
      setFieldErrors((prev) => ({ ...prev, name: null }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const newErrors = {};

    const nameCheck = validateHumanName(formData.name, true);
    if (!nameCheck.isValid) {
      newErrors.name = nameCheck.error;
    }

    const ageCheck = validateAge(formData.age, true);
    if (!ageCheck.isValid) {
      newErrors.age = ageCheck.error;
    }

    const occCheck = validateOccupation(formData.occupation);
    if (!occCheck.isValid) {
      newErrors.occupation = occCheck.error;
    }

    const phoneCheck = validatePhone(formData.phone);
    if (!phoneCheck.isValid) {
      newErrors.phone = phoneCheck.error;
    }

    const emailCheck = validateEmail(formData.email, false);
    if (!emailCheck.isValid) {
      newErrors.email = emailCheck.error;
    }

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      setError('Please resolve the highlighted field errors before submitting.');
      return;
    }

    try {
      setSubmitting(true);
      await onPatientCreated({
        name: formData.name.trim(),
        age: ageCheck.value,
        sex: formData.sex,
        occupation: formData.occupation ? formData.occupation.trim() : '',
        phone: formData.phone ? formData.phone.trim() : '',
        email: formData.email ? formData.email.trim() : '',
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create patient record');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Register New Patient</h3>
          <button className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div className="toast-banner toast-error">
                {error}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">
                Full Name <span className="required">*</span>
              </label>
              <input
                type="text"
                name="name"
                className="form-input"
                placeholder="e.g. Aarav Sharma"
                value={formData.name}
                onChange={handleNameChange}
                onKeyDown={handleNameKeyDown}
                style={fieldErrors.name ? { borderColor: '#dc2626' } : {}}
                required
              />
              {fieldErrors.name && (
                <span className="field-error-text" style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.3rem', display: 'block' }}>
                  {fieldErrors.name}
                </span>
              )}
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">
                  Age <span className="required">*</span>
                </label>
                <input
                  type="number"
                  name="age"
                  min="0"
                  max="105"
                  className="form-input"
                  placeholder="e.g. 34"
                  value={formData.age}
                  onChange={handleChange}
                  style={fieldErrors.age ? { borderColor: '#dc2626' } : {}}
                  required
                />
                {fieldErrors.age && (
                  <span className="field-error-text" style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.3rem', display: 'block' }}>
                    {fieldErrors.age}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">
                  Sex <span className="required">*</span>
                </label>
                <select
                  name="sex"
                  className="form-select"
                  value={formData.sex}
                  onChange={handleChange}
                  required
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Occupation</label>
              <input
                type="text"
                name="occupation"
                className="form-input"
                placeholder="e.g. Software Engineer / Teacher"
                value={formData.occupation}
                onChange={handleChange}
                style={fieldErrors.occupation ? { borderColor: '#dc2626' } : {}}
              />
              {fieldErrors.occupation && (
                <span className="field-error-text" style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.3rem', display: 'block' }}>
                  {fieldErrors.occupation}
                </span>
              )}
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input
                  type="tel"
                  name="phone"
                  className="form-input"
                  placeholder="+91 98765 43210"
                  value={formData.phone}
                  onChange={handleChange}
                  style={fieldErrors.phone ? { borderColor: '#dc2626' } : {}}
                />
                {fieldErrors.phone && (
                  <span className="field-error-text" style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.3rem', display: 'block' }}>
                    {fieldErrors.phone}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  name="email"
                  className="form-input"
                  placeholder="patient@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  style={fieldErrors.email ? { borderColor: '#dc2626' } : {}}
                />
                {fieldErrors.email && (
                  <span className="field-error-text" style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.3rem', display: 'block' }}>
                    {fieldErrors.email}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Registering Patient...' : 'Register Patient'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
