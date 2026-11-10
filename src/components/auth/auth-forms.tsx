"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import type { z } from "zod";
import { loginSchema, registerSchema } from "@/lib/validation";
import { loginAction, registerAction } from "@/app/actions/auth";
import { Field, FormError } from "@/components/ui/form";

type LoginValues = z.input<typeof loginSchema>;
type RegisterValues = z.input<typeof registerSchema>;

export function LoginForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginValues, unknown, z.output<typeof loginSchema>>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const res = await loginAction(values);
      if (!res.ok) {
        setFormError(res.error);
        for (const [k, msg] of Object.entries(res.fields ?? {})) {
          if (k === "email" || k === "password") setError(k, { message: msg });
        }
        return;
      }
      router.replace(res.data.onboarded ? "/" : "/onboarding");
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5" aria-labelledby="login-title">
      <div>
        <h2 id="login-title" className="font-display text-3xl font-semibold tracking-tight">
          Xush kelibsiz
        </h2>
        <p className="mt-2 text-ink-2">Hisobingizga kiring va moliyangizni boshqaring.</p>
      </div>

      <FormError message={formError} />

      <Field label="Email" htmlFor="email" error={errors.email?.message}>
        <input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          className="field"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "email-error" : undefined}
          {...register("email")}
        />
      </Field>
      <Field label="Parol" htmlFor="password" error={errors.password?.message}>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          className="field"
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? "password-error" : undefined}
          {...register("password")}
        />
      </Field>

      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
        Kirish
      </button>
    </form>
  );
}

export function RegisterForm({ needsSetupCode = false }: { needsSetupCode?: boolean }) {
  const [setupCode, setSetupCode] = useState("");
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterValues, unknown, z.output<typeof registerSchema>>({ resolver: zodResolver(registerSchema) });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const res = await registerAction(values, needsSetupCode ? setupCode : undefined);
      if (!res.ok) {
        setFormError(res.error);
        for (const [k, msg] of Object.entries(res.fields ?? {})) {
          if (k === "email" || k === "password" || k === "name") setError(k, { message: msg });
        }
        return;
      }
      router.replace("/onboarding");
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5" aria-labelledby="register-title">
      <div>
        <h2 id="register-title" className="font-display text-3xl font-semibold tracking-tight">
          Hisob yaratish
        </h2>
        <p className="mt-2 text-ink-2">Bir daqiqada tayyor: keyingi qadamda hisoblaringizni sozlaymiz.</p>
      </div>

      <FormError message={formError} />

      {needsSetupCode && <Field label="Administrator sozlash kodi" htmlFor="setup-code">
        <input id="setup-code" className="field" type="password" autoComplete="off" value={setupCode} onChange={e => setSetupCode(e.target.value)} />
      </Field>}
      <Field label="Ismingiz" htmlFor="name" error={errors.name?.message}>
        <input id="name" autoComplete="name" className="field" aria-invalid={Boolean(errors.name)} {...register("name")} />
      </Field>
      <Field label="Email" htmlFor="email" error={errors.email?.message}>
        <input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          className="field"
          aria-invalid={Boolean(errors.email)}
          {...register("email")}
        />
      </Field>
      <Field label="Parol" htmlFor="password" error={errors.password?.message} hint="Kamida 8 belgi">
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          className="field"
          aria-invalid={Boolean(errors.password)}
          {...register("password")}
        />
      </Field>

      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
        Davom etish
      </button>

      <p className="text-center text-sm text-ink-2">
        Hisobingiz bormi?{" "}
        <Link href="/login" className="font-semibold text-accent underline underline-offset-4">
          Kirish
        </Link>
      </p>
    </form>
  );
}
