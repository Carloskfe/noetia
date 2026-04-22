'use client';

const OAUTH_URL = process.env.NEXT_PUBLIC_OAUTH_URL ?? 'http://localhost:4000';

export default function SocialAuthButtons() {
  return (
    <>
      <div className="my-4 flex items-center gap-2 text-gray-400 text-sm">
        <span className="flex-1 h-px bg-gray-200" />
        or
        <span className="flex-1 h-px bg-gray-200" />
      </div>

      <div className="space-y-2">
        <a
          href={`${OAUTH_URL}/auth/google`}
          className="flex items-center justify-center gap-2 w-full border rounded-lg py-2 hover:bg-gray-50 transition text-sm"
        >
          Continue with Google
        </a>
        <a
          href={`${OAUTH_URL}/auth/facebook`}
          className="flex items-center justify-center gap-2 w-full border rounded-lg py-2 hover:bg-gray-50 transition text-sm"
        >
          Continue with Facebook
        </a>
        <a
          href={`${OAUTH_URL}/auth/apple`}
          className="flex items-center justify-center gap-2 w-full border rounded-lg py-2 hover:bg-gray-50 transition text-sm"
        >
          Continue with Apple
        </a>
      </div>
    </>
  );
}
