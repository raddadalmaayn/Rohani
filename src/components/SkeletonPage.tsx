import React from 'react';

const SkeletonPage: React.FC = () => {
  return (
    <div className="bg-mushaf-page rounded-lg shadow-lg border border-mushaf-badge-stroke/20 overflow-hidden animate-pulse mushaf-wrapper mx-auto">
      {/* Header skeleton */}
      <div className="text-center py-6 px-4 border-b border-mushaf-badge-stroke/30">
        <div className="inline-block border-2 border-mushaf-badge-stroke/30 rounded-lg p-4">
          <div className="h-6 bg-mushaf-badge-stroke/20 rounded w-32 mb-2"></div>
          <div className="h-3 bg-mushaf-badge-stroke/20 rounded w-20"></div>
        </div>
      </div>

      {/* Basmala skeleton */}
      <div className="text-center py-6">
        <div className="h-8 bg-mushaf-badge-stroke/20 rounded w-64 mx-auto"></div>
      </div>

      {/* Verses skeleton */}
      <div className="px-6 py-8 min-h-[500px] space-y-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="flex items-center gap-2 justify-end">
              <div className="h-4 bg-mushaf-badge-stroke/20 rounded flex-1"></div>
              <div className="w-6 h-6 bg-mushaf-badge-stroke/20 rounded-full"></div>
            </div>
            <div className="h-4 bg-mushaf-badge-stroke/10 rounded w-3/4 ml-auto"></div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SkeletonPage;