"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";

export function PasswordResetToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const passwordReset = searchParams.get("password_reset");

  useEffect(() => {
    if (passwordReset === "success") {
      toast.success("Password updated successfully!");
      // Remove the query parameter from URL without refresh
      const url = new URL(window.location.href);
      url.searchParams.delete("password_reset");
      router.replace(url.pathname, { scroll: false });
    }
  }, [passwordReset, router]);

  return null;
}
