import { LoginForm } from "@/components/admin/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <div className="admin-login">
      <h1>Sign in</h1>
      <p className="article__meta">
        Editorial accounts are created by invitation. There is no public signup.
      </p>
      <LoginForm next={next ?? "/admin"} />
    </div>
  );
}
