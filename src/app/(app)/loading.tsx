export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Yuklanmoqda">
      <div className="skeleton h-10 w-64 rounded-xl" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="skeleton h-44 rounded-3xl lg:col-span-2" />
        <div className="skeleton h-44 rounded-3xl" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}
      </div>
      <div className="skeleton h-72 rounded-3xl" />
    </div>
  );
}
