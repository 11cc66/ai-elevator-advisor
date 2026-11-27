import { LoadingPanel } from "@/components/loading-panel";

export default function ProjectsLoading() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10">
      <LoadingPanel label="正在加载项目与需求进展…" />
    </main>
  );
}
