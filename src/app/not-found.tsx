import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ padding: '40px', fontFamily: 'monospace', color: 'var(--text-primary)', background: 'var(--bg-primary)', height: '100vh' }}>
      <h2>Not Found</h2>
      <p>Could not find requested resource</p>
      <Link href="/" style={{ display: 'inline-block', marginTop: '16px', color: 'var(--accent)' }}>
        Return Home
      </Link>
    </div>
  );
}
