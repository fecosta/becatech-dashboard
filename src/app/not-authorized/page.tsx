import { Card } from "@/components/ui";
import { SignOutButton } from "@/components/SignOutButton";

export default function NotAuthorizedPage() {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-cream px-4">
      <Card className="w-full max-w-sm text-center">
        <div className="py-8">
          <div className="text-lg font-semibold text-ink">Access restricted</div>
          <p className="mt-1 text-sm text-muted">
            You signed in successfully, but your account doesn&apos;t have access to this dashboard
            yet. Contact an administrator to have it added.
          </p>
          <div className="mt-6 flex justify-center">
            <SignOutButton />
          </div>
        </div>
      </Card>
    </div>
  );
}
