'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

const navItems = [
  { name: 'Control de Stock', href: '/stock', icon: '📦' },
  { name: 'Movimientos', href: '/stock/movements', icon: '🔄' },
  { name: 'Artículos', href: '/articles', icon: '🏷️' },
  { name: 'Depósitos', href: '/deposits', icon: '🏢' },
  { name: 'Reportes', href: '/reports', icon: '📊' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-[#1b2631] text-slate-300 flex flex-col justify-between h-full border-r border-[#2c3e50] shrink-0 shadow-xl">
      <div>
        {/* LOGO E IDENTIDAD DEL HOTEL */}
        <div className="p-6 border-b border-[#2c3e50] flex flex-col items-center text-center bg-[#151f28]">
          <div className="relative w-28 h-28 mb-2">
            <Image
              src="/logo-hotel.png"
              alt="Logo Hotel Alejandro I"
              fill
              className="object-contain"
              priority
            />
          </div>
          <span className="text-[10px] tracking-widest text-[#c59b27] uppercase font-semibold">
            Sistema de Gestión
          </span>
        </div>

        {/* NAVEGACIÓN */}
        <nav className="p-4 space-y-1.5">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-[#c59b27]/70 mb-3">
            Móduos del Sistema
          </p>
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-3 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-[#c59b27] text-[#1b2631] font-bold shadow-lg shadow-[#c59b27]/10'
                    : 'hover:bg-[#253342] text-slate-300 hover:text-white'
                }`}
              >
                <span className="text-base">{item.icon}</span>
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* PIE DEL SIDEBAR */}
      <div className="p-4 border-t border-[#2c3e50] bg-[#151f28] text-center">
        <p className="text-xs font-serif text-[#c59b27]">Hotel Alejandro I</p>
        <p className="text-[10px] text-slate-500 mt-0.5">Salta • Argentina</p>
      </div>
    </aside>
  );
}