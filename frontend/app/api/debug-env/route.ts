
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    return NextResponse.json({
        message: "Environment Variable Debugger",
        server_vars: {
            NODE_ENV: process.env.NODE_ENV,
            NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL,
            NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
            // We don't expose private secrets, only the public ones we expect
        },
        timestamp: new Date().toISOString()
    });
}
