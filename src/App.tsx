import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/hooks/use-auth'
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
import Equipes from './pages/Equipes'
import Usuarios from './pages/Usuarios'
import Relatorios from './pages/Relatorios'
import NotFound from './pages/NotFound'

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
            <Route path="/importar" element={<Importar />} />
            <Route path="/importacoes" element={<Importacoes />} />
            <Route path="/mapeamentos" element={<Mapeamentos />} />
            <Route path="/chamados" element={<Chamados />} />
            <Route path="/equipes" element={<Equipes />} />
            <Route path="/usuarios" element={<Usuarios />} />
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
