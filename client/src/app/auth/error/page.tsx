import React from 'react';

export default function AuthErrorPage({ searchParams }: { searchParams: { error?: string } }) {
  const error = searchParams?.error || 'Unknown error';
  return (
    <div style={{ padding: 32, textAlign: 'center' }}>
      <h1>Authentication Error</h1>
      <p>Sorry, there was a problem signing you in.</p>
      <p style={{ color: 'red' }}>Error: {error}</p>
      <a href="/auth/signin">Return to sign in</a>
    </div>
  );
}
