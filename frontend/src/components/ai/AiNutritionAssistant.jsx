import React, { useState } from 'react';
import { api } from '../../services/api';
import DashboardIcon from '../ui/DashboardIcons';

const QUICK_PROMPTS = [
  'Pitta pacifying diet guidelines for summer (Grishma)',
  'Ayurvedic management of Mandagni and Ama accumulation',
  'Pathya and Apathya for high blood pressure (Hridroga)',
  'Dietary protocol for Vata-Kapha dual prakriti',
];

export default function AiNutritionAssistant({ activePatient }) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: `Namaste! I am your AyurDiet AI Nutrition Assistant, grounded in verified Ayurvedic treatises (Charaka Samhita, Sushruta Samhita, Ashtanga Hridaya) and ICMR-NIN nutrition data. ${
        activePatient
          ? `You are currently reviewing **${activePatient.name}** (${activePatient.patient_code}, ${activePatient.latest_assessment?.prakriti || 'Assessment pending'}). How can I assist with this patient's clinical nutrition protocol?`
          : 'How may I assist your clinical diet planning and classical evidence review today?'
      }`,
      citations: [],
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendMessage = async (textToSend) => {
    const q = (textToSend || inputQuery).trim();
    if (!q || loading) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: q,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputQuery('');
    setLoading(true);

    try {
      // Connect to real backend RAG retrieval
      const res = await api.retrieveRAG({
        query: q,
        top_k: 4,
      });

      const results = res.data?.results || [];
      const citations = results.map((r) => ({
        doc: r.metadata?.document_name || r.source?.document || 'Ayurvedic Source',
        page: r.metadata?.page_number || r.source?.page,
        text: r.text,
        score: r.score || r.rrf_score,
      }));

      // Synthesize a structured response grounded in the retrieved chunks
      let assistantResponseText = '';
      if (results.length > 0) {
        assistantResponseText = `Based on grounded evidence retrieved from our classical Ayurvedic knowledge base for: *"${q}"*:\n\n${results
          .slice(0, 3)
          .map((r) => `• **${r.metadata?.document_name || 'Classical Treatise'}**: ${r.text.slice(0, 220)}...`)
          .join('\n\n')}`;
      } else {
        assistantResponseText = `No direct high-confidence passages were retrieved for "${q}". Please consider refining your classical search terms or checking dosha-specific keywords.`;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `asst-${Date.now()}`,
          role: 'assistant',
          text: assistantResponseText,
          citations,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `asst-err-${Date.now()}`,
          role: 'assistant',
          text: `Error retrieving grounded knowledge: ${err.message || 'Service unavailable'}`,
          citations: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ayur-card" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 180px)', minHeight: '600px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1rem', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <img
            src="/images/ayurdiet-emblem.png"
            alt="AyurDiet Emblem"
            style={{ width: '38px', height: '38px', objectFit: 'contain' }}
          />
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--color-deep-slate)' }}>
              AyurDiet AI Clinical Assistant
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-muted)' }}>
              Grounded in Hybrid RAG (Qdrant + BM25) & Gemini Guardrails
            </span>
          </div>
        </div>

        {activePatient && (
          <div className="ayur-active-patient-pill" style={{ fontSize: '0.75rem' }}>
            Context: {activePatient.name}
          </div>
        )}
      </div>

      {/* Suggested Prompts */}
      <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', padding: '0.75rem 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
        {QUICK_PROMPTS.map((p, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSendMessage(p)}
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--color-pearl-white)',
              border: '1px solid var(--color-border)',
              fontSize: '0.75rem',
              color: 'var(--color-primary)',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              transition: 'background var(--duration-fast)',
            }}
            onMouseEnter={(e) => (e.target.style.backgroundColor = 'var(--color-soft-aqua-light)')}
            onMouseLeave={(e) => (e.target.style.backgroundColor = 'var(--color-pearl-white)')}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Messages Scroll Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 0', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {messages.map((m) => {
          const isUser = m.role === 'user';
          return (
            <div
              key={m.id}
              style={{
                alignSelf: isUser ? 'flex-end' : 'flex-start',
                maxWidth: '82%',
                display: 'flex',
                gap: '0.75rem',
                flexDirection: isUser ? 'row-reverse' : 'row',
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: isUser ? 'var(--color-deep-slate)' : 'var(--color-soft-aqua-light)',
                  color: isUser ? 'var(--color-pure-white)' : 'var(--color-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {isUser ? 'DR' : <DashboardIcon name="sprout" size={16} />}
              </div>

              <div
                style={{
                  backgroundColor: isUser ? 'var(--color-primary)' : 'var(--color-pearl-white)',
                  color: isUser ? 'var(--color-pure-white)' : 'var(--color-deep-slate)',
                  border: isUser ? 'none' : '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.85rem 1.15rem',
                  fontSize: '0.9rem',
                  lineHeight: '1.5',
                  boxShadow: 'var(--shadow-xs)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {m.text}

                {/* Evidence Citations */}
                {m.citations && m.citations.length > 0 && (
                  <div style={{ marginTop: '0.85rem', paddingTop: '0.65rem', borderTop: '1px solid var(--color-border)', fontSize: '0.78rem' }}>
                    <strong style={{ color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                      <DashboardIcon name="book-open" size={14} /> Grounded Evidence Citations:
                    </strong>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                      {m.citations.map((c, i) => (
                        <span
                          key={i}
                          style={{
                            background: 'var(--color-soft-aqua-light)',
                            color: 'var(--color-deep-slate)',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            border: '1px solid var(--color-soft-aqua)',
                          }}
                        >
                          {c.doc} {c.page ? `(p. ${c.page})` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div style={{ display: 'flex', gap: '0.75rem', alignSelf: 'flex-start' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--color-soft-aqua-light)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DashboardIcon name="sprout" size={16} />
            </div>
            <div style={{ padding: '0.85rem 1.15rem', background: 'var(--color-pearl-white)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: '0.85rem', color: 'var(--color-slate-muted)' }}>
              Searching Qdrant dense vectors & BM25 lexical indexes...
            </div>
          </div>
        )}
      </div>

      {/* Composer Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        style={{ display: 'flex', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}
      >
        <input
          type="text"
          placeholder="Ask a question about Ayurvedic dietary therapy, dosha pacification, or food incompatibilities..."
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          disabled={loading}
          style={{
            flex: 1,
            padding: '0.75rem 1.25rem',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.9rem',
            outline: 'none',
          }}
          onFocus={(e) => (e.target.style.borderColor = 'var(--color-primary)')}
          onBlur={(e) => (e.target.style.borderColor = 'var(--color-border)')}
        />
        <button
          type="submit"
          className="btn-ayur-primary"
          disabled={loading || !inputQuery.trim()}
          style={{ padding: '0.75rem 1.5rem' }}
        >
          {loading ? 'Thinking...' : 'Send →'}
        </button>
      </form>
    </div>
  );
}
