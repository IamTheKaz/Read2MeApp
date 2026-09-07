import { createFileRoute } from "@tanstack/react-router";
import { TeacherApp } from "@/components/teacher-app";
import { TeacherGate } from "@/components/teacher-gate";

export const Route = createFileRoute("/teacher")({
  component: TeacherStudio,
});

function TeacherStudio() {
  return (
    <TeacherGate>
      <TeacherApp />
    </TeacherGate>
  );
}
