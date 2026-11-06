import React from 'react';

export default function LoadingSpinner({ message = 'Loading...', size = 'md' }) {
  const dimension = size === 'sm' ? 24 : size === 'lg' ? 48 : 34;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2.5rem 1rem' }}>
      <div
        style={{
          width: `${dimension}px`,
          height: `${dimension}px`,
          border: '3px solid var(--color-border)',
          borderTopColor: 'var(--color-primary)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      {message && (
        <span style={{ marginTop: '0.85rem', fontSize: '0.88rem', color: 'var(--color-slate-muted)', fontWeight: 500 }}>
          {message}
        </span>
      )}
    </div>
  );
}
