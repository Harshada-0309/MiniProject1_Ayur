import React, { useState, useEffect } from 'react';
import DashboardIcon from '../ui/DashboardIcons';
import Badge from '../ui/Badge';
import { api } from '../../services/api';
import {
  validateHumanName,
  preventNumberInput,
  validateOccupation,
  validateAge,
  validatePhone,
  validateEmail,
} from '../../utils/nameValidation';

export default function PatientProfileModal({
  isOpen,
  patient,
  onClose,
  onPatientUpdated,
  onStartAssessment,
  onRequestDelete,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    sex: 'male',
    occupation: '',
    phone: '',
    email: '',
    photo_url: '',
  });

  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [photoError, setPhotoError] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (patient) {
      setFormData({
        name: patient.name || '',
        age: patient.age !== undefined && patient.age !== null ? String(patient.age) : '',
        sex: patient.sex || 'male',
        occupation: patient.occupation || '',
        phone: patient.phone || '',
        email: patient.email || '',
        photo_url: patient.photo_url || '',
      });
      setPreviewPhoto(patient.photo_url || null);
      setPhotoError(false);
      setFieldErrors({});
      setError(null);
      setSuccess(null);
      setIsEditing(false);
    }
  }, [patient, isOpen]);

  // Handle ESC key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !saving && !uploadingPhoto) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, saving, uploadingPhoto, onClose]);

  if (!isOpen || !patient) return null;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
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

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setError(null);
    setSuccess(null);

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setError('Please select a valid image file (JPEG, PNG, or WebP).');
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxSize) {
      setError('Patient photograph file size must be less than 5 MB.');
      return;
    }

    try {
      setUploadingPhoto(true);
      const res = await api.uploadPatientPhoto(patient.id, file);
      const newPhotoUrl = res.data?.photo_url;
      const updatedPatient = res.data?.patient;

      if (newPhotoUrl) {
        setPhotoError(false);
        setPreviewPhoto(newPhotoUrl);
        setFormData((prev) => ({ ...prev, photo_url: newPhotoUrl }));
      }
      if (updatedPatient && onPatientUpdated) {
        onPatientUpdated(updatedPatient);
      }
      setSuccess('Patient photograph uploaded and saved to clinical record successfully.');
    } catch (err) {
      console.error('Failed to upload patient photo:', err);
      setError(err.message || 'Failed to upload photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const handleRemovePhoto = async () => {
    setError(null);
    setSuccess(null);

    try {
      setUploadingPhoto(true);
      const res = await api.deletePatientPhoto(patient.id);
      const updatedPatient = res.data?.patient;

      setPreviewPhoto(null);
      setFormData((prev) => ({ ...prev, photo_url: '' }));

      if (updatedPatient && onPatientUpdated) {
        onPatientUpdated(updatedPatient);
      }
      setSuccess('Patient profile photograph removed. Default avatar restored.');
    } catch (err) {
      console.error('Failed to remove patient photo:', err);
      setError(err.message || 'Failed to remove patient photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setError(null);
    setSuccess(null);
    setFieldErrors({});
    if (patient) {
      setFormData({
        name: patient.name || '',
        age: patient.age !== undefined && patient.age !== null ? String(patient.age) : '',
        sex: patient.sex || 'male',
        occupation: patient.occupation || '',
        phone: patient.phone || '',
        email: patient.email || '',
        photo_url: patient.photo_url || '',
      });
      setPreviewPhoto(patient.photo_url || null);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
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
      setError('Please resolve the highlighted field errors before saving.');
      return;
    }

    try {
      setSaving(true);
      const res = await api.updatePatient(patient.id, {
        name: formData.name.trim(),
        age: ageCheck.value,
        sex: formData.sex,
        occupation: formData.occupation ? formData.occupation.trim() : '',
        phone: formData.phone ? formData.phone.trim() : '',
        email: formData.email ? formData.email.trim() : '',
        photo_url: formData.photo_url || null,
      });

      const updated = res.data?.patient;
      if (updated && onPatientUpdated) {
        onPatientUpdated(updated);
      }
      setSuccess('Patient clinical record updated and persisted successfully.');
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to update patient record:', err);
      setError(err.message || 'Could not update patient profile.');
    } finally {
      setSaving(false);
    }
  };

  const prakriti = patient.latest_assessment?.prakriti;
  const dietGoal = patient.latest_assessment?.diet_goal;
  const patientInitials = (formData.name || patient.name || 'P')
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="patient-profile-modal-title"
    >
      <div
        className="modal-content ayur-patient-profile-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '640px', padding: 0 }}
      >
        {/* Modal Header */}
        <div className="modal-header" style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div className="profile-icon-badge" style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'var(--color-soft-aqua-light)',
              color: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <DashboardIcon name="user-round" size={18} />
            </div>
            <div>
              <h3 id="patient-profile-modal-title" style={{ margin: 0, fontSize: '1.18rem', color: 'var(--color-deep-slate)' }}>
                {isEditing ? 'Edit Patient Profile' : 'Patient Clinical Profile'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-slate-muted)' }}>
                {patient.patient_code} • AyurDiet Clinical Records
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
            disabled={saving || uploadingPhoto}
          >
            <DashboardIcon name="x" size={18} />
          </button>
        </div>

        {/* Notifications */}
        {error && (
          <div className="toast-banner toast-error" style={{ margin: '1rem 1.5rem 0' }}>
            <DashboardIcon name="shield-alert" size={16} />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div
            className="toast-banner toast-success"
            style={{
              margin: '1rem 1.5rem 0',
              background: 'var(--color-success-bg)',
              color: 'var(--color-success)',
              border: '1px solid var(--color-success-border)',
            }}
          >
            <DashboardIcon name="check" size={16} />
            <span>{success}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="modal-body" style={{ padding: '1.5rem' }}>
          {!isEditing ? (
            /* ================= VIEW MODE ================= */
            <div className="patient-profile-view-wrap">
              {/* Profile Banner */}
              <div
                style={{
                  display: 'flex',
                  gap: '1.25rem',
                  alignItems: 'center',
                  padding: '1.25rem',
                  background: 'linear-gradient(135deg, #F8FCFB 0%, #EBF7F6 100%)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  marginBottom: '1.25rem',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  {previewPhoto && !photoError ? (
                    <img
                      src={previewPhoto}
                      alt={patient.name}
                      style={{
                        width: '76px',
                        height: '76px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '3px solid #FFFFFF',
                        boxShadow: '0 4px 12px rgba(22, 125, 131, 0.2)',
                        display: 'block',
                      }}
                      onError={() => setPhotoError(true)}
                    />
                  ) : (
                    <div
                      style={{
                        width: '76px',
                        height: '76px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #0d9488, #167D83)',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.6rem',
                        fontWeight: 700,
                        border: '3px solid #FFFFFF',
                        boxShadow: '0 4px 12px rgba(13, 148, 136, 0.2)',
                      }}
                    >
                      {patientInitials}
                    </div>
                  )}

                  {/* Camera icon trigger */}
                  <label
                    htmlFor="patient-profile-photo-quick-input"
                    title="Upload or change patient photo"
                    style={{
                      position: 'absolute',
                      bottom: '0',
                      right: '0',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: 'var(--color-primary)',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: uploadingPhoto ? 'not-allowed' : 'pointer',
                      border: '2px solid #FFFFFF',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    }}
                  >
                    {uploadingPhoto ? (
                      <DashboardIcon name="refresh-cw" size={12} className="ayur-spin" />
                    ) : (
                      <DashboardIcon name="camera" size={12} />
                    )}
                  </label>
                  <input
                    id="patient-profile-photo-quick-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handlePhotoUpload}
                    disabled={uploadingPhoto}
                    style={{ display: 'none' }}
                  />
                </div>

                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                    <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: 'var(--color-deep-slate)' }}>
                      {patient.name}
                    </h2>
                    {prakriti ? (
                      <Badge variant={prakriti.includes('Vata') ? 'vata' : prakriti.includes('Pitta') ? 'pitta' : 'kapha'}>
                        {prakriti}
                      </Badge>
                    ) : (
                      <span style={{ fontSize: '0.74rem', color: 'var(--color-slate-muted)', background: 'var(--color-pearl-white)', padding: '0.2rem 0.55rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                        Assessment Pending
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-primary)' }}>
                      {patient.patient_code}
                    </span>
                    <span style={{ color: 'var(--color-slate-light)' }}>•</span>
                    <span style={{ fontSize: '0.82rem', color: 'var(--color-slate-muted)' }}>
                      {patient.age} yrs • <span style={{ textTransform: 'capitalize' }}>{patient.sex}</span>
                    </span>
                  </div>

                  {dietGoal && (
                    <div style={{ marginTop: '0.45rem', fontSize: '0.8rem', color: 'var(--color-slate-muted)' }}>
                      Dietary Goal:{' '}
                      <strong style={{ color: 'var(--color-primary)' }}>
                        {dietGoal.replace(/_/g, ' ')}
                      </strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Patient Details Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '0.85rem',
                  marginBottom: '1.5rem',
                }}
              >
                <div style={{ padding: '0.75rem 1rem', background: 'var(--color-pearl-white)', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                  <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-slate-muted)', fontWeight: 600 }}>
                    Phone Number
                  </span>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-deep-slate)', marginTop: '0.2rem' }}>
                    {patient.phone || 'Not recorded'}
                  </div>
                </div>

                <div style={{ padding: '0.75rem 1rem', background: 'var(--color-pearl-white)', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                  <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-slate-muted)', fontWeight: 600 }}>
                    Email Address
                  </span>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-deep-slate)', marginTop: '0.2rem', wordBreak: 'break-all' }}>
                    {patient.email || 'Not recorded'}
                  </div>
                </div>

                <div style={{ padding: '0.75rem 1rem', background: 'var(--color-pearl-white)', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                  <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-slate-muted)', fontWeight: 600 }}>
                    Occupation
                  </span>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-deep-slate)', marginTop: '0.2rem' }}>
                    {patient.occupation || 'Not specified'}
                  </div>
                </div>

                <div style={{ padding: '0.75rem 1rem', background: 'var(--color-pearl-white)', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                  <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-slate-muted)', fontWeight: 600 }}>
                    Clinical Assessments
                  </span>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-deep-slate)', marginTop: '0.2rem' }}>
                    {patient.assessment_count || 0} recorded
                  </div>
                </div>
              </div>

              {/* View Mode Actions */}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
                {onRequestDelete && (
                  <button
                    type="button"
                    className="btn-ayur-outline"
                    onClick={() => {
                      onClose();
                      onRequestDelete(patient);
                    }}
                    style={{ color: '#b91c1c', borderColor: '#fecaca', display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
                  >
                    <DashboardIcon name="trash" size={15} />
                    <span>Delete Record</span>
                  </button>
                )}

                <div style={{ display: 'flex', gap: '0.75rem', marginLeft: 'auto', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn-ayur-outline"
                    onClick={() => setIsEditing(true)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
                  >
                    <DashboardIcon name="edit" size={15} />
                    <span>Edit Profile</span>
                  </button>

                  {onStartAssessment && (
                    <button
                      type="button"
                      className="btn-ayur-primary"
                      onClick={() => {
                        onClose();
                        onStartAssessment(patient);
                      }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
                    >
                      <DashboardIcon name="arrow-right" size={15} />
                      <span>Conduct Assessment</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* ================= EDIT MODE ================= */
            <form onSubmit={handleSaveProfile} className="patient-edit-form">
              {/* Photo Upload Row */}
              <div
                style={{
                  display: 'flex',
                  gap: '1.25rem',
                  alignItems: 'center',
                  padding: '1.25rem',
                  background: 'var(--color-pearl-white)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px dashed var(--color-border-hover)',
                  marginBottom: '1.25rem',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  {previewPhoto && !photoError ? (
                    <img
                      src={previewPhoto}
                      alt="Preview"
                      style={{
                        width: '74px',
                        height: '74px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '2px solid var(--color-primary)',
                        display: 'block',
                      }}
                      onError={() => setPhotoError(true)}
                    />
                  ) : (
                    <div
                      style={{
                        width: '74px',
                        height: '74px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #0d9488, #167D83)',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.6rem',
                        fontWeight: 700,
                      }}
                    >
                      {patientInitials}
                    </div>
                  )}

                  <label
                    htmlFor="patient-edit-photo-input"
                    title="Change patient photo"
                    style={{
                      position: 'absolute',
                      bottom: '-2px',
                      right: '-2px',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: 'var(--color-primary)',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: uploadingPhoto ? 'not-allowed' : 'pointer',
                      border: '2px solid #FFFFFF',
                    }}
                  >
                    {uploadingPhoto ? (
                      <DashboardIcon name="refresh-cw" size={12} className="ayur-spin" />
                    ) : (
                      <DashboardIcon name="camera" size={12} />
                    )}
                  </label>
                  <input
                    id="patient-edit-photo-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handlePhotoUpload}
                    disabled={uploadingPhoto}
                    style={{ display: 'none' }}
                  />
                </div>

                <div style={{ flex: 1, minWidth: '200px' }}>
                  <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.95rem', color: 'var(--color-deep-slate)' }}>
                    Patient Clinical Photograph
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-slate-muted)', lineHeight: 1.4 }}>
                    Upload JPEG, PNG, or WebP photo up to 5 MB. Photo is saved directly to persistent clinical storage.
                  </p>
                  <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <label
                      htmlFor="patient-edit-photo-input"
                      className="btn-ayur-outline"
                      style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', cursor: uploadingPhoto ? 'not-allowed' : 'pointer' }}
                    >
                      <DashboardIcon name="upload" size={13} /> {previewPhoto ? 'Change Photo' : 'Select Photo'}
                    </label>
                    {previewPhoto && (
                      <button
                        type="button"
                        className="btn-ayur-outline"
                        style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', color: '#b91c1c', borderColor: '#fecaca' }}
                        onClick={handleRemovePhoto}
                        disabled={uploadingPhoto}
                      >
                        <DashboardIcon name="trash" size={13} /> Remove Photo
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Form Input Fields */}
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">
                  Full Name <span className="required">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  className="form-input"
                  placeholder="e.g. Priya Sharma"
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

              <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
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
                    placeholder="e.g. 32"
                    value={formData.age}
                    onChange={handleInputChange}
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
                    onChange={handleInputChange}
                    required
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Occupation</label>
                <input
                  type="text"
                  name="occupation"
                  className="form-input"
                  placeholder="e.g. Software Engineer / Teacher"
                  value={formData.occupation}
                  onChange={handleInputChange}
                  style={fieldErrors.occupation ? { borderColor: '#dc2626' } : {}}
                />
                {fieldErrors.occupation && (
                  <span className="field-error-text" style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.3rem', display: 'block' }}>
                    {fieldErrors.occupation}
                  </span>
                )}
              </div>

              <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    type="tel"
                    name="phone"
                    className="form-input"
                    placeholder="+91 98765 43210"
                    value={formData.phone}
                    onChange={handleInputChange}
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
                    onChange={handleInputChange}
                    style={fieldErrors.email ? { borderColor: '#dc2626' } : {}}
                  />
                  {fieldErrors.email && (
                    <span className="field-error-text" style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.3rem', display: 'block' }}>
                      {fieldErrors.email}
                    </span>
                  )}
                </div>
              </div>

              {/* Edit Mode Footer */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.75rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid var(--color-border)',
                }}
              >
                <button
                  type="button"
                  className="btn-ayur-outline"
                  onClick={handleCancelEdit}
                  disabled={saving || uploadingPhoto}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-ayur-primary"
                  disabled={saving || uploadingPhoto}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
                >
                  {saving ? (
                    <>
                      <DashboardIcon name="refresh-cw" size={15} className="ayur-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <DashboardIcon name="check" size={15} />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
