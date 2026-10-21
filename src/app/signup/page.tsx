import { SignupForm } from "./signup-form";
import { Suspense } from "react";

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
