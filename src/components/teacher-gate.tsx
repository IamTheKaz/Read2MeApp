import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, BookOpen, KeyRound, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiSetTeacherPassword, apiVerifyTeacherPassword, fetchTeacherStatus } from "@/lib/api";

type GateState = "loading" | "setup" | "locked" | "unlocked" | "error";

const UNLOCK_KEY = "page-aloud-teacher-unlocked";

/**
 * Shared teacher-password gate (single password, not per-teacher accounts).
 * First run: whoever opens the teacher side sets the password. After that it's
 * required to create/edit books. Auth-off per project rules — this is a light
 * shared gate, not a login system.
 */
export function TeacherGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GateState>("loading");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetchTeacherStatus()
      .then(({ hasPassword }) => {
        if (hasPassword && sessionStorage.getItem(UNLOCK_KEY) === "1") {
          setState("unlocked");
        } else {
          setState(hasPassword ? "locked" : "setup");
        }
      })
      .catch(() => setState("error"));
  }, []);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      if (state === "setup") {
        if (password.trim().length < 4) {
          setError("Choose a password of at least 4 characters.");
          return;
        }
        if (password !== confirm) {
          setError("Passwords don't match.");
          return;
        }
        const res = await apiSetTeacherPassword(password);
        if (!res.ok) {
          setError(
            res.alreadySet
              ? "A password is already set. Enter it to continue."
              : "Couldn't set the password.",
          );
          if (res.alreadySet) setState("locked");
          return;
        }
        sessionStorage.setItem(UNLOCK_KEY, "1");
        setState("unlocked");
      } else {
        const res = await apiVerifyTeacherPassword(password);
        if (!res.ok) {
          setError("That password isn't right. Try again.");
          return;
        }
        sessionStorage.setItem(UNLOCK_KEY, "1");
        setState("unlocked");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (state === "unlocked") return <>{children}</>;

  const setup = state === "setup";

  return (
    <div className="min-h-dvh bg-bg px-4 py-8 text-fg">
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center">
        <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
          <ArrowLeft className="size-4" />
          Home
        </Link>
        <div className="rounded-2xl bg-surface p-6 shadow-border sm:p-8">
          {state === "loading" ? (
            <p className="text-sm text-muted">Checking teacher access…</p>
          ) : state === "error" ? (
            <>
              <span className="flex size-12 items-center justify-center rounded-lg bg-danger-soft text-danger">
                <Lock className="size-6" />
              </span>
              <h1 className="mt-4 font-display text-2xl font-medium tracking-tight">Couldn’t open the studio</h1>
              <p className="mt-2 text-sm text-muted">
                The app couldn’t reach the teacher password store. Refresh and try again.
              </p>
              <Button className="mt-5" onClick={() => window.location.reload()}>
                Try again
              </Button>
            </>
          ) : (
            <>
              <span className="flex size-12 items-center justify-center rounded-lg bg-primary-soft text-primary">
                {setup ? <BookOpen className="size-6" /> : <Lock className="size-6" />}
              </span>
              <h1 className="mt-4 font-display text-2xl font-medium tracking-tight">
                {setup ? "Set the teacher password" : "Teacher sign-in"}
              </h1>
              <p className="mt-2 text-sm text-muted">
                {setup
                  ? "One shared password protects creating and editing books. Pick something the staff will remember."
                  : "Enter the shared teacher password to open the book studio."}
              </p>
              <form
                className="mt-5 flex flex-col gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!busy) void submit();
                }}
              >
                <Input
                  type="password"
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={setup ? "Choose a password" : "Teacher password"}
                  aria-label="Teacher password"
                  autoComplete={setup ? "new-password" : "current-password"}
                />
                {setup && (
                  <Input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Confirm password"
                    aria-label="Confirm password"
                    autoComplete="new-password"
                  />
                )}
                {error && <p className="text-sm text-danger">{error}</p>}
                <Button type="submit" disabled={busy || (setup ? !password || !confirm : !password)}>
                  <KeyRound />
                  {busy ? "One moment…" : setup ? "Set password" : "Unlock"}
                </Button>
              </form>
            </>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-subtle">
          Students don’t need this — they open a shared reading link and just type their name.
        </p>
      </div>
    </div>
  );
}

export function lockTeacherStudio() {
  sessionStorage.removeItem(UNLOCK_KEY);
}
