import Link from "next/link";

export default function CoverPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-between px-6 py-10">
      <div>
        <span className="inline-block rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700">
          DEMO · Menú Digital + Pedidos
        </span>
        <h1 className="mt-4 text-2xl font-bold text-gray-900">
          Así se ve una app hecha a medida para tu comercio
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-500">
          Esta es una demostración funcional: un menú digital que el cliente
          abre desde su celular escaneando un QR en la mesa, hace su pedido, y
          el local lo ve aparecer al instante en un panel propio — con carga
          de productos asistida por IA y estadísticas de ventas.
        </p>
      </div>

      <div className="mt-10 flex flex-col gap-4">
        <Link
          href="/menu"
          className="rounded-2xl bg-brand-600 px-5 py-4 text-center font-semibold text-white shadow-sm active:bg-brand-700"
        >
          🍽️ Ver la carta (vista cliente)
        </Link>
        <Link
          href="/admin"
          className="rounded-2xl border border-gray-200 bg-white px-5 py-4 text-center font-semibold text-gray-700 shadow-sm active:bg-gray-50"
        >
          🔑 Panel del local (vista dueño)
        </Link>
      </div>

      <div className="mt-10 rounded-2xl bg-white p-4 text-xs text-gray-400 shadow-sm">
        <p className="mb-1 font-semibold text-gray-500">Sobre esta demo</p>
        <p>
          El panel del local usa el PIN <span className="font-mono">1234</span>{" "}
          (configurable). Cualquier pedido que hagas desde la carta va a
          aparecer en tiempo real en Panel → Pedidos. Esta misma estructura
          (Next.js + Supabase + IA) se adapta a catálogos, turnos, stock y
          otros rubros.
        </p>
      </div>
    </main>
  );
}
