import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, GraduationCap, PencilLine } from "lucide-react";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-4 py-10 text-fg">
      <span className="flex size-14 items-center justify-center rounded-xl bg-primary text-primary-fg">
        <BookOpen className="size-7" />
      </span>
      <h1 className="mt-4 font-display text-3xl font-medium tracking-tight sm:text-4xl">Page Aloud</h1>
      <p className="mt-2 max-w-md text-center text-sm text-muted">
        Photograph a book page, review each word, then let students read along with karaoke-style narration.
      </p>
      <p className="mt-6 text-sm font-medium text-fg">Who’s using it today?</p>
      <div className="mt-4 grid w-full max-w-xl gap-3 sm:grid-cols-2">
        <Link
          to="/teacher"
          className="flex flex-col items-start gap-2 rounded-2xl bg-surface p-6 shadow-border transition-[box-shadow,transform] duration-150 ease-out hover:shadow-md"
        >
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <PencilLine className="size-5" />
          </span>
          <span className="font-display text-xl font-medium tracking-tight">Teacher</span>
          <span className="text-sm text-muted">
            Create and review books. Needs the shared password.
          </span>
        </Link>
        <Link
          to="/read"
          className="flex flex-col items-start gap-2 rounded-2xl bg-surface p-6 shadow-border transition-[box-shadow,transform] duration-150 ease-out hover:shadow-md"
        >
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <GraduationCap className="size-5" />
          </span>
          <span className="font-display text-xl font-medium tracking-tight">Student</span>
          <span className="text-sm text-muted">Read a book out loud. Just type your name — no password.</span>
        </Link>
      </div>
    </div>
  );
}
