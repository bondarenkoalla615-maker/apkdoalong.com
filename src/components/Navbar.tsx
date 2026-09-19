import { Search, Menu, UserCircle, Upload, LayoutGrid, Package, CheckCircle2, Sparkles } from 'lucide-react';
import { User, ViewState } from '../types';

interface NavbarProps {
  user: User | null;
  currentView: ViewState;
  onNavigate: (view: ViewState) => void;
  onLoginClick: () => void;
  onLogout: () => void;
}

export function Navbar({ user, currentView, onNavigate, onLoginClick, onLogout }: NavbarProps) {
  return (
    <header className="sticky top-0 z-50 bg-white/5 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <div 
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => onNavigate('store')}
            >
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]">
                A
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                APKDoalong
              </span>
            </div>

            <nav className="hidden md:flex items-center gap-6">
              <button 
                onClick={() => onNavigate('store')}
                className={`flex items-center gap-2 text-sm font-medium transition-colors ${currentView === 'store' ? 'text-white' : 'text-gray-400 hover:text-white'}`}
              >
                <LayoutGrid className="w-4 h-4" />
                Додатки & Категорії
              </button>
              <button 
                onClick={() => onNavigate('publish')}
                className={`flex items-center gap-2 text-sm font-medium transition-colors ${currentView === 'publish' ? 'text-blue-400' : 'text-gray-400 hover:text-white'}`}
              >
                <Upload className="w-4 h-4" />
                Опублікувати
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative hidden sm:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input 
                type="text" 
                placeholder="Пошук додатків..." 
                className="bg-black/20 border border-white/10 rounded-full py-1.5 pl-9 pr-4 text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 text-white/90 w-64 transition-all"
              />
            </div>

            {user ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full border border-white/10">
                  <img src={user.avatar} alt={user.name} className="w-6 h-6 rounded-full" />
                  <span className="text-sm font-medium text-gray-300">{user.name}</span>
                  {user.plan === 'unlimited_verified' && (
                    <span className="text-[11px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 font-semibold ml-1">
                      <CheckCircle2 className="w-3 h-3 text-blue-400" /> PRO Галочка
                    </span>
                  )}
                  {user.plan === 'unlimited' && (
                    <span className="text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 font-semibold ml-1">
                      <Sparkles className="w-3 h-3 text-emerald-400" /> Безліміт
                    </span>
                  )}
                </div>
                <button onClick={onLogout} className="text-xs text-gray-500 hover:text-gray-300">
                  Вийти
                </button>
              </div>
            ) : (
              <button 
                onClick={onLoginClick}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-lg text-sm font-semibold shadow-xl transition-colors"
              >
                <UserCircle className="w-4 h-4" />
                Увійти
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
