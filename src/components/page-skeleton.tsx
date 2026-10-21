import { Skeleton } from "@/components/ui/skeleton";

/** Generic loading placeholder used by route-level loading.tsx files. */
export function PageSkeleton({
  cards = 6,
  chart = true,
  hero = false,
}: {
  cards?: number;
  chart?: boolean;
  hero?: boolean;
}) {
  return (
    <div>
      <Skeleton className="h-8 w-52" />
      <Skeleton className="mt-2 h-4 w-72" />

      {hero && <Skeleton className="mt-6 h-32 rounded-2xl" />}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cards }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>

      {chart && <Skeleton className="mt-6 h-72 rounded-xl" />}
    </div>
  );
}
