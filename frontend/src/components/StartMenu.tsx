import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutGrid, Globe, Landmark, DollarSign, Sprout, ChevronRight, Users, Trophy, Menu } from 'lucide-react';
import { useMCPContext } from '../contexts/MCPContext';

interface StartMenuProps {
  onNavigate?: () => void;
}

const navLinks = [
  { to: '/', icon: LayoutGrid, label: 'Inicio', end: true },
  { to: '/general', icon: Globe, label: 'Vista General' },
  { to: '/entidades', icon: Landmark, label: 'Bancos' },
  { to: '/dolar', icon: DollarSign, label: 'Cotización Dólar' },
  { to: '/agro', icon: Sprout, label: 'Agro' },
  { to: '/bigmac', icon: Menu, label: 'Índice Big Mac' },
  { to: '/wall-of-fame', icon: Trophy, label: 'Wall of Fame' },
];

export const StartMenu: React.FC<StartMenuProps> = ({ onNavigate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { recentlyViewed } = useMCPContext();
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    closeTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 300);
  };

  const navigate = useNavigate();

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, to: string) => {
    e.preventDefault();
    setIsOpen(false);
    onNavigate?.();
    navigate(to, { state: { t: Date.now() } });
  };

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={menuRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Start Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-1.5 px-3 py-1 border-2 border-black font-black text-sm
          ${isOpen 
            ? 'shadow-button-pressed bg-gray-300' 
            : 'shadow-button bg-retro-bg hover:bg-gray-200 active:shadow-button-pressed'
          }
          transition-colors outline-none
        `}
      >
        <span>Inicio</span>
      </button>

      {/* Menu Popup */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 z-[100] start-menu-animate">
          <div className="bg-retro-bg border-2 border-black shadow-window min-w-[280px] flex">

            {/* Menu Content */}
            <div className="flex-1 flex flex-col">
              {/* Navigation Links */}
              <div className="py-1">
                {navLinks.map(link => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.end}
                    onClick={(e) => handleLinkClick(e, link.to)}
                    className={({ isActive }) => `
                      flex items-center gap-3 px-3 py-2 text-sm font-bold
                      ${isActive
                        ? 'bg-retro-blue text-white'
                        : 'hover:bg-retro-blue hover:text-white'
                      }
                      transition-colors
                    `}
                  >
                    <link.icon className="w-5 h-5 shrink-0" />
                    <span>{link.label}</span>
                  </NavLink>
                ))}
              </div>

              {/* Separator */}
              <div className="mx-2 border-t-2 border-gray-500 border-b border-white" />

              {/* Recently Viewed */}
              <div className="py-1">
                <div className="px-3 py-1">
                  <span className="text-[9px] uppercase font-bold opacity-50 tracking-wider">
                    Visto Recientemente
                  </span>
                </div>
                {recentlyViewed.length > 0 ? (
                  recentlyViewed.slice(0, 5).map(e => (
                    <NavLink
                      key={e.id}
                      to={`/entidades/${e.id}`}
                      onClick={(evt) => handleLinkClick(evt, `/entidades/${e.id}`)}
                      className={({ isActive }) => `
                        flex items-center gap-2 px-3 py-1.5 text-xs
                        ${isActive
                          ? 'bg-retro-blue text-white'
                          : 'hover:bg-retro-blue hover:text-white'
                        }
                        transition-colors
                      `}
                    >
                      <ChevronRight className="w-3 h-3 shrink-0 opacity-50" />
                      <span className="truncate">{e.name}</span>
                    </NavLink>
                  ))
                ) : (
                  <div className="px-3 py-2 text-[10px] italic opacity-40">
                    Ninguna entidad visitada
                  </div>
                )}
              </div>

              {/* Separator */}
              <div className="mx-2 border-t-2 border-gray-500 border-b border-white" />

              {/* Bottom actions */}
              <div className="py-1">
                <a
                  href="https://github.com/frani/argentino"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-3 py-2 text-sm font-bold hover:bg-retro-blue hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  <span>GitHub</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
