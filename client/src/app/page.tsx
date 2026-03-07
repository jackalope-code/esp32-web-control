'use client';

import { SessionProvider } from 'next-auth/react';
import Dashboard from './Dashboard';

export default function Home() {
  return (
    <SessionProvider>
      <Dashboard />
    </SessionProvider>
  );
}
