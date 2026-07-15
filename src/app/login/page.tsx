import { Card } from "@/components/ui";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-slate-100 px-4">
      <Card className="w-full max-w-sm text-center">
        <div className="py-4">
          <div className="text-sm font-semibold uppercase tracking-wide text-slate-400">ver+</div>
          <div className="text-lg font-semibold text-slate-900">Beca Tech</div>
          <p className="mt-2 text-sm text-slate-500">
            Inicia sesión con tu cuenta de Google para acceder al dashboard.
          </p>
          <div className="mt-6">
            <GoogleSignInButton />
          </div>
        </div>
      </Card>
    </div>
  );
}
