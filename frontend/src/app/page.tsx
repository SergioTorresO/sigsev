const stats = [
  {
    label: 'Señales registradas',
    value: '1.520',
    detail: '+48 este mes',
  },
  {
    label: 'En buen estado',
    value: '1.064',
    detail: '70% del inventario',
  },
  {
    label: 'Requieren atención',
    value: '213',
    detail: 'Inspección prioritaria',
  },
  {
    label: 'Mantenimientos abiertos',
    value: '32',
    detail: '12 vencen esta semana',
  },
]

const statusSummary = [
  { label: 'Bueno', value: 70, color: 'bg-emerald-500' },
  { label: 'Regular', value: 16, color: 'bg-amber-500' },
  { label: 'Deteriorado', value: 9, color: 'bg-orange-500' },
  { label: 'Caído o desaparecido', value: 5, color: 'bg-rose-500' },
]

const inspections = [
  {
    code: 'SIG-URB-1048',
    location: 'Av. Santander con Calle 12',
    status: 'Deteriorado',
    technician: 'Laura Méndez',
    date: '26 mayo',
  },
  {
    code: 'SIG-RUR-0312',
    location: 'Vía principal, zona rural norte',
    status: 'Regular',
    technician: 'Carlos Rojas',
    date: '25 mayo',
  },
  {
    code: 'SIG-URB-0875',
    location: 'Parque Central',
    status: 'Bueno',
    technician: 'María Torres',
    date: '24 mayo',
  },
]

const navItems = [
  'Dashboard',
  'Mapa GIS',
  'Señales',
  'Inspecciones',
  'Mantenimientos',
  'Reportes',
]

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-950">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-zinc-200 bg-zinc-950 px-5 py-6 text-white lg:block">
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">
            Inventario vial
          </p>
          <h1 className="mt-2 text-2xl font-bold">SIGSEV</h1>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => (
            <a
              key={item}
              href="#"
              className={`block rounded-md px-3 py-2 text-sm font-medium ${
                item === 'Dashboard'
                  ? 'bg-white text-zinc-950'
                  : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
              }`}
            >
              {item}
            </a>
          ))}
        </nav>
      </aside>

      <main className="lg:pl-64">
        <header className="border-b border-zinc-200 bg-white">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-8">
            <div>
              <p className="text-sm font-medium text-emerald-700">
                Panel administrativo
              </p>
              <h2 className="mt-1 text-2xl font-bold text-zinc-950">
                Gestión de señalización vial
              </h2>
            </div>

            <div className="flex gap-3">
              <button className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-100">
                Exportar
              </button>
              <button className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                Nueva señal
              </button>
            </div>
          </div>
        </header>

        <section className="mx-auto max-w-7xl px-5 py-6 lg:px-8">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <article
                key={stat.label}
                className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
              >
                <p className="text-sm font-medium text-zinc-500">{stat.label}</p>
                <p className="mt-3 text-3xl font-bold text-zinc-950">
                  {stat.value}
                </p>
                <p className="mt-2 text-sm text-zinc-600">{stat.detail}</p>
              </article>
            ))}
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_380px]">
            <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-200 px-5 py-4">
                <h3 className="text-base font-semibold">Inspecciones recientes</h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Código</th>
                      <th className="px-5 py-3 font-semibold">Ubicación</th>
                      <th className="px-5 py-3 font-semibold">Estado</th>
                      <th className="px-5 py-3 font-semibold">Técnico</th>
                      <th className="px-5 py-3 font-semibold">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {inspections.map((inspection) => (
                      <tr key={inspection.code}>
                        <td className="px-5 py-4 font-semibold text-zinc-950">
                          {inspection.code}
                        </td>
                        <td className="px-5 py-4 text-zinc-700">
                          {inspection.location}
                        </td>
                        <td className="px-5 py-4">
                          <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700">
                            {inspection.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-zinc-700">
                          {inspection.technician}
                        </td>
                        <td className="px-5 py-4 text-zinc-500">
                          {inspection.date}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold">Estado del inventario</h3>
              <div className="mt-5 space-y-4">
                {statusSummary.map((item) => (
                  <div key={item.label}>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-medium text-zinc-700">{item.label}</span>
                      <span className="text-zinc-500">{item.value}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-zinc-100">
                      <div
                        className={`h-2 rounded-full ${item.color}`}
                        style={{ width: `${item.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-lg bg-zinc-950 p-4 text-white">
                <p className="text-sm font-semibold text-emerald-300">
                  Prioridad operativa
                </p>
                <p className="mt-2 text-sm text-zinc-200">
                  Revisar señales deterioradas en corredores escolares antes del
                  próximo corte de mantenimiento.
                </p>
              </div>
            </section>
          </div>
        </section>
      </main>
    </div>
  )
}
