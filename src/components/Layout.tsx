import { useState, useEffect } from 'react'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import {
  BarChart3,
  LineChart,
  Upload,
  History,
  Sliders,
  LogOut,
  Menu,
  X,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const NAV_ITEMS = [
  { label: 'Visão Geral', path: '/', icon: LineChart },
  { label: 'Importar Planilha', path: '/importar', icon: Upload },
  { label: 'Importações', path: '/importacoes', icon: History },
  { label: 'Mapeamentos', path: '/mapeamentos', icon: Sliders },
]

export default function Layout() {
  const { user, signOut, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)

  // Redireciona para /login se não autenticado
  useEffect(() => {
    if (!loading && !user) {
      navigate('/login', { replace: true })
    }
  }, [user, loading, navigate])

  // Fecha o drawer em navegação
  useEffect(() => {
    setMobileDrawerOpen(false)
  }, [location.pathname])

  if (loading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#F1F5F9] gap-3">
        <div className="w-12 h-12 rounded-2xl bg-teal-600 flex items-center justify-center text-white shadow-lg shadow-teal-600/30 animate-pulse">
          <BarChart3 className="w-7 h-7" />
        </div>
        <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
          <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
          <span>Carregando Suporte Analytics...</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const userEmail = user.email || ''
  const userName = user.user_metadata?.name || userEmail.split('@')[0] || 'Usuário'
  const userInitials =
    userName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part: string) => part[0]?.toUpperCase())
      .join('') || 'SA'

  const currentTitle =
    NAV_ITEMS.find((item) =>
      item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path),
    )?.label || 'Suporte Analytics'

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  const navContent = (
    <div className="flex flex-col h-full justify-between">
      <div>
        {/* Brand block */}
        <div className="p-6 border-b border-white/5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500 flex items-center justify-center shadow-md shadow-teal-500/20 text-white shrink-0">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div className="overflow-hidden">
            <span className="text-base font-bold text-white tracking-tight block truncate">
              Suporte Analytics
            </span>
            <span className="text-[11px] text-teal-300 block truncate font-medium">
              Gestão de Atendimentos
            </span>
          </div>
        </div>

        {/* Navigation items */}
        <nav className="p-3 space-y-1 mt-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive =
              item.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.path)

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all relative overflow-hidden',
                  isActive
                    ? 'text-white bg-white/[0.08] shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]',
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-teal-400 rounded-r-full" />
                )}
                <Icon
                  className={cn(
                    'w-5 h-5 transition-colors shrink-0',
                    isActive ? 'text-teal-400' : 'text-slate-400',
                  )}
                />
                <span className="truncate">{item.label}</span>
              </NavLink>
            )
          })}
        </nav>
      </div>

      {/* User block */}
      <div className="p-4 border-t border-white/5 bg-black/20 m-3 rounded-2xl">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white font-bold text-xs shadow-inner shrink-0">
            {userInitials}
          </div>
          <div className="overflow-hidden flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">{userName}</p>
            <p className="text-[11px] text-slate-400 truncate">{userEmail}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className="w-full h-8 justify-center gap-2 text-xs text-rose-300 hover:text-rose-100 hover:bg-rose-500/20 rounded-lg transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sair</span>
        </Button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F1F5F9] flex">
      {/* SIDEBAR DESKTOP (≥1024px) */}
      <aside className="hidden lg:flex w-[240px] flex-col fixed inset-y-0 left-0 bg-[#0F172A] z-30 shadow-xl border-r border-slate-800">
        {navContent}
      </aside>

      {/* ÁREA PRINCIPAL */}
      <div className="flex-1 flex flex-col lg:pl-[240px] min-w-0">
        {/* TOPBAR MOBILE/TABLET (<1024px) */}
        <header className="lg:hidden sticky top-0 z-20 bg-[#0F172A] text-white px-4 py-3 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 focus:outline-none"
              aria-label="Abrir menu de navegação"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-teal-500 flex items-center justify-center text-white shrink-0">
                <BarChart3 className="w-4 h-4" />
              </div>
              <h1 className="text-base font-bold text-white tracking-tight truncate">
                {currentTitle}
              </h1>
            </div>
          </div>
        </header>

        {/* MOBILE DRAWER */}
        {mobileDrawerOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
              onClick={() => setMobileDrawerOpen(false)}
            />
            {/* Drawer */}
            <div className="relative flex flex-col w-[260px] max-w-[80%] h-full bg-[#0F172A] shadow-2xl z-10">
              <button
                onClick={() => setMobileDrawerOpen(false)}
                className="absolute right-3 top-4 p-2 text-slate-400 hover:text-white rounded-lg focus:outline-none"
                aria-label="Fechar menu"
              >
                <X className="w-5 h-5" />
              </button>
              {navContent}
            </div>
          </div>
        )}

        {/* CONTEÚDO PRINCIPAL COM TRANSIÇÃO */}
        <main className="flex-1 w-full max-w-[1440px] mx-auto p-4 sm:p-6 lg:p-6">
          <div key={location.pathname} className="animate-fade-in-up">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
