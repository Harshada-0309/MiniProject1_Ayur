/**
 * RAG Knowledge Base Retrieval Controller.
 * Handles dietitian search queries and routes them to the FastAPI Hybrid RAG engine.
 */

const aiService = require('../services/aiService');

const ragController = {
  /**
   * POST /api/rag/retrieve
   * Proxy retrieval request to Python AI Service
   */
  async retrieveEvidence(req, res, next) {
    try {
      const { query, top_k, filters, dense_weight, bm25_weight, rrf_k } = req.body;

      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return res.status(400).json({
          status: 'fail',
          message: 'Query parameter is required and must be a non-empty string',
        });
      }

      const payload = {
        query: query.trim(),
        top_k: top_k ? parseInt(top_k, 10) : 5,
        filters: filters || {},
        dense_weight: dense_weight !== undefined ? parseFloat(dense_weight) : null,
        bm25_weight: bm25_weight !== undefined ? parseFloat(bm25_weight) : null,
        rrf_k: rrf_k !== undefined ? parseInt(rrf_k, 10) : null,
      };

      const result = await aiService.retrieveRagEvidence(payload);

      return res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/rag/status
   * Retrieve vector store and index status
   */
  async getStatus(req, res, next) {
    try {
      const statusData = await aiService.getRagStatus();
      return res.status(200).json({
        status: 'success',
        data: statusData,
      });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = ragController;
