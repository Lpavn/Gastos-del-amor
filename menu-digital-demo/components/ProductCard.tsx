"use client";

import { Product } from "@/lib/types";
import { formatMoney } from "@/lib/format";

export default function ProductCard({
  product,
  quantity,
  onAdd,
  onRemove,
}: {
  product: Product;
  quantity: number;
  onAdd: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex gap-3 rounded-2xl bg-white p-3 shadow-sm">
      {product.photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.photo_url}
          alt={product.name}
          className="h-20 w-20 shrink-0 rounded-xl object-cover"
        />
      ) : (
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-3xl">
          🍽️
        </div>
      )}

      <div className="flex flex-1 flex-col justify-between">
        <div>
          <p className="font-semibold leading-tight text-gray-900">
            {product.name}
          </p>
          {product.description && (
            <p className="mt-0.5 line-clamp-2 text-xs text-gray-400">
              {product.description}
            </p>
          )}
        </div>

        <div className="mt-1 flex items-center justify-between">
          <span className="font-semibold text-brand-700">
            {formatMoney(product.price)}
          </span>

          {quantity === 0 ? (
            <button
              onClick={onAdd}
              className="rounded-full bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white active:bg-brand-700"
            >
              Agregar
            </button>
          ) : (
            <div className="flex items-center gap-3 rounded-full bg-brand-50 px-2 py-1">
              <button
                onClick={onRemove}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-brand-700 shadow-sm"
              >
                −
              </button>
              <span className="w-4 text-center text-sm font-semibold text-brand-700">
                {quantity}
              </span>
              <button
                onClick={onAdd}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-brand-700 shadow-sm"
              >
                +
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
