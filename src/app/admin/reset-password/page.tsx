import { ResetPasswordForm } from "@/components/admin/reset-password-form";

export const metadata = { title: "Set password", robots: { index: false } };

/**
 * Where recovery and invitation links land.
 *
 * Dynamic on purpose: the token arrives in the URL fragment, so there is
 * nothing to prerender and nothing the server can read.
 */
export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return (
    <div className="admin-login">
      <h1>Set a password</h1>
      <ResetPasswordForm />
    </div>
  );
}
