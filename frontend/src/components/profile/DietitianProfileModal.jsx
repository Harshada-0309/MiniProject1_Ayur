import React, { useState, useEffect, useCallback, useRef } from 'react';
import DashboardIcon from '../ui/DashboardIcons';
import { api } from '../../services/api';
import {
  validateHumanName,
  preventNumberInput,
  validatePhone,
} from '../../utils/nameValidation';

export default function DietitianProfileModal({
  isOpen,
  onClose,
  dietitian,
  onProfileUpdated,
}) {
  // State hooks - all declared unconditionally at top level
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    email: '',
    phone: '',
    qualifications: '',
    clinic_name: '',
    photo_url: '',
  });

  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [photoError, setPhotoError] = useState(false);
  const [selectedPhotoFile, setSelectedPhotoFile] = useState(null);
  const [removePhotoFlag, setRemovePhotoFlag] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const wasOpenRef = useRef(false);
  const previewBlobUrlRef = useRef(null);

  // Clean up object URLs on unmount or when preview changes
  useEffect(() => {
    return () => {
      if (previewBlobUrlRef.current) {
        URL.revokeObjectURL(previewBlobUrlRef.current);
      }
    };
  }, []);

  // Helper to populate form fields from a dietitian data object
  const syncDietitianData = useCallback((d) => {
    if (!d) return;
    setFormData({
      name: d.name || '',
      role: d.role || 'Chief Clinical Dietitian',
      email: d.email || '',
      phone: d.phone || '+91 98765 43210',
      qualifications: d.qualifications || 'BAMS, MD (Ayurveda), PGD Clinical Nutrition',
      clinic_name: d.clinic_name || 'AyurDiet Integrative Health Clinic',
      photo_url: d.photo_url || '',
    });
    setPreviewPhoto(d.photo_url || null);
    setPhotoError(false);
    setSelectedPhotoFile(null);
    setRemovePhotoFlag(false);
  }, []);

  // Passive synchronization when modal transitions from closed to open
  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }

    if (!wasOpenRef.current) {
      wasOpenRef.current = true;
      setError(null);
      setSuccess(null);
      setFieldErrors({});
      setIsEditing(false);

      if (dietitian) {
        syncDietitianData(dietitian);
      }

      let isMounted = true;
      const fetchLatest = async () => {
        try {
          setLoadingData(true);
          const res = await api.getCurrentUser();
          const latest = res?.data?.dietitian;
          if (isMounted && latest) {
            syncDietitianData(latest);
          }
        } catch (err) {
          console.warn('[DietitianProfileModal] Could not fetch latest profile on open:', err.message);
        } finally {
          if (isMounted) setLoadingData(false);
        }
      };

      fetchLatest();

      return () => {
        isMounted = false;
      };
    }
  }, [isOpen, dietitian, syncDietitianData]);

  // Handle ESC key press to close modal
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

  // Early return must ONLY occur AFTER all hooks have been declared
  if (!isOpen) {
    return null;
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleNameKeyDown = (e) => {
    if (preventNumberInput(e)) {
      setFieldErrors((prev) => ({ ...prev, name: 'Doctor name cannot contain numerical digits.' }));
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

  const handlePhoneChange = (e) => {
    const val = e.target.value;
    setFormData((prev) => ({ ...prev, phone: val }));
    const check = validatePhone(val, false);
    if (!check.isValid) {
      setFieldErrors((prev) => ({ ...prev, phone: check.error }));
    } else {
      setFieldErrors((prev) => ({ ...prev, phone: null }));
    }
  };

  /**
   * Selection handler in Edit Mode:
   * Validates file and creates an instant local preview BEFORE saving.
   */
  const handlePhotoSelectInEditMode = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setSuccess(null);

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setError('Please select a valid image file (JPEG, PNG, or WebP).');
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('Image file size must be less than 5 MB.');
      return;
    }

    if (previewBlobUrlRef.current) {
      URL.revokeObjectURL(previewBlobUrlRef.current);
    }
    const blobUrl = URL.createObjectURL(file);
    previewBlobUrlRef.current = blobUrl;

    setSelectedPhotoFile(file);
    setRemovePhotoFlag(false);
    setPreviewPhoto(blobUrl);
    setPhotoError(false);
    e.target.value = '';
  };

  /**
   * Direct upload handler in View Mode:
   * Immediately uploads and persists photo to database.
   */
  const handleDirectPhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setSuccess(null);

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload a valid image file (JPEG, PNG, or WebP).');
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('Image file size must be less than 5 MB.');
      return;
    }

    try {
      setUploadingPhoto(true);
      const res = await api.uploadDietitianPhoto(file);
      const newPhotoUrl = res.data?.photo_url;
      const updatedDietitian = res.data?.dietitian;

      if (newPhotoUrl) {
        setPhotoError(false);
        setPreviewPhoto(newPhotoUrl);
        setFormData((prev) => ({ ...prev, photo_url: newPhotoUrl }));
      }
      if (updatedDietitian && onProfileUpdated) {
        onProfileUpdated(updatedDietitian);
      }
      setSuccess('Photograph uploaded and saved to practitioner profile successfully.');
    } catch (err) {
      console.error('Failed to upload photo:', err);
      setError(err.message || 'Failed to upload photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  /**
   * Photo removal handler in Edit Mode:
   * Sets photo to removed state, will be finalized on save or immediately if in view mode.
   */
  const handleRemovePhoto = async () => {
    setError(null);
    setSuccess(null);

    if (isEditing) {
      if (previewBlobUrlRef.current) {
        URL.revokeObjectURL(previewBlobUrlRef.current);
        previewBlobUrlRef.current = null;
      }
      setSelectedPhotoFile(null);
      setRemovePhotoFlag(true);
      setPreviewPhoto(null);
      setFormData((prev) => ({ ...prev, photo_url: '' }));
      return;
    }

    // Direct removal in view mode
    try {
      setUploadingPhoto(true);
      const res = await api.deleteDietitianPhoto();
      const updatedDietitian = res.data?.dietitian;
      setPreviewPhoto(null);
      setPhotoError(false);
      setFormData((prev) => ({ ...prev, photo_url: '' }));
      if (updatedDietitian && onProfileUpdated) {
        onProfileUpdated(updatedDietitian);
      }
      setSuccess('Profile photo removed. Default practitioner avatar restored.');
    } catch (err) {
      console.error('Failed to remove photo:', err);
      setError(err.message || 'Failed to remove photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleCancelEdit = () => {
    if (previewBlobUrlRef.current) {
      URL.revokeObjectURL(previewBlobUrlRef.current);
      previewBlobUrlRef.current = null;
    }
    setIsEditing(false);
    setError(null);
    setSuccess(null);
    setFieldErrors({});
    setSelectedPhotoFile(null);
    setRemovePhotoFlag(false);
    if (dietitian) {
      syncDietitianData(dietitian);
    }
  };

  /**
   * Save Profile handler:
   * Submits all edited fields, uploading selected photo via multipart FormData if provided.
   */
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const nameCheck = validateHumanName(formData.name, true);
    if (!nameCheck.isValid) {
      setFieldErrors((prev) => ({ ...prev, name: nameCheck.error }));
      setError(nameCheck.error);
      return;
    }

    const phoneCheck = validatePhone(formData.phone, false);
    if (!phoneCheck.isValid) {
      setFieldErrors((prev) => ({ ...prev, phone: phoneCheck.error }));
      setError(phoneCheck.error);
      return;
    }

    try {
      setSaving(true);

      let payload;
      if (selectedPhotoFile) {
        // Multipart FormData for unified photo + details update
        payload = new FormData();
        payload.append('photo', selectedPhotoFile);
        payload.append('name', formData.name.trim());
        payload.append('role', formData.role.trim());
        payload.append('phone', formData.phone.trim());
        payload.append('qualifications', formData.qualifications.trim());
        payload.append('clinic_name', formData.clinic_name.trim());
      } else {
        // Standard JSON payload
        payload = {
          name: formData.name.trim(),
          role: formData.role.trim(),
          phone: formData.phone.trim(),
          qualifications: formData.qualifications.trim(),
          clinic_name: formData.clinic_name.trim(),
          photo_url: removePhotoFlag ? null : (formData.photo_url || null),
        };
      }

      const res = await api.updateDietitianProfile(payload);
      const updated = res.data?.dietitian;

      if (updated) {
        if (previewBlobUrlRef.current) {
          URL.revokeObjectURL(previewBlobUrlRef.current);
          previewBlobUrlRef.current = null;
        }
        syncDietitianData(updated);
        if (onProfileUpdated) {
          onProfileUpdated(updated);
        }
      }
      setSuccess('Dietitian profile and credentials saved to database successfully.');
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to update profile:', err);
      setError(err.message || 'Could not update dietitian profile.');
    } finally {
      setSaving(false);
    }
  };

  const initials = formData.name
    ? formData.name.replace(/^(Dr\.?\s*)/i, '').slice(0, 2).toUpperCase()
    : 'DR';

  return (
    <div
      className="modal-overlay"
      onClick={() => {
        if (!saving && !uploadingPhoto) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dietitian-profile-title"
    >
      <div
        className="modal-content ayur-dietitian-profile-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '640px',
          width: '94%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 20px 50px rgba(22, 125, 131, 0.2), 0 10px 20px rgba(0,0,0,0.08)',
          background: 'var(--color-pure-white)',
          border: '1px solid var(--color-border)',
        }}
      >
        {/* Header */}
        <div
          className="modal-header"
          style={{
            padding: '1.15rem 1.5rem',
            borderBottom: '1px solid var(--color-border)',
            background: 'var(--color-pearl-white)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              className="profile-icon-badge"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'var(--color-soft-aqua)',
                color: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <DashboardIcon name="user-round" size={18} />
            </div>
            <div>
              <h3
                id="dietitian-profile-title"
                style={{
                  margin: 0,
                  fontSize: '1.18rem',
                  fontWeight: 700,
                  color: 'var(--color-deep-slate)',
                }}
              >
                {isEditing ? 'Edit Dietitian Profile' : 'Dietitian Clinical Profile'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-slate-muted)' }}>
                AyurDiet Integrative Health Clinic Credentials
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
            disabled={saving || uploadingPhoto}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-slate-muted)',
              cursor: 'pointer',
              padding: '0.4rem',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <DashboardIcon name="x" size={18} />
          </button>
        </div>

        {/* Notifications */}
        {error && (
          <div
            className="toast-banner toast-error"
            style={{
              margin: '0.85rem 1.5rem 0',
              padding: '0.65rem 0.9rem',
              borderRadius: 'var(--radius-sm)',
              background: '#fef2f2',
              color: '#991b1b',
              border: '1px solid #fecaca',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.84rem',
            }}
          >
            <DashboardIcon name="shield-alert" size={16} />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div
            className="toast-banner toast-success"
            style={{
              margin: '0.85rem 1.5rem 0',
              padding: '0.65rem 0.9rem',
              borderRadius: 'var(--radius-sm)',
              background: '#ecfdf5',
              color: '#065f46',
              border: '1px solid #a7f3d0',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.84rem',
            }}
          >
            <DashboardIcon name="check" size={16} />
            <span>{success}</span>
          </div>
        )}

        {/* Modal Body with internal scrolling */}
        <div
          className="modal-body"
          style={{
            padding: '1.5rem',
            overflowY: 'auto',
            maxHeight: 'calc(90vh - 130px)',
            flex: 1,
          }}
        >
          {loadingData && !formData.name ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-slate-muted)' }}>
              <DashboardIcon name="refresh-cw" size={28} className="ayur-spin" style={{ color: 'var(--color-primary)', marginBottom: '0.75rem' }} />
              <p style={{ margin: 0, fontSize: '0.9rem' }}>Loading practitioner clinical credentials from database...</p>
            </div>
          ) : !isEditing ? (
            /* ================= VIEW MODE ================= */
            <div className="dietitian-profile-card-view">
              {/* Profile Card Banner */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #0d9488, #167D83)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.5rem',
                  color: '#FFFFFF',
                  marginBottom: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.25rem',
                  position: 'relative',
                  boxShadow: '0 4px 14px rgba(22, 125, 131, 0.2)',
                }}
              >
                {/* Large Avatar with Quick-Upload Camera Button */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  {previewPhoto && !photoError ? (
                    <img
                      src={previewPhoto}
                      alt={formData.name || 'Dietitian'}
                      onError={() => setPhotoError(true)}
                      style={{
                        width: '84px',
                        height: '84px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '3px solid #FFFFFF',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
                        display: 'block',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '84px',
                        height: '84px',
                        borderRadius: '50%',
                        background: '#FFFFFF',
                        color: 'var(--color-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.6rem',
                        fontWeight: 700,
                        border: '3px solid #FFFFFF',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
                      }}
                    >
                      {initials}
                    </div>
                  )}

                  {/* Camera icon button for direct photo update */}
                  <label
                    htmlFor="dietitian-view-mode-photo-input"
                    title="Upload or update profile photo"
                    style={{
                      position: 'absolute',
                      bottom: '-2px',
                      right: '-2px',
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      background: 'var(--color-primary)',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: uploadingPhoto ? 'wait' : 'pointer',
                      border: '2px solid #FFFFFF',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
                    }}
                  >
                    {uploadingPhoto ? (
                      <DashboardIcon name="refresh-cw" size={13} className="ayur-spin" />
                    ) : (
                      <DashboardIcon name="camera" size={13} />
                    )}
                  </label>
                  <input
                    id="dietitian-view-mode-photo-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleDirectPhotoUpload}
                    disabled={uploadingPhoto || saving}
                    style={{ display: 'none' }}
                  />
                </div>

                {/* Banner Metadata */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <h2
                      style={{
                        margin: 0,
                        fontSize: '1.35rem',
                        fontWeight: 700,
                        color: '#FFFFFF',
                      }}
                    >
                      {formData.name || 'Dr. Vaidya'}
                    </h2>
                    <span
                      title="Clinically Verified Dietitian"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        background: '#10B981',
                        color: '#FFFFFF',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        padding: '0.15rem 0.5rem',
                        borderRadius: '12px',
                      }}
                    >
                      <DashboardIcon name="shield-check" size={12} />
                      <span>Verified</span>
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'inline-block',
                      background: 'rgba(255, 255, 255, 0.2)',
                      padding: '0.2rem 0.65rem',
                      borderRadius: '20px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      marginTop: '0.35rem',
                      marginBottom: '0.35rem',
                    }}
                  >
                    {formData.role || 'Chief Clinical Dietitian'}
                  </div>
                  <div
                    style={{
                      fontSize: '0.82rem',
                      opacity: 0.92,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                    }}
                  >
                    <DashboardIcon name="book-open" size={14} />
                    <span>{formData.qualifications}</span>
                  </div>
                </div>
              </div>

              {/* Details Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '1rem',
                  marginBottom: '1.5rem',
                }}
              >
                <div
                  style={{
                    background: 'var(--color-pearl-white)',
                    padding: '0.85rem 1rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border-subtle)',
                  }}
                >
                  <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-slate-muted)', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                    Clinic Center
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-deep-slate)', fontWeight: 600, fontSize: '0.9rem' }}>
                    <DashboardIcon name="sprout" size={15} style={{ color: 'var(--color-primary)' }} />
                    <span>{formData.clinic_name}</span>
                  </div>
                </div>

                <div
                  style={{
                    background: 'var(--color-pearl-white)',
                    padding: '0.85rem 1rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border-subtle)',
                  }}
                >
                  <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-slate-muted)', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                    Practitioner ID
                  </span>
                  <div style={{ color: 'var(--color-primary)', fontWeight: 700, fontSize: '0.9rem' }}>
                    {dietitian?.dietitian_code || 'DIET-2026-001'}
                  </div>
                </div>

                <div
                  style={{
                    background: 'var(--color-pearl-white)',
                    padding: '0.85rem 1rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border-subtle)',
                  }}
                >
                  <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-slate-muted)', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                    Official Email
                  </span>
                  <div style={{ color: 'var(--color-deep-slate)', fontWeight: 500, fontSize: '0.88rem' }}>
                    {formData.email}
                  </div>
                </div>

                <div
                  style={{
                    background: 'var(--color-pearl-white)',
                    padding: '0.85rem 1rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border-subtle)',
                  }}
                >
                  <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-slate-muted)', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                    Direct Contact
                  </span>
                  <div style={{ color: 'var(--color-deep-slate)', fontWeight: 500, fontSize: '0.88rem' }}>
                    {formData.phone}
                  </div>
                </div>
              </div>

              {/* View Mode Actions */}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', borderTop: '1px solid var(--color-border-subtle)', paddingTop: '1rem' }}>
                <button
                  type="button"
                  className="btn-ayur-outline"
                  onClick={onClose}
                  style={{ padding: '0.55rem 1.1rem' }}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="btn-ayur-primary"
                  onClick={() => setIsEditing(true)}
                  style={{ padding: '0.55rem 1.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
                >
                  <DashboardIcon name="edit" size={15} />
                  <span>Edit Profile & Photo</span>
                </button>
              </div>
            </div>
          ) : (
            /* ================= EDIT MODE ================= */
            <form onSubmit={handleSaveProfile} className="dietitian-edit-form">
              {/* Photo Upload & Preview Section */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.25rem',
                  padding: '1.15rem',
                  background: 'var(--color-pearl-white)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-subtle)',
                  marginBottom: '1.25rem',
                }}
              >
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  {previewPhoto && !photoError ? (
                    <img
                      src={previewPhoto}
                      alt="Preview"
                      onError={() => setPhotoError(true)}
                      style={{
                        width: '76px',
                        height: '76px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '2px solid var(--color-primary)',
                        display: 'block',
                      }}
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
                        fontSize: '1.4rem',
                        fontWeight: 700,
                      }}
                    >
                      {initials}
                    </div>
                  )}

                  <label
                    htmlFor="dietitian-photo-edit-input"
                    title="Change practitioner photograph"
                    style={{
                      position: 'absolute',
                      bottom: '-2px',
                      right: '-2px',
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      background: 'var(--color-primary)',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: saving ? 'wait' : 'pointer',
                      border: '2px solid #FFFFFF',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                    }}
                  >
                    <DashboardIcon name="camera" size={12} />
                  </label>
                  <input
                    id="dietitian-photo-edit-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handlePhotoSelectInEditMode}
                    disabled={saving}
                    style={{ display: 'none' }}
                  />
                </div>

                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.92rem', fontWeight: 700, color: 'var(--color-deep-slate)' }}>
                    Practitioner Profile Photograph
                  </h4>
                  <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.78rem', color: 'var(--color-slate-muted)' }}>
                    {selectedPhotoFile
                      ? `Selected: ${selectedPhotoFile.name} (Ready to save)`
                      : 'Upload a professional clinic photo. JPEG, PNG, or WebP up to 5 MB.'}
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <label
                      htmlFor="dietitian-photo-edit-input"
                      className="btn-ayur-outline"
                      style={{
                        fontSize: '0.76rem',
                        padding: '0.35rem 0.7rem',
                        cursor: saving ? 'wait' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}
                    >
                      <DashboardIcon name="upload" size={12} />
                      <span>{previewPhoto ? 'Replace Photo' : 'Upload Photo'}</span>
                    </label>

                    {previewPhoto && (
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        disabled={saving}
                        className="btn-ayur-outline"
                        style={{
                          fontSize: '0.76rem',
                          padding: '0.35rem 0.7rem',
                          color: '#b91c1c',
                          borderColor: '#fecaca',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                        }}
                      >
                        <DashboardIcon name="trash" size={12} />
                        <span>Remove Photo</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Form Fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                    Doctor Full Name <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleNameChange}
                    onKeyDown={handleNameKeyDown}
                    placeholder="e.g. Dr. Vaidya"
                    className="form-input"
                    required
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                  {fieldErrors.name && (
                    <span style={{ color: '#dc2626', fontSize: '0.78rem', marginTop: '0.25rem', display: 'block' }}>
                      {fieldErrors.name}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                    Professional Title / Role
                  </label>
                  <input
                    type="text"
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    placeholder="e.g. Chief Clinical Dietitian"
                    className="form-input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Ayurvedic & Clinical Qualifications
                </label>
                <input
                  type="text"
                  name="qualifications"
                  value={formData.qualifications}
                  onChange={handleInputChange}
                  placeholder="e.g. BAMS, MD (Ayurveda), PGD Clinical Nutrition"
                  className="form-input"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                    Clinic Center Name
                  </label>
                  <input
                    type="text"
                    name="clinic_name"
                    value={formData.clinic_name}
                    onChange={handleInputChange}
                    placeholder="e.g. AyurDiet Integrative Health Clinic"
                    className="form-input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                    Direct Contact Number
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handlePhoneChange}
                    placeholder="+91 98765 43210"
                    className="form-input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                  {fieldErrors.phone && (
                    <span style={{ color: '#dc2626', fontSize: '0.78rem', marginTop: '0.25rem', display: 'block' }}>
                      {fieldErrors.phone}
                    </span>
                  )}
                </div>
              </div>

              {/* Form Action Buttons */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.75rem',
                  borderTop: '1px solid var(--color-border-subtle)',
                  paddingTop: '1rem',
                  alignItems: 'center',
                }}
              >
                <button
                  type="button"
                  className="btn-ayur-outline"
                  onClick={handleCancelEdit}
                  disabled={saving}
                  style={{ padding: '0.55rem 1.1rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-ayur-primary"
                  disabled={saving || Boolean(fieldErrors.name || fieldErrors.phone)}
                  style={{
                    padding: '0.55rem 1.35rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                  }}
                >
                  {saving ? (
                    <>
                      <DashboardIcon name="refresh-cw" size={15} className="ayur-spin" />
                      <span>Saving to Database...</span>
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
