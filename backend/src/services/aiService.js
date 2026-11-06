/**
 * Service Client for Communication between Node.js Backend and Python FastAPI AI Service.
 */

const config = require('../config/env');

const aiService = {
  /**
   * Send patient assessment data to FastAPI Nutrition Engine
   * @param {Object} payload - Assessment and demographic metrics
   */
  async calculateNutrition(payload) {
    const url = `${config.aiService.url}/api/nutrition/calculate`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        const error = new Error(data.message || data.detail || 'Nutrition engine calculation failed');
        error.status = response.status;
        error.details = data;
        throw error;
      }

      return data;
    } catch (err) {
      if (err.status) throw err;
      // Network or connection refused to FastAPI
      const netError = new Error(`AI Service connection error (${url}): ${err.message}`);
      netError.status = 503;
      throw netError;
    }
  },

  /**
   * Phase 4: Retrieve Ayurvedic and clinical evidence chunks via Hybrid RAG
   * @param {Object} payload - { query, top_k, filters, dense_weight, bm25_weight, rrf_k }
   */
  async retrieveRagEvidence(payload) {
    const url = `${config.aiService.url}/api/rag/retrieve`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        const error = new Error(data.message || data.detail || 'RAG retrieval failed');
        error.status = response.status;
        error.details = data;
        throw error;
      }

      return data;
    } catch (err) {
      if (err.status) throw err;
      const netError = new Error(`AI Service connection error (${url}): ${err.message}`);
      netError.status = 503;
      throw netError;
    }
  },

  /**
   * Phase 4: Fetch RAG Knowledge Base and index connection status
   */
  async getRagStatus() {
    const url = `${config.aiService.url}/api/rag/status`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        const error = new Error(data.message || data.detail || 'RAG status check failed');
        error.status = response.status;
        error.details = data;
        throw error;
      }

      return data;
    } catch (err) {
      if (err.status) throw err;
      const netError = new Error(`AI Service connection error (${url}): ${err.message}`);
      netError.status = 503;
      throw netError;
    }
  },

  /**
   * Phase 5: Deterministic meal plan generation
   * @param {Object} payload - { patient_assessment, nutrition_targets, meal_structure, custom_meal_distribution }
   */
  async generateMealPlan(payload) {
    const url = `${config.aiService.url}/api/meal-plan/generate`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        const error = new Error(data.message || data.detail || 'Meal plan generation failed');
        error.status = response.status;
        error.details = data;
        throw error;
      }

      return data;
    } catch (err) {
      if (err.status) throw err;
      const netError = new Error(`AI Service connection error (${url}): ${err.message}`);
      netError.status = 503;
      throw netError;
    }
  },

  /**
   * Phase 5: Query safe, nutritionally equivalent food substitutions
   * @param {Object} payload - { food_id, current_quantity, patient_assessment, meal_type }
   */
  async getSubstitutions(payload) {
    const url = `${config.aiService.url}/api/meal-plan/substitutions`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        const error = new Error(data.message || data.detail || 'Food substitution lookup failed');
        error.status = response.status;
        error.details = data;
        throw error;
      }

      return data;
    } catch (err) {
      if (err.status) throw err;
      const netError = new Error(`AI Service connection error (${url}): ${err.message}`);
      netError.status = 503;
      throw netError;
    }
  },

  /**
   * Phase 5: List foods in catalog
   * @param {Object} query - { category, search }
   */
  async listFoods({ category, search } = {}) {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (search) params.append('search', search);

    const qs = params.toString() ? `?${params.toString()}` : '';
    const url = `${config.aiService.url}/api/meal-plan/foods${qs}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        const error = new Error(data.message || data.detail || 'Food catalog fetch failed');
        error.status = response.status;
        error.details = data;
        throw error;
      }

      return data;
    } catch (err) {
      if (err.status) throw err;
      const netError = new Error(`AI Service connection error (${url}): ${err.message}`);
      netError.status = 503;
      throw netError;
    }
  },

  /**
   * Phase 5: Get single food detail with full provenance
   * @param {string} foodId
   */
  async getFoodDetail(foodId) {
    const url = `${config.aiService.url}/api/meal-plan/foods/${encodeURIComponent(foodId)}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        const error = new Error(data.message || data.detail || 'Food item fetch failed');
        error.status = response.status;
        error.details = data;
        throw error;
      }

      return data;
    } catch (err) {
      if (err.status) throw err;
      const netError = new Error(`AI Service connection error (${url}): ${err.message}`);
      netError.status = 503;
      throw netError;
    }
  },

  /**
   * Phase 6: Gemini-formatted, deterministically validated 7-day diet plan generation
   * @param {Object} payload - { patient_assessment, nutrition_targets, meal_structure, custom_meal_distribution, dietitian_notes }
   */
  async generate7DayDietPlan(payload) {
    const url = `${config.aiService.url}/api/diet-plan/generate-7day`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        const error = new Error(data.message || data.detail || '7-Day diet plan generation failed');
        error.status = response.status;
        error.details = data;
        throw error;
      }

      return data;
    } catch (err) {
      if (err.status) throw err;
      const netError = new Error(`AI Service connection error (${url}): ${err.message}`);
      netError.status = 503;
      throw netError;
    }
  },

  /**
   * Phase 6: Deterministically revalidate diet plan after dietitian edits
   * @param {Object} payload - { diet_plan, patient_assessment, nutrition_targets }
   */
  async validateDietPlan(payload) {
    const url = `${config.aiService.url}/api/diet-plan/validate`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        const error = new Error(data.message || data.detail || 'Diet plan validation failed');
        error.status = response.status;
        error.details = data;
        throw error;
      }

      return data;
    } catch (err) {
      if (err.status) throw err;
      const netError = new Error(`AI Service connection error (${url}): ${err.message}`);
      netError.status = 503;
      throw netError;
    }
  },

  /**
   * Export verified diet prescription PDF
   * @param {Object} payload - { patient, assessment, diet_plan }
   */
  async exportDietPlanPdf(payload) {
    const url = `${config.aiService.url}/api/diet-plan/export-pdf`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        const error = new Error(text || 'PDF export failed');
        error.status = response.status;
        throw error;
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (err) {
      if (err.status) throw err;
      const netError = new Error(`AI Service connection error (${url}): ${err.message}`);
      netError.status = 503;
      throw netError;
    }
  },
};

module.exports = aiService;
