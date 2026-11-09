import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  UserCog,
  UserPlus,
  Mail,
  Lock,
  User,
  ShieldCheck,
  Calendar,
  Clock,
  Loader2,
  RefreshCw,
  KeyRound,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'

interface SystemUser {
  id: string
  email: string
  created_at: string
  last_sign_in_at: string | null
  nome?: string | null
}

export default function Usuarios() {
  const { user: currentUser } = useAuth()
  const { toast } = useToast()

  const [users, setUsers] = useState<SystemUser[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [formOpen, setFormOpen] = useState(false)

  // Formulário
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const loadUsers = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('list_system_users')
      if (error) {
        console.error('Erro ao listar usuários:', error)
        toast({
          title: 'Erro ao carregar usuários',
          description: error.message,
          variant: 'destructive',
        })
      } else if (data) {
        setUsers(data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    const cleanEmail = email.trim().toLowerCase()
    const cleanNome = nome.trim()

    // Validações
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setErrorMessage('Informe um e-mail válido (ex.: usuario@empresa.com).')
      return
    }

    if (password.length < 6) {
      setErrorMessage('A senha deve ter no mínimo 6 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setErrorMessage('A confirmação de senha não confere com a senha digitada.')
      return
    }

    setSubmitting(true)
    try {
      const { data, error } = await supabase.rpc('admin_create_user', {
        p_email: cleanEmail,
        p_password: password,
        p_nome: cleanNome || null,
      })

      if (error) {
        const msg = error.message || ''
        if (
          msg.includes('já está em uso') ||
          msg.includes('already exists') ||
          msg.includes('unique')
        ) {
          setErrorMessage('Este e-mail já está cadastrado no sistema. Escolha outro.')
        } else {
          setErrorMessage(`Não foi possível criar o usuário: ${msg}`)
        }
        return
      }

      toast({
        title: 'Usuário criado com sucesso!',
        description: `O acesso para ${cleanEmail} foi criado e já pode fazer login.`,
      })

      // Limpa formulário
      setNome('')
      setEmail('')
      setPassword('')
      setConfirmPassword('')
      setFormOpen(false)

      await loadUsers()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrorMessage(`Erro inesperado: ${msg}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <UserCog className="w-7 h-7 text-teal-600" />
            <span>Gestão de Usuários</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Crie e gerencie os acessos de e-mail e senha para o sistema Suporte Analytics
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadUsers}
            disabled={loading}
            className="h-9 rounded-xl bg-white border-slate-200 text-slate-700 hover:bg-slate-50 gap-2 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-teal-600' : ''}`} />
            <span>Atualizar</span>
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setFormOpen(!formOpen)
              setErrorMessage(null)
            }}
            className="h-9 rounded-xl bg-teal-600 hover:bg-teal-700 text-white gap-2 shadow-sm shadow-teal-600/20"
          >
            <UserPlus className="w-4 h-4" />
            <span>{formOpen ? 'Fechar formulário' : 'Novo Usuário'}</span>
          </Button>
        </div>
      </div>

      {/* FORMULÁRIO DE NOVO USUÁRIO */}
      {formOpen && (
        <Card className="rounded-2xl border-teal-200/80 shadow-md bg-gradient-to-br from-white to-teal-50/30 overflow-hidden">
          <CardHeader className="border-b border-teal-100/60 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-slate-900">
                    Cadastrar Novo Usuário
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    O usuário poderá fazer login imediatamente na tela /login com a senha definida
                    abaixo
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-5">
            <form onSubmit={handleCreateUser} className="space-y-4">
              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1 font-medium">{errorMessage}</div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="nome"
                    className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                  >
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>Nome completo (opcional)</span>
                  </Label>
                  <Input
                    id="nome"
                    type="text"
                    placeholder="Ex.: Maria Souza"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="h-10 rounded-xl border-slate-200 focus:border-teal-500 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="email"
                    className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                  >
                    <Mail className="w-3.5 h-3.5 text-teal-600" />
                    <span>E-mail de acesso *</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    placeholder="usuario@empresa.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-10 rounded-xl border-slate-200 focus:border-teal-500 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="senha"
                    className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                  >
                    <Lock className="w-3.5 h-3.5 text-teal-600" />
                    <span>Senha inicial (mínimo 6 caracteres) *</span>
                  </Label>
                  <Input
                    id="senha"
                    type="password"
                    required
                    minLength={6}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-10 rounded-xl border-slate-200 focus:border-teal-500 text-sm font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="confirma-senha"
                    className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-teal-600" />
                    <span>Confirmar senha *</span>
                  </Label>
                  <Input
                    id="confirma-senha"
                    type="password"
                    required
                    minLength={6}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="h-10 rounded-xl border-slate-200 focus:border-teal-500 text-sm font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setFormOpen(false)}
                  disabled={submitting}
                  className="rounded-xl text-slate-600"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={submitting}
                  className="rounded-xl bg-teal-600 hover:bg-teal-700 text-white gap-2 px-5"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Criando acesso...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Criar Usuário</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* LISTA DE USUÁRIOS */}
      <Card className="rounded-2xl border-slate-200/80 shadow-sm bg-white overflow-hidden">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                Usuários com Acesso ({users.length})
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Contas habilitadas a entrar no Suporte Analytics
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs text-slate-600 font-mono">
              Supabase Auth
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
              <span className="text-xs">Carregando lista de usuários...</span>
            </div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">Nenhum usuário encontrado.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {users.map((u) => {
                const isMe = currentUser?.id === u.id
                const dataCriacao = u.created_at
                  ? new Date(u.created_at).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })
                  : '—'
                const ultimoAcesso = u.last_sign_in_at
                  ? new Date(u.last_sign_in_at).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Nunca acessou'

                return (
                  <div
                    key={u.id}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm shrink-0">
                        {(u.nome?.[0] || u.email[0]).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">
                            {u.nome || u.email.split('@')[0]}
                          </span>
                          {isMe && (
                            <Badge className="bg-teal-50 text-teal-700 border-teal-200 text-[10px] font-semibold">
                              Você
                            </Badge>
                          )}
                          <Badge
                            variant="outline"
                            className="text-[10px] text-emerald-700 bg-emerald-50 border-emerald-200"
                          >
                            Ativo
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-mono">{u.email}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 text-xs text-slate-500 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                      <div
                        className="flex items-center gap-1.5"
                        title="Data em que o usuário foi criado"
                      >
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>Criado em {dataCriacao}</span>
                      </div>
                      <div className="flex items-center gap-1.5" title="Último login registrado">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{ultimoAcesso}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
