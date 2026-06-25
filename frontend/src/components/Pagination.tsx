interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

/**
 * Paginador reutilizable (CLAUDE.md, item "Bajo" #77): reemplaza el bloque
 * "Página X de Y" + Anterior/Siguiente que estaba duplicado, casi textual,
 * en cada página con listado paginado (señales, zonas, inspecciones,
 * mantenimientos, usuarios, auditoría). No se renderiza nada si solo hay
 * una página, igual que el markup original que sustituye.
 */
export default function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between border-t border-zinc-100 px-5 py-3">
      <span className="text-xs text-zinc-500">
        Página {page} de {totalPages}
      </span>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium disabled:opacity-40 hover:bg-zinc-50"
        >
          Anterior
        </button>
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium disabled:opacity-40 hover:bg-zinc-50"
        >
          Siguiente
        </button>
      </div>
    </div>
  )
}
