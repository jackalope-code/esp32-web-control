import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import jwt from 'jsonwebtoken';
import { authOptions } from './auth/[...nextauth]/route';

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';
const JWT_ALGORITHM = 'HS256';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Generate a WebSocket token for the authenticated user
    const wsToken = jwt.sign(
      {
        user_id: session.user.email || session.user.name,
        email: session.user.email,
        role: 'user',
        type: 'client',
      },
      JWT_SECRET,
      { algorithm: JWT_ALGORITHM, expiresIn: '1h' }
    );

    return NextResponse.json({ token: wsToken });
  } catch (error) {
    console.error('Error generating WebSocket token:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
