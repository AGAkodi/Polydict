'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div style={{ padding: '40px', fontFamily: 'monospace', color: 'var(--text-primary)', background: 'var(--bg-primary)', height: '100vh' }}>
          <h2>System Error</h2>
          <p>An unexpected error occurred.</p>
          <button onClick={() => reset()} style={{ padding: '8px 16px', marginTop: '16px', background: 'var(--accent)', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
