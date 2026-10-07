import type { InputHTMLAttributes } from "react";

// <input type="date"> muestra el formato del idioma del navegador (mm/dd/yyyy
// en un Chrome en inglés) y no se puede forzar. Mantenemos el input nativo
// (con su calendario) pero con el texto transparente, y encima mostramos la
// fecha en dd/mm/yyyy.
export default function DateInput({
  value,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { value: string }) {
  const [y, m, d] = value.split("-");
  return (
    <div className="relative flex-1">
      <input type="date" value={value} {...props} className={`${className} w-full text-transparent`} />
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm">
        {value ? `${d}/${m}/${y}` : "dd/mm/aaaa"}
      </span>
    </div>
  );
}
