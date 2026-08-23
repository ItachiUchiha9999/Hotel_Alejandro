'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { name: 'Depósitos', href: '/deposits' },
  { name: 'Artículos', href: '/articles' },
  { name: 'Stock por depósito', href: '/stock' },
  { name: 'Tipos de movimientos', href: '/stock/movement-types' },
  { name: 'Movimientos', href: '/stock/movements' },
  { name: 'Transferencias', href: '/stock/transfers' },
  { name: 'Reportes', href: '/reports' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-72 bg-[#26333B] text-slate-300 flex flex-col justify-between h-screen border-r border-slate-700/40 shrink-0 select-none font-serif">
      <div>
        <div className="p-8 border-b border-slate-700/40 text-center flex flex-col items-center">
          <svg className="w-10 h-10 mb-3 text-[#CBA45C]" viewBox="0 0 100 100" fill="none" stroke="currentColor">
            <polygon points="50,5 90,27.5 90,72.5 50,95 10,72.5 10,27.5" strokeWidth="3" fill="none" />
            <path d="M30,65 L30,45 L40,55 L50,35 L60,55 L70,45 L70,65 Z" fill="currentColor" strokeWidth="1" />
            <circle cx="30" cy="40" r="2.5" fill="currentColor" />
            <circle cx="50" cy="30" r="2.5" fill="currentColor" />
            <circle cx="70" cy="40" r="2.5" fill="currentColor" />
          </svg>

          <span className="text-[16px] tracking-[0.43em] text-[#CBA45C] uppercase block font-normal leading-none mb-1">
            HOTEL
          </span>
          <h1 className="text-[30px] font-normal leading-tight tracking-tight text-[#F4EFE4] my-0">
            ALEJANDRO I
          </h1>
          <span className="text-[12px] tracking-[0.3em] text-[#CBA45C] uppercase block mt-1 leading-none font-light">
            [ SALTA · ARGENTINA ]
          </span>
        </div>

        <nav className="p-4 space-y-1 font-sans">
          <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-[#CBA45C] mb-3 opacity-90">
            MÓDULO STK
          </p>
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-3 py-2.5 rounded text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-[#CBA45C] text-slate-950 font-semibold shadow-sm'
                    : 'hover:bg-slate-800/50 text-slate-300 hover:text-white'
                }`}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}