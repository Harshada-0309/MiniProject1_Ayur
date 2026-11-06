/**
 * Integration & Unit Tests for Backend Phase 4 RAG Routes.
 */

const request = require('supertest');
const app = require('../src/app');
const aiService = require('../src/services/aiService');

jest.mock('../src/services/aiService');

describe('Phase 4: RAG Knowledge Retrieval Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/rag/retrieve', () => {
    it('should return 400 when query parameter is missing or empty', async () => {
      const res = await request(app)
        .post('/api/rag/retrieve')
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body.status).toBe('fail');
      expect(res.body.message).toMatch(/Query parameter is required/i);
    });

    it('should return 400 when query parameter is only whitespace', async () => {
      const res = await request(app)
        .post('/api/rag/retrieve')
        .send({ query: '   ' });

      expect(res.statusCode).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should successfully forward valid query and return 200 with structured evidence', async () => {
      const mockRetrievalResponse = {
        query: 'foods suitable for Kapha in winter',
        results: [
          {
            chunk_id: 'doc_ayurvedic_food_properties_p0012_c01',
            document_id: 'doc_ayurvedic_food_properties',
            text: 'Warm, pungent, bitter, and astringent foods pacify Kapha dosha.',
            score: 0.032,
            retrieval_method: 'hybrid',
            dense_rank: 1,
            bm25_rank: 1,
            rrf_score: 0.032,
            metadata: {
              prakriti: 'kapha',
              season: 'winter',
              food_category: 'spice_herb',
            },
            source: {
              document: 'Ayurvedic food properties.pdf',
              page: 12,
              section: 'Kapha Pacification',
            },
          },
        ],
        insufficient_evidence: false,
        retrieval_metadata: {
          dense_results: 1,
          bm25_results: 1,
          final_results: 1,
          retrieval_method: 'hybrid_rrf',
        },
      };

      aiService.retrieveRagEvidence.mockResolvedValueOnce(mockRetrievalResponse);

      const res = await request(app)
        .post('/api/rag/retrieve')
        .send({
          query: 'foods suitable for Kapha in winter',
          top_k: 5,
          filters: { prakriti: 'kapha', season: 'winter' },
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.results.length).toBe(1);
      expect(res.body.data.results[0].chunk_id).toBe('doc_ayurvedic_food_properties_p0012_c01');
      expect(res.body.data.results[0].source.document).toBe('Ayurvedic food properties.pdf');
      expect(aiService.retrieveRagEvidence).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'foods suitable for Kapha in winter',
          top_k: 5,
          filters: { prakriti: 'kapha', season: 'winter' },
        })
      );
    });

    it('should return 503 when AI service is unreachable', async () => {
      const netError = new Error('AI Service connection error');
      netError.status = 503;
      aiService.retrieveRagEvidence.mockRejectedValueOnce(netError);

      const res = await request(app)
        .post('/api/rag/retrieve')
        .send({ query: 'test query' });

      expect(res.statusCode).toBe(503);
      expect(res.body.status).toBe('error');
    });
  });

  describe('GET /api/rag/status', () => {
    it('should return 200 with RAG index status', async () => {
      const mockStatus = {
        status: 'ok',
        qdrant: {
          mode: 'local_embedded',
          collection_name: 'ayurdiet_knowledge',
          vector_count: 5400,
        },
        bm25: {
          loaded: true,
          chunks_indexed: 5400,
        },
      };

      aiService.getRagStatus.mockResolvedValueOnce(mockStatus);

      const res = await request(app).get('/api/rag/status');

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.qdrant.collection_name).toBe('ayurdiet_knowledge');
    });
  });
});
