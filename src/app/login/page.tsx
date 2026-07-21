import { Card } from "@/components/ui";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-cream px-4">
      <Card className="w-full max-w-sm text-center">
        <div className="py-4">
          <div className="text-sm font-semibold uppercase tracking-wide text-muted">ver+</div>
          <div className="text-lg font-semibold text-ink">Beca Tech+</div>
          <p className="mt-2 text-sm text-muted">
            Sign in with your Google account to access the dashboard.
          </p>
          <div className="mt-6">
            <GoogleSignInButton />
          </div>
        </div>
      </Card>
    </div>
  );
}
