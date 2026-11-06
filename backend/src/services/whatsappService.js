const { generatePrescriptionAccessToken } = require('./authService');
const whatsappAuditRepository = require('../repositories/whatsappAuditRepository');
const aiService = require('./aiService');

/**
 * Validates and normalizes phone numbers into E.164 and clean numeric formats
 */
function normalizePhoneNumber(raw) {
  if (!raw || typeof raw !== 'string') {
    return { isValid: false, error: 'Phone number is required.' };
  }

  // Strip all whitespace, dashes, parentheses, dots
  let cleaned = raw.trim().replace(/[\s\-\(\)\.]/g, '');

  // Handle leading 00 (international format prefix)
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.substring(2);
  }

  // Handle leading single 0 (common domestic Indian prefix for 10-digit numbers)
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = '+91' + cleaned.substring(1);
  }

  // Handle standard 10-digit Indian mobile number
  if (/^[6-9]\d{9}$/.test(cleaned)) {
    cleaned = '+91' + cleaned;
  }

  // Validate E.164 standard: + followed by 10 to 15 digits
  if (!/^\+[1-9]\d{9,14}$/.test(cleaned)) {
    return {
      isValid: false,
      error: 'Please provide a valid 10-digit mobile number or standard international format with country code (e.g., +91 98765 43210).',
    };
  }

  const digitsOnly = cleaned.replace(/^\+/, '');
  const countryCode = cleaned.startsWith('+91') ? '+91' : `+${digitsOnly.slice(0, digitsOnly.length - 10)}`;
  const national = cleaned.slice(countryCode.length);

  return {
    isValid: true,
    e164: cleaned,
    digitsOnly,
    countryCode,
    national,
  };
}

/**
 * Masks phone number for clinical patient privacy in UI (e.g., +91 98••• ••210)
 */
function maskPhoneNumber(phone) {
  const norm = normalizePhoneNumber(phone);
  if (!norm.isValid) return '••••••••••';

  const nat = norm.national;
  if (nat.length === 10) {
    const masked = `${nat.slice(0, 2)}••• ••${nat.slice(7)}`;
    return `${norm.countryCode} ${masked}`;
  }

  // Generic masking
  const prefix = norm.e164.slice(0, 4);
  const suffix = norm.e164.slice(-3);
  return `${prefix}••••${suffix}`;
}

/**
 * Checks if WhatsApp Business Cloud API environment variables are available
 */
function isCloudApiConfigured() {
  const token = process.env.WHATSAPP_API_TOKEN || process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  return Boolean(token && phoneId);
}

/**
 * Generates an Ayurvedic Clinical Prescription message for patient communication
 */
function buildPrescriptionMessage({
  patient,
  dietPlan,
  assessment,
  dietitian,
  downloadUrl,
}) {
  const patientName = patient?.name || 'Patient';
  const planId = dietPlan?.plan_id || `DP-${dietPlan?.id || '101'}`;
  const dietitianName = dietitian?.name || 'Registered Clinical Dietitian';
  const clinicName = dietitian?.clinic_name || 'AyurDiet Clinical Nutrition Center';
  const prakriti = assessment?.prakriti || patient?.prakriti || 'Vata-Pitta';

  // Target extraction
  const targets = dietPlan?.nutrition_targets || {};
  const cals = targets?.energy?.target_energy_kcal_day || targets?.target_energy_kcal_day || 2000;
  const prot = targets?.macronutrients?.protein?.target_g || targets?.protein_g || 65;

  const msg = [
    `🌿 *${clinicName}*`,
    `Official Clinical Diet Prescription`,
    ``,
    `Namaste *${patientName}*,`,
    `Your personalized 7-day Ayurvedic diet prescription has been clinically reviewed, validated, and approved by *${dietitianName}*.`,
    ``,
    `📋 *Prescription Summary*:`,
    `• Prescription ID: ${planId}`,
    `• Doshic Constitution (Prakriti): ${prakriti}`,
    `• Prescribed Daily Energy: ${Math.round(cals)} kcal/day`,
    `• Target Daily Protein: ${Math.round(prot)} g/day`,
    ``,
    `🥣 *Fundamental Ahara Vidhi Guidelines*:`,
    `• Consume warm, freshly prepared meals with mindful presence.`,
    `• Maintain a 3.5 to 4-hour gap between primary meals for optimal Agni.`,
    `• Sip warm water throughout the day; avoid iced drinks with meals.`,
    ``,
    `📄 *Download Official Print-Ready Prescription PDF*:`,
    `${downloadUrl}`,
    ``,
    `_Please adhere to your prescribed meal timings and portions. For queries or your follow-up appointment, reply directly to this clinic number._`,
    `Warm regards,`,
    `*${dietitianName}*`,
    `${clinicName}`,
  ].join('\n');

  return msg;
}

/**
 * Generates prefilled wa.me fallback link
 */
function generateFallbackUrl({
  recipientPhone,
  messageText,
}) {
  const norm = normalizePhoneNumber(recipientPhone);
  if (!norm.isValid) throw new Error(norm.error);

  const encoded = encodeURIComponent(messageText);
  return `https://wa.me/${norm.digitsOnly}?text=${encoded}`;
}

/**
 * Transmits prescription PDF via official Meta WhatsApp Business Cloud API
 */
async function sendViaCloudApi({
  recipientPhone,
  pdfBuffer,
  filename,
  caption,
}) {
  const token = process.env.WHATSAPP_API_TOKEN || process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    throw new Error('WhatsApp Cloud API is not configured on this server.');
  }

  const norm = normalizePhoneNumber(recipientPhone);
  if (!norm.isValid) throw new Error(norm.error);

  // Step 1: Upload PDF buffer to WhatsApp Media endpoint
  const formData = new globalThis.FormData();
  formData.append('messaging_product', 'whatsapp');
  formData.append('type', 'application/pdf');
  const blob = new globalThis.Blob([pdfBuffer], { type: 'application/pdf' });
  formData.append('file', blob, filename || 'AyurDiet_Prescription.pdf');

  const uploadRes = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/media`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!uploadRes.ok) {
    const errData = await uploadRes.json().catch(() => ({}));
    throw new Error(`WhatsApp Media Upload failed: ${errData.error?.message || uploadRes.statusText}`);
  }

  const uploadJson = await uploadRes.json();
  const mediaId = uploadJson.id;

  // Step 2: Send document message using uploaded media ID
  const messagePayload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: norm.digitsOnly,
    type: 'document',
    document: {
      id: mediaId,
      caption: caption || 'AyurDiet Official Clinical Nutrition Prescription',
      filename: filename || 'AyurDiet_Prescription.pdf',
    },
  };

  const sendRes = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messagePayload),
  });

  if (!sendRes.ok) {
    const errData = await sendRes.json().catch(() => ({}));
    throw new Error(`WhatsApp Message Send failed: ${errData.error?.message || sendRes.statusText}`);
  }

  const sendJson = await sendRes.json();
  const messageId = sendJson.messages?.[0]?.id;

  return {
    success: true,
    messageId,
    mediaId,
  };
}

module.exports = {
  normalizePhoneNumber,
  maskPhoneNumber,
  isCloudApiConfigured,
  buildPrescriptionMessage,
  generateFallbackUrl,
  sendViaCloudApi,
};
