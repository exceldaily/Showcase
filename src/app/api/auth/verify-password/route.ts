import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { password } = await request.json()
    const correctPassword = process.env.APP_PASSWORD

    if (!correctPassword) {
      return NextResponse.json(
        { error: 'Password not configured' },
        { status: 500 }
      )
    }

    if (password === correctPassword) {
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json(
      { error: 'Incorrect password' },
      { status: 401 }
    )
  } catch {
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    )
  }
}
