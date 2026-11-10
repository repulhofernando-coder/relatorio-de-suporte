import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import logoMundoOpen from '@/assets/logomo-dd541.png'
import {
  FileSpreadsheet,
  Sliders,
  TrendingUp,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function Login() {
  const { user, signIn, loading } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Redireciona se já estiver autenticado
  useEffect(() => {
    if (!loading && user) {
      navigate('/', { replace: true })
    }
  }, [user, loading, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (!email.trim() || !password) {
      setErrorMsg('Por favor, preencha o e-mail e a senha.')
      return
    }

    if (password.length < 6) {
      setErrorMsg('A senha deve ter pelo menos 6 caracteres.')
      return
    }

    setSubmitting(true)
    try {
      const { error } = await signIn(email.trim(), password)
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setErrorMsg('E-mail ou senha incorretos.')
        } else {
          setErrorMsg(error.message || 'Erro ao realizar login.')
        }
      } else {
        navigate('/', { replace: true })
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Ocorreu um erro inesperado.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex bg-[#F1F5F9]">
      {/* PAINEL ESQUERDO (Desktop ≥1024px) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden bg-gradient-to-br from-[#0F172A] via-[#0F293D] to-[#0D9488] text-white">
        {/* Elemento de fundo decorativo */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

        {/* Marca com Logo Mundo Open */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="h-11 px-3 py-1.5 rounded-xl bg-white flex items-center justify-center shadow-lg shadow-slate-900/30">
            <img
              src={logoMundoOpen}
              alt="Mundo Open Tecnologia"
              className="h-8 w-auto object-contain"
            />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-white">Suporte Analytics</span>
            <span className="block text-xs text-teal-200">Mundo Open Tecnologia</span>
          </div>
        </div>

        {/* Conteúdo Central */}
        <div className="max-w-md my-auto relative z-10 py-12">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-teal-400/20 text-teal-200 border border-teal-400/30 mb-6">
            ✨ Análise Inteligente de Suporte
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight leading-tight text-white mb-4">
            Seus dados de suporte, claros em um só painel.
          </h1>
          <p className="text-slate-300 text-base leading-relaxed mb-8">
            Transforme planilhas mensais do dia a dia em relatórios visuais instantâneos. Descubra
            os clientes que mais demandam sua equipe e os técnicos com maior volume de atendimentos.
          </p>

          <div className="space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-lg bg-white/10 backdrop-blur-sm border border-white/10 flex items-center justify-center shrink-0 text-teal-300">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Importe planilhas do dia a dia</h3>
                <p className="text-xs text-slate-300">
                  Suporte nativo para arquivos .xlsx, .xls e .csv com múltiplas abas.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-lg bg-white/10 backdrop-blur-sm border border-white/10 flex items-center justify-center shrink-0 text-teal-300">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Mapeie as colunas uma única vez
                </h3>
                <p className="text-xs text-slate-300">
                  Detecção inteligente com sinônimos e layouts reutilizáveis para os próximos meses.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-lg bg-white/10 backdrop-blur-sm border border-white/10 flex items-center justify-center shrink-0 text-teal-300">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Acompanhe métricas e rankings</h3>
                <p className="text-xs text-slate-300">
                  KPIs animados, Top 8 clientes, ranking de técnicos e distribuição por mês e tipo.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé do painel */}
        <div className="relative z-10 text-xs text-slate-400">
          Suporte Analytics © {new Date().getFullYear()} — Plataforma Segura com Supabase
        </div>
      </div>

      {/* PAINEL DIREITO (Formulário) */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          {/* Marca no mobile */}
          <div className="lg:hidden flex flex-col items-center justify-center gap-2 mb-8 text-center">
            <div className="h-12 px-4 py-2 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
              <img
                src={logoMundoOpen}
                alt="Mundo Open Tecnologia"
                className="h-8 w-auto object-contain"
              />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-slate-900 block">
                Suporte Analytics
              </span>
              <span className="block text-xs text-slate-500">Mundo Open Tecnologia</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-8 sm:p-10 shadow-sm border border-slate-200/80">
            {/* Logo acima do formulário */}
            <div className="flex justify-center mb-6">
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl max-w-[220px]">
                <img
                  src={logoMundoOpen}
                  alt="Logo Mundo Open Tecnologia"
                  className="w-full h-auto max-h-12 object-contain"
                />
              </div>
            </div>

            <div className="mb-6 text-center">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">Acesse sua conta</h2>
              <p className="text-sm text-slate-500 mt-1">
                Informe seu e-mail corporativo e senha para acessar o painel
              </p>
            </div>

            {errorMsg && (
              <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
                <span className="leading-snug">{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold text-slate-700">
                  E-mail corporativo
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu.nome@mundoopen.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                  required
                  className="h-11 rounded-xl border-slate-200 focus:border-teal-500 focus:ring-teal-500"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-semibold text-slate-700">
                    Senha
                  </Label>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={submitting}
                    required
                    className="h-11 pr-11 rounded-xl border-slate-200 focus:border-teal-500 focus:ring-teal-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none p-1"
                    aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-11 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold transition-all shadow-sm shadow-teal-600/20"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Entrando...
                  </>
                ) : (
                  'Entrar no sistema'
                )}
              </Button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-100 text-center">
              <div className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                <ShieldCheck className="w-4 h-4 text-teal-600" />
                <span>Acesso corporativo restrito</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Novos acessos são criados internamente pelo administrador no menu <b>Usuários</b>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
