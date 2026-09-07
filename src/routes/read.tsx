import { createFileRoute } from "@tanstack/react-router";
import { StudentApp } from "@/components/student-app";

export const Route = createFileRoute("/read")({
  component: () => (
    <div className="min-h-dvh bg-bg px-4 py-6 text-fg sm:px-6 sm:py-8">
      <StudentApp />
    </div>
  ),
});
