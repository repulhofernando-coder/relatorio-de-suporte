import { ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/hooks/use-auth'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import Layout from './components/Layout'
import Index from './pages/Index'
import Login from './pages/Login'
import Importar from './pages/Importar'
import Importacoes from './pages/Importacoes'
import Mapeamentos from './pages/Mapeamentos'
import Chamados from './pages/Chamados'
import Horas from './pages/Horas'
import Contratos from './pages/Contratos'
import Equipes from './pages/Equipes'
import Usuarios from './pages/Usuarios'
import Relatorios from './pages/Relatorios'
import NotFound from './pages/NotFound'

function AdminRoute({ children }: { children: ReactNode }) {
  const { isAdmin, loading } = useAuth()
  if (loading) return null
  if (!isAdmin) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          {/* Rota pública standalone de Login */}
          <Route path="/login" element={<Login />} />

          {/* Rotas autenticadas sob o Layout global */}
          <Route element={<Layout />}>
            <Route path="/" element={<Index />} />
            <Route
              path="/importar"
              element={
                <AdminRoute>
                  <Importar />
                </AdminRoute>
              }
            />
            <Route path="/importacoes" element={<Importacoes />} />
            <Route path="/mapeamentos" element={<Mapeamentos />} />
            <Route path="/chamados" element={<Chamados />} />
            <Route path="/horas" element={<Horas />} />
            <Route path="/contratos" element={<Contratos />} />
            <Route path="/equipes" element={<Equipes />} />
            <Route
              path="/usuarios"
              element={
                <AdminRoute>
                  <Usuarios />
                </AdminRoute>
              }
            />
            <Route path="/relatorios" element={<Relatorios />} />
          </Route>

          {/* Fallback */}
          <Route path="/404" element={<NotFound />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </TooltipProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
