import { ForgotPasswordForm } from "@/components/admin/forgot-password-form";

export const metadata = { title: "Reset password", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <div className="admin-login">
      <h1>Reset password</h1>
      <p className="article__meta">
        We will email you a link to set a new one.
      </p>
      <ForgotPasswordForm />
    </div>
  );
}
