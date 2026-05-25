export default function Dashboard() {
  return (
    <div className="flex">
      <aside className="w-64 h-screen bg-slate-900 text-white p-5">
        <h1 className="text-2xl font-bold mb-10">SIGSEV</h1>

        <ul className="space-y-4">
          <li>Dashboard</li>
          <li>Mapa GIS</li>
          <li>Señales</li>
          <li>Inspecciones</li>
          <li>Reportes</li>
        </ul>
      </aside>

      <main className="flex-1 p-10">
        <h2 className="text-3xl font-bold mb-6">
          Panel Administrativo
        </h2>

        <div className="grid grid-cols-4 gap-5">
          <div className="bg-white rounded-xl p-5 shadow">
            <h3>Total Señales</h3>
            <p className="text-3xl font-bold">1520</p>
          </div>
        </div>
      </main>
    </div>
  )
}
