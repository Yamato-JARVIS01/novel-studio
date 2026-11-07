export default function App() {
  return (
    <div className="flex h-screen w-screen bg-[#0d1117] text-neutral-200">
      <header className="fixed top-0 left-0 right-0 h-10 border-b border-neutral-800 flex items-center px-4 bg-[#161b22]/80 backdrop-blur z-50">
        <span className="font-semibold text-sm tracking-wide text-neutral-300">NovelStudio</span>
        <span className="ml-2 text-xs px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800/50">v0.1.0</span>
      </header>
      <main className="flex-1 pt-10 flex">
        <div className="flex-1 flex items-center justify-center text-neutral-500">
          Loading NovelStudio...
        </div>
      </main>
    </div>
  );
}
