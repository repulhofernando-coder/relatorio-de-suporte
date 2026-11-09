import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import {
  BarChart3,
  FileSpreadsheet,
  Sliders,
  TrendingUp,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function Login() {
  const { user, signIn, signUp, loading } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Redireciona se já estiver autenticado
  useEffect(() => {
    if (!loading && user) {
      navigate('/', { replace: true })
    }
  }, [user, loading, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)

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
      if (mode === 'login') {
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
      } else {
        const { error } = await signUp(email.trim(), password)
        if (error) {
          setErrorMsg(error.message || 'Erro ao criar conta.')
        } else {
          setSuccessMsg('Conta criada com sucesso! Você já pode entrar.')
          setMode('login')
        }
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

        {/* Marca */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-teal-500 flex items-center justify-center shadow-lg shadow-teal-500/20 text-white font-bold">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-white">Suporte Analytics</span>
            <span className="block text-xs text-teal-200">Painel de Gestão de Atendimentos</span>
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
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-md">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-slate-900">
                Suporte Analytics
              </span>
              <span className="block text-xs text-slate-500">Gestão de Atendimentos</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-8 sm:p-10 shadow-sm border border-slate-200/80">
            <div className="mb-6">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                {mode === 'login' ? 'Acesse sua conta' : 'Crie sua conta'}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                {mode === 'login'
                  ? 'Informe seu e-mail e senha para acessar o painel'
                  : 'Cadastre-se para importar planilhas e visualizar relatórios'}
              </p>
            </div>

            {errorMsg && (
              <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
                <span className="leading-snug">{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
                <span className="leading-snug">{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold text-slate-700">
                  E-mail
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu.email@empresa.com.br"
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
                    {mode === 'login' ? 'Entrando...' : 'Cadastrando...'}
                  </>
                ) : mode === 'login' ? (
                  'Entrar'
                ) : (
                  'Criar conta'
                )}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-slate-100 text-center">
              {mode === 'login' ? (
                <p className="text-sm text-slate-600">
                  Ainda não tem uma conta?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signup')
                      setErrorMsg(null)
                      setSuccessMsg(null)
                    }}
                    className="font-semibold text-teal-600 hover:text-teal-700 hover:underline"
                  >
                    Cadastre-se gratuitamente
                  </button>
                </p>
              ) : (
                <p className="text-sm text-slate-600">
                  Já tem uma conta?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login')
                      setErrorMsg(null)
                      setSuccessMsg(null)
                    }}
                    className="font-semibold text-teal-600 hover:text-teal-700 hover:underline"
                  >
                    Fazer login
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
