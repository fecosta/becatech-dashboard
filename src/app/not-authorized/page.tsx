import { Card } from "@/components/ui";
import { SignOutButton } from "@/components/SignOutButton";

export default function NotAuthorizedPage() {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-slate-100 px-4">
      <Card className="w-full max-w-sm text-center">
        <div className="py-8">
          <div className="text-lg font-semibold text-slate-700">Acceso restringido</div>
          <p className="mt-1 text-sm text-slate-500">
            Iniciaste sesión correctamente, pero tu cuenta todavía no tiene acceso a este
            dashboard. Contacta a un administrador para que la agregue.
          </p>
          <div className="mt-6 flex justify-center">
            <SignOutButton />
          </div>
        </div>
      </Card>
    </div>
  );
}
