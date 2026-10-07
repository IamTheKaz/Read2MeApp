import { useState } from "react";
import { Eraser, KeyRound, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClearWordFinds, apiDeleteAllBooks, apiResetTeacherPassword } from "@/lib/api";
import { useBookStore } from "@/store/book-store";
import { usePageStore } from "@/store/page-store";

type ConfirmKind = "scores" | "books" | "password" | null;

/**
 * Destructive studio controls. Only rendered inside the password-gated teacher
 * area. Every action re-checks the teacher password on the server and asks
 * "Are you sure?" in a confirm dialog before it runs.
 */
export function TeacherAdmin({ onChanged }: { onChanged?: () => void }) {
  const reload = useBookStore((s) => s.reload);
  const resetEditor = usePageStore((s) => s.reset);
  const [confirm, setConfirm] = useState<ConfirmKind>(null);
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newConfirm, setNewConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function open(kind: ConfirmKind) {
    setConfirm(kind);
    setPassword("");
    setCurrentPassword("");
    setNewPassword("");
    setNewConfirm("");
    setError(null);
  }

  function close() {
    if (busy) return;
    setConfirm(null);
    setError(null);
  }

  async function run() {
    setError(null);
    setBusy(true);
    try {
      if (confirm === "scores") {
        const res = await apiClearWordFinds(password);
        if (!res.ok) {
          setError("That password isn't right.");
          return;
        }
        setNotice("All recorded scores were cleared.");
        setConfirm(null);
        onChanged?.();
        return;
      }
      if (confirm === "books") {
        const res = await apiDeleteAllBooks(password);
        if (!res.ok) {
          setError("That password isn't right.");
          return;
        }
        resetEditor();
        await reload();
        setNotice("Every book was deleted.");
        setConfirm(null);
        onChanged?.();
        return;
      }
      if (confirm === "password") {
        if (newPassword.trim().length < 4) {
          setError("Choose a password of at least 4 characters.");
          return;
        }
        if (newPassword !== newConfirm) {
          setError("New passwords don't match.");
          return;
        }
        const res = await apiResetTeacherPassword(currentPassword, newPassword);
        if (!res.ok) {
          setError("Current password isn't right.");
          return;
        }
        setNotice("Teacher password was replaced.");
        setConfirm(null);
      }
    } catch {
      setError("Couldn't complete that. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const confirmCopy =
    confirm === "scores"
      ? {
          title: "Clear all scores?",
          body: "Deletes every recorded word-find. Books stay. This can't be undone.",
          action: "Yes, clear scores",
        }
      : confirm === "books"
        ? {
            title: "Delete all books?",
            body: "Removes every book and page. Scores for those books are also removed. This can't be undone.",
            action: "Yes, delete all books",
          }
        : confirm === "password"
          ? {
              title: "Replace the teacher password?",
              body: "The current password will stop working as soon as you confirm. Students are not affected.",
              action: "Yes, replace password",
            }
          : null;

  const canSubmit =
    confirm === "password"
      ? Boolean(currentPassword && newPassword && newConfirm)
      : Boolean(password);

  return (
    <section className="mt-12 rounded-2xl bg-surface p-4 shadow-border sm:p-5">
      <h2 className="font-display text-xl font-medium tracking-tight">Studio admin</h2>
      <p className="mt-1 text-sm text-muted">
        Destructive. Each action asks you to confirm and re-enter the teacher password.
      </p>

      {notice && (
        <p className="mt-3 rounded-lg bg-primary-soft px-3 py-2 text-sm text-primary">{notice}</p>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <Button type="button" variant="outline" onClick={() => open("scores")}>
          <Eraser />
          Clear all scores
        </Button>
        <Button type="button" variant="outline" onClick={() => open("books")}>
          <Trash2 />
          Delete all books
        </Button>
        <Button type="button" variant="outline" onClick={() => open("password")}>
          <KeyRound />
          Reset password
        </Button>
      </div>

      <AlertDialog open={confirm !== null} onOpenChange={(open) => (open ? undefined : close())}>
        <AlertDialogContent>
          {confirmCopy && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{confirmCopy.title}</AlertDialogTitle>
                <AlertDialogDescription>{confirmCopy.body}</AlertDialogDescription>
              </AlertDialogHeader>
              <div className="mt-4 grid gap-2">
                {confirm === "password" ? (
                  <>
                    <Input
                      type="password"
                      autoFocus
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Current password"
                      aria-label="Current teacher password"
                      autoComplete="current-password"
                    />
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New password"
                      aria-label="New teacher password"
                      autoComplete="new-password"
                    />
                    <Input
                      type="password"
                      value={newConfirm}
                      onChange={(e) => setNewConfirm(e.target.value)}
                      placeholder="Confirm new password"
                      aria-label="Confirm new teacher password"
                      autoComplete="new-password"
                    />
                  </>
                ) : (
                  <Input
                    type="password"
                    autoFocus
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Teacher password"
                    aria-label="Teacher password"
                    autoComplete="current-password"
                  />
                )}
                {error && <p className="text-sm text-danger">{error}</p>}
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
                <Button
                  type="button"
                  variant="danger"
                  disabled={busy || !canSubmit}
                  onClick={() => void run()}
                >
                  {busy ? "Working…" : confirmCopy.action}
                </Button>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
