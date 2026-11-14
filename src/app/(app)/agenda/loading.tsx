import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando agenda">
      <Skeleton className="h-7 w-32" />
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="ml-auto h-9 w-72" />
      </div>
      <Skeleton className="h-[60vh] w-full rounded-xl" />
    </div>
  );
}
