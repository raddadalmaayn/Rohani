import { Skeleton } from "@/components/ui/skeleton"

export function SearchLoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Practical Tip Skeleton */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-6 w-24" />
        </div>
        <div className="border-l-4 border-primary rounded-lg p-6 bg-card">
          <Skeleton className="h-4 w-full mb-3" />
          <Skeleton className="h-4 w-5/6 mb-3" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      </div>

      {/* Dua Skeleton */}
      <div className="space-y-4">
        <div className="border-l-4 border-secondary rounded-lg p-6 bg-gradient-to-r from-secondary/5 to-transparent">
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-6 w-20" />
          </div>
          <Skeleton className="h-5 w-full mb-2" />
          <Skeleton className="h-5 w-3/4" />
        </div>
      </div>
    </div>
  )
}

export function OnboardingLoadingSkeleton() {
  return (
    <div className="flex items-center space-x-4">
      <Skeleton className="h-12 w-12 rounded-full" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-[250px]" />
        <Skeleton className="h-4 w-[200px]" />
      </div>
    </div>
  )
}