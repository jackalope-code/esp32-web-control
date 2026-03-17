import { getProviders, signIn } from 'next-auth/react';
import React from 'react';

export default async function SignInPage() {
  const providers = await getProviders();
  return (
    <div style={{ padding: 32, textAlign: 'center' }}>
      <h1>Sign in</h1>
      {providers && Object.values(providers).map((provider) => (
        <div key={provider.name} style={{ margin: 16 }}>
          <button onClick={() => signIn(provider.id)}>
            Sign in with {provider.name}
          </button>
        </div>
      ))}
    </div>
  );
}
