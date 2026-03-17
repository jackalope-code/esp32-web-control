import { NextAuthOptions } from 'next-auth';
import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';

const googleClientId = process.env.GOOGLE_CLIENT_ID || '';
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
const githubClientId = process.env.GITHUB_CLIENT_ID || '';
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET || '';
const authorizedUsers = (process.env.AUTHORIZED_USERS || '').split(',').map(u => u.trim().toLowerCase()).filter(u => u);

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    }),
    GitHubProvider({
      clientId: githubClientId,
      clientSecret: githubClientSecret,
    }),
  ],
  callbacks: {
    async signIn({ profile, account }) {
      if (!authorizedUsers.length) {
        return true;
      }
      
      const email = profile?.email?.toLowerCase();
      const username = account?.provider === 'github' ? (profile as any)?.login?.toLowerCase() : null;
      
      if (email && authorizedUsers.includes(email)) {
        return true;
      }
      if (username && authorizedUsers.includes(username)) {
        return true;
      }
      
      return false;
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role || 'user';
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
