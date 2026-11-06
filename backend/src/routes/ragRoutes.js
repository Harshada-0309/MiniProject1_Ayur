/**
 * RAG Knowledge Base Retrieval Routes.
 */

const express = require('express');
const ragController = require('../controllers/ragController');

const router = express.Router();

// Retrieve evidence via Hybrid RRF (Dense Qdrant + Lexical BM25)
router.post('/retrieve', ragController.retrieveEvidence);

// Fetch RAG index and vector store status
router.get('/status', ragController.getStatus);

module.exports = router;
