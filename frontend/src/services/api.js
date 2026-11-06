/**
 * Frontend API Service for AyurDiet Clinical Platform
 * Supports Authenticated Requests, Token Management, and Dietitian Session Handling
 */

const API_BASE = '/api';
const TOKEN_KEY = 'ayurdiet_auth_token';
const USER_KEY = 'ayurdiet_dietitian_user';

export const tokenStorage = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (token) => {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch (err) {
      console.warn('Could not store auth token in localStorage:', err);
    }
  },
  remove: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch (err) {
      console.warn('Could not remove auth data:', err);
    }
  },
  getUser: () => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  setUser: (user) => {
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (err) {
      console.warn('Could not store user in localStorage:', err);
    }
  },
};

function getAuthHeaders(extraHeaders = {}) {
  const token = tokenStorage.get();
  const headers = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function handleResponse(res) {
  let data;
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    if (res.status === 401) {
      // Clear expired credentials
      tokenStorage.remove();
      // Dispatch an event so React state can handle expiration gracefully
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ayurdiet:auth-expired'));
      }
    }

    const errorMsg = data.errors
      ? data.errors.map((e) => `${e.field}: ${e.message}`).join(', ')
      : data.message || `Request failed with status ${res.status}`;
    const error = new Error(errorMsg);
    error.status = res.status;
    error.details = data;
    throw error;
  }
  return data;
}

export const api = {
  // ==========================================
  // Authentication & Session Management
  // ==========================================
  async login(credentials) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    const data = await handleResponse(res);
    if (data?.data?.token) {
      tokenStorage.set(data.data.token);
      if (data.data.dietitian) {
        tokenStorage.setUser(data.data.dietitian);
      }
    }
    return data;
  },

  async register(payload) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await handleResponse(res);
    if (data?.data?.token) {
      tokenStorage.set(data.data.token);
      if (data.data.dietitian) {
        tokenStorage.setUser(data.data.dietitian);
      }
    }
    return data;
  },

  async getCurrentUser() {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeaders(),
    });
    const data = await handleResponse(res);
    if (data?.data?.dietitian) {
      tokenStorage.setUser(data.data.dietitian);
    }
    return data;
  },

  async getDietitians() {
    const res = await fetch(`${API_BASE}/auth/dietitians`);
    return handleResponse(res);
  },

  async uploadDietitianPhoto(file) {
    const formData = new FormData();
    formData.append('photo', file);
    const token = tokenStorage.get();
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`${API_BASE}/upload/dietitian-photo`, {
      method: 'POST',
      headers,
      body: formData,
    });
    const data = await handleResponse(res);
    if (data?.data?.token) {
      tokenStorage.set(data.data.token);
    }
    if (data?.data?.dietitian) {
      tokenStorage.setUser(data.data.dietitian);
    }
    return data;
  },

  async deleteDietitianPhoto() {
    const res = await fetch(`${API_BASE}/upload/dietitian-photo`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    const data = await handleResponse(res);
    if (data?.data?.token) {
      tokenStorage.set(data.data.token);
    }
    if (data?.data?.dietitian) {
      tokenStorage.setUser(data.data.dietitian);
    }
    return data;
  },

  async uploadPatientPhoto(patientId, file) {
    const formData = new FormData();
    formData.append('photo', file);
    const token = tokenStorage.get();
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`${API_BASE}/upload/patient-photo/${patientId}`, {
      method: 'POST',
      headers,
      body: formData,
    });
    return handleResponse(res);
  },

  async deletePatientPhoto(patientId) {
    const res = await fetch(`${API_BASE}/upload/patient-photo/${patientId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async updateDietitianProfile(payload) {
    const isFormData = typeof FormData !== 'undefined' && payload instanceof FormData;
    const token = tokenStorage.get();
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(`${API_BASE}/auth/profile`, {
      method: 'PUT',
      headers,
      body: isFormData ? payload : JSON.stringify(payload),
    });
    const data = await handleResponse(res);
    if (data?.data?.token) {
      tokenStorage.set(data.data.token);
    }
    if (data?.data?.dietitian) {
      tokenStorage.setUser(data.data.dietitian);
    }
    return data;
  },

  async logout() {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
    } catch (err) {
      console.warn('Backend logout call failed or offline:', err.message);
    } finally {
      tokenStorage.remove();
    }
  },

  isAuthenticated() {
    return Boolean(tokenStorage.get());
  },

  getStoredDietitian() {
    return tokenStorage.getUser();
  },

  // ==========================================
  // Patients Management
  // ==========================================
  async getPatients(search = '') {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    const res = await fetch(`${API_BASE}/patients${query}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async getPatientById(id) {
    const res = await fetch(`${API_BASE}/patients/${id}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async createPatient(payload) {
    const res = await fetch(`${API_BASE}/patients`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  async updatePatient(id, payload) {
    const res = await fetch(`${API_BASE}/patients/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  async deletePatient(id) {
    const res = await fetch(`${API_BASE}/patients/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async getPatientDependentCounts(id) {
    const res = await fetch(`${API_BASE}/patients/${id}/dependent-counts`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  // ==========================================
  // Assessments
  // ==========================================
  async getPatientAssessments(patientId) {
    const res = await fetch(`${API_BASE}/patients/${patientId}/assessments`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async getAssessmentById(id) {
    const res = await fetch(`${API_BASE}/assessments/${id}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async createAssessment(patientId, payload) {
    const res = await fetch(`${API_BASE}/patients/${patientId}/assessments`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  async updateAssessment(id, payload) {
    const res = await fetch(`${API_BASE}/assessments/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  // ==========================================
  // Clinical & Laboratory Data
  // ==========================================
  async getLabData(assessmentId) {
    const res = await fetch(`${API_BASE}/assessments/${assessmentId}/lab-data`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async addLabData(assessmentId, payload) {
    const res = await fetch(`${API_BASE}/assessments/${assessmentId}/lab-data`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  async updateLabData(id, payload) {
    const res = await fetch(`${API_BASE}/lab-data/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  async deleteLabData(id) {
    const res = await fetch(`${API_BASE}/lab-data/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async deleteLabAttachment(id) {
    const res = await fetch(`${API_BASE}/lab-data/${id}/attachment`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  // ==========================================
  // Phase 3: Deterministic Nutrition Calculation Engine
  // ==========================================
  async calculateNutrition(payload) {
    const res = await fetch(`${API_BASE}/nutrition/calculate`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  async calculateNutritionForAssessment(assessmentId) {
    const res = await fetch(`${API_BASE}/nutrition/assessments/${assessmentId}/calculate`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  // ==========================================
  // Phase 4: Hybrid RAG Knowledge Retrieval Layer
  // ==========================================
  async retrieveRagEvidence(payload) {
    const res = await fetch(`${API_BASE}/rag/retrieve`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  async retrieveRAG(payload) {
    return this.retrieveRagEvidence(payload);
  },

  async getRagStatus() {
    const res = await fetch(`${API_BASE}/rag/status`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  // ==========================================
  // Phase 5: Food & Meal Planning Engine
  // ==========================================
  async generateMealPlan(payload) {
    const res = await fetch(`${API_BASE}/meal-plan/generate`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  async getSubstitutions(payload) {
    const res = await fetch(`${API_BASE}/meal-plan/substitutions`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  async getFoods(category = '', search = '') {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (search) params.append('search', search);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_BASE}/meal-plan/foods${qs}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async getFoodDetail(foodId) {
    const res = await fetch(`${API_BASE}/meal-plan/foods/${encodeURIComponent(foodId)}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async saveMealPlan(payload) {
    const res = await fetch(`${API_BASE}/meal-plan`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  async getMealPlanById(id) {
    const res = await fetch(`${API_BASE}/meal-plan/${id}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async getPatientMealPlans(patientId) {
    const res = await fetch(`${API_BASE}/meal-plan/patient/${patientId}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  // ==========================================
  // Phase 6: Gemini-Powered 7-Day Diet Plan APIs
  // ==========================================
  async generate7DayDietPlan(payload) {
    const res = await fetch(`${API_BASE}/diet-plan/generate`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  async validateDietPlan(payload) {
    const res = await fetch(`${API_BASE}/diet-plan/validate`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  async saveDietPlan(payload) {
    const res = await fetch(`${API_BASE}/diet-plan`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  async getDietPlanById(id) {
    const res = await fetch(`${API_BASE}/diet-plan/${id}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async getPatientDietPlans(patientId) {
    const res = await fetch(`${API_BASE}/diet-plan/patient/${patientId}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async updateDietPlan(id, payload) {
    const res = await fetch(`${API_BASE}/diet-plan/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  async approveDietPlan(id, payload = { approved_by: 'Dr. Vaidya' }) {
    const res = await fetch(`${API_BASE}/diet-plan/${id}/approve`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  async downloadDietPlanPdf(id) {
    const res = await fetch(`${API_BASE}/diet-plan/${id}/pdf`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      let errMsg = 'Failed to download prescription PDF';
      try {
        const json = await res.json();
        errMsg = json.message || errMsg;
      } catch {
        // ignore
      }
      throw new Error(errMsg);
    }
    return res.blob();
  },

  async sendPrescriptionWhatsApp(id, payload = { consent_confirmed: true }) {
    const res = await fetch(`${API_BASE}/diet-plan/${id}/whatsapp`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  async getWhatsAppHistory(id) {
    const res = await fetch(`${API_BASE}/diet-plan/${id}/whatsapp-history`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },
};
