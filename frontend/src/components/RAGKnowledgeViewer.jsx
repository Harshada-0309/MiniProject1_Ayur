import React, { useState } from 'react';
import { api } from '../services/api';
import DashboardIcon from './ui/DashboardIcons';

const QUICK_QUERIES = [
  'Pitta pacifying diet guidelines',
  'Dietary guidelines for cardiac disorders (Hridroga)',
  'Ayurveda diet for mental health (Manasa Roga)',
  'Foods increasing Kapha and Ama',
  'Pathya and Apathya in summer season (Grishma)',
];

export default function RAGKnowledgeViewer() {
  const [query, setQuery] = useState('');
  const [topK, setTopK] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [retrievalData, setRetrievalData] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (overrideQuery) => {
    const searchQuery = (overrideQuery !== undefined ? overrideQuery : query).trim();
    if (!searchQuery) return;

    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const res = await api.retrieveRAG({
        query: searchQuery,
        top_k: Number(topK) || 5,
      });

      setRetrievalData(res.data || null);
    } catch (err) {
      console.error('RAG Retrieval error:', err);
      setError(err.message || 'Failed to retrieve evidence from the Ayurvedic knowledge base.');
      setRetrievalData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  const handleSelectQuickQuery = (q) => {
    setQuery(q);
    handleSearch(q);
  };

  const results = retrievalData?.results || [];
  const metadata = retrievalData?.retrieval_metadata || {};
  const isInsufficient = retrievalData?.insufficient_evidence;

  const formatSourceType = (type) => {
    if (!type) return null;
    return type
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <div className="rag-viewer-container">
      {/* 1. Header Banner */}
      <div className="rag-hero-card">
        <div className="rag-hero-header">
          <div className="rag-icon-badge" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DashboardIcon name="book-open" size={22} />
          </div>
          <div>
            <h2 className="rag-title">Ayurvedic Knowledge Base</h2>
            <p className="rag-subtitle">
              Search the grounded Ayurvedic knowledge base and review source evidence.
            </p>
          </div>
        </div>

        {/* Search Input Box */}
        <div className="rag-search-box">
          <div className="rag-input-wrapper">
            <span className="rag-search-icon" style={{ display: 'flex', alignItems: 'center' }}>
              <DashboardIcon name="search" size={16} />
            </span>
            <input
              type="text"
              className="rag-search-input"
              placeholder="Ask a question about Ayurvedic dietary guidance..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
            {query && (
              <button
                type="button"
                className="rag-clear-btn"
                onClick={() => setQuery('')}
                title="Clear query"
              >
                &times;
              </button>
            )}
          </div>

          <div className="rag-controls">
            <label className="rag-topk-label">
              <span>Top Results:</span>
              <select
                className="rag-topk-select"
                value={topK}
                onChange={(e) => setTopK(Number(e.target.value))}
                disabled={loading}
              >
                <option value={3}>3 chunks</option>
                <option value={5}>5 chunks</option>
                <option value={10}>10 chunks</option>
              </select>
            </label>

            <button
              type="button"
              className="btn-primary rag-search-btn"
              onClick={() => handleSearch()}
              disabled={loading || !query.trim()}
            >
              {loading ? 'Searching...' : 'Search Knowledge Base'}
            </button>
          </div>
        </div>

        {/* Quick Query Suggestions */}
        <div className="rag-quick-queries">
          <span className="rag-quick-label">Suggested Queries:</span>
          <div className="rag-quick-chips">
            {QUICK_QUERIES.map((q, idx) => (
              <button
                key={idx}
                type="button"
                className="rag-chip"
                onClick={() => handleSelectQuickQuery(q)}
                disabled={loading}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Safety / Grounding Notice */}
      <div className="rag-safety-notice">
        <span className="rag-safety-icon" style={{ display: 'flex', alignItems: 'center' }}>
          <DashboardIcon name="shield-check" size={18} />
        </span>
        <div className="rag-safety-text">
          <strong>Clinical Verification Notice:</strong> Grounded evidence from the AyurDiet knowledge base.
          This content is for dietitian review and is not a diagnosis or independent medical advice.
        </div>
      </div>

      {/* 3. Error Banner */}
      {error && (
        <div className="toast-banner toast-error" style={{ margin: '1rem 0' }}>
          <div>
            <strong>Knowledge Retrieval Error:</strong> {error}
          </div>
        </div>
      )}

      {/* 4. Loading State */}
      {loading && (
        <div className="rag-loading-state">
          <div className="nutrition-spinner" />
          <h4 style={{ color: '#174d3c', marginTop: '1rem', fontWeight: 600 }}>
            Querying Grounded Ayurvedic Knowledge Base...
          </h4>
          <p style={{ color: '#4a5d55', fontSize: '0.9rem', marginTop: '0.4rem' }}>
            Executing Hybrid RRF retrieval across Dense semantic vectors and Lexical BM25 indexes.
          </p>
        </div>
      )}

      {/* 5. Insufficient Evidence Warning Banner */}
      {!loading && hasSearched && isInsufficient && (
        <div className="rag-insufficient-warning">
          <span style={{ display: 'flex', alignItems: 'center' }}>
            <DashboardIcon name="shield-alert" size={20} />
          </span>
          <div>
            <strong>Notice:</strong> Insufficient evidence found in the knowledge base for this query.
            <div style={{ fontSize: '0.85rem', marginTop: '0.2rem', opacity: 0.9 }}>
              No authoritative classical Ayurvedic or ICMR-NIN passages met the required retrieval relevance threshold.
            </div>
          </div>
        </div>
      )}

      {/* 6. Empty State (Before Searching) */}
      {!loading && !hasSearched && (
        <div className="empty-state" style={{ marginTop: '1.5rem', background: '#ffffff' }}>
          <div className="empty-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem', color: 'var(--color-primary)' }}>
            <DashboardIcon name="book-open" size={36} />
          </div>
          <h3 style={{ fontSize: '1.2rem', color: '#0f2d23', marginBottom: '0.4rem' }}>
            Search the knowledge base to view grounded Ayurvedic evidence.
          </h3>
          <p style={{ maxWidth: '520px', fontSize: '0.9rem', color: '#4a5d55', marginBottom: '1.5rem' }}>
            Explore verified classical Ayurvedic treatises (Charaka Samhita, Sushruta Samhita, Ashtanga Hridaya),
            CCRAS clinical dietary guidelines, and ICMR-NIN nutrition tables.
          </p>
        </div>
      )}

      {/* 7. Search Results */}
      {!loading && hasSearched && retrievalData && (
        <div className="rag-results-container">
          {/* Retrieval Metadata Strip */}
          <div className="rag-meta-strip">
            <div className="rag-meta-left">
              <span className="rag-meta-pill">
                <strong>Method:</strong> {metadata.retrieval_method === 'hybrid_rrf' ? 'Hybrid RRF (Dense + BM25)' : metadata.retrieval_method || 'Dense + BM25'}
              </span>
              <span className="rag-meta-pill">
                <strong>Results:</strong> {results.length} evidence chunk(s)
              </span>
              {metadata.query_expanded && (
                <span className="rag-meta-pill rag-pill-expanded" title={`Expanded: ${metadata.query_expanded}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <DashboardIcon name="search" size={12} />
                  <span>Query Expanded</span>
                </span>
              )}
            </div>

            <div className="rag-meta-right">
              <span style={{ fontSize: '0.82rem', color: '#4a5d55' }}>
                Query: <em>"{retrievalData.query}"</em>
              </span>
            </div>
          </div>

          {results.length === 0 && !isInsufficient && (
            <div className="empty-state" style={{ marginTop: '1rem', background: '#ffffff' }}>
              <div className="empty-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem', color: 'var(--color-slate-light)' }}>
                <DashboardIcon name="search" size={36} />
              </div>
              <h4 style={{ color: '#0f2d23' }}>No Matching Passages Found</h4>
              <p style={{ fontSize: '0.88rem', color: '#4a5d55' }}>
                Try adjusting your search terms or using one of the suggested queries above.
              </p>
            </div>
          )}

          {/* Results List */}
          <div className="rag-cards-grid">
            {results.map((item, index) => {
              const meta = item.metadata || {};
              const src = item.source || {};
              const docName = meta.document_name || src.document || item.document_id || 'Ayurvedic Source';
              const pageNum = meta.page_number !== undefined ? meta.page_number : src.page;
              const section = src.section || meta.source_title || meta.ayurvedic_category;
              const score = item.score !== undefined ? item.score : item.rrf_score;
              const sourceType = meta.source_type;

              return (
                <div key={item.chunk_id || index} className="rag-evidence-card">
                  {/* Card Header */}
                  <div className="rag-card-header">
                    <div className="rag-card-title-group">
                      <span className="rag-chunk-num">#{index + 1}</span>
                      <h4 className="rag-doc-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                        <DashboardIcon name="file-text" size={15} />
                        <span>{docName}</span>
                      </h4>
                    </div>

                    <div className="rag-card-badges">
                      {pageNum !== undefined && pageNum !== null && (
                        <span className="rag-badge-page">
                          p. {pageNum}
                        </span>
                      )}
                      {sourceType && (
                        <span className="rag-badge-type">
                          {formatSourceType(sourceType)}
                        </span>
                      )}
                      {score !== undefined && (
                        <span className="rag-badge-score" title={`Retrieval Score: ${score}`}>
                          Score: {(Number(score) || 0).toFixed(4)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Section / Context Breadcrumb */}
                  {section && (
                    <div className="rag-section-breadcrumb">
                      <span className="rag-section-label">Section:</span> {section}
                    </div>
                  )}

                  {/* Chunk Text */}
                  <div className="rag-chunk-text">
                    {item.text}
                  </div>

                  {/* Metadata Tags Footer */}
                  <div className="rag-card-footer">
                    <div className="rag-tags-list">
                      {meta.dosha && (
                        <span className="rag-tag rag-tag-dosha">
                          Dosha: <strong>{meta.dosha}</strong>
                        </span>
                      )}
                      {meta.clinical_condition && (
                        <span className="rag-tag rag-tag-condition">
                          Condition: <strong>{meta.clinical_condition}</strong>
                        </span>
                      )}
                      {meta.ayurvedic_category && (
                        <span className="rag-tag">
                          Category: <strong>{meta.ayurvedic_category}</strong>
                        </span>
                      )}
                      {meta.food_category && (
                        <span className="rag-tag">
                          Food: <strong>{meta.food_category}</strong>
                        </span>
                      )}
                      {meta.season && (
                        <span className="rag-tag">
                          Season: <strong>{meta.season}</strong>
                        </span>
                      )}
                    </div>

                    <span className="rag-chunk-id">
                      ID: {item.chunk_id || 'chunk'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
