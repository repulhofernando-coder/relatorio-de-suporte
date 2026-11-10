import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useAuth, UserRole } from '@/hooks/use-auth'
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
  Shield,
  UserCheck,
  Calendar,
  Clock,
  Loader2,
  RefreshCw,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  ArrowUpDown,
} from 'lucide-react'

interface SystemUser {
  id: string
  email: string
  created_at: string
  last_sign_in_at: string | null
  name?: string | null
  nome?: string | null
  role?: string | null
}

export default function Usuarios() {
  const { user: currentUser, isAdmin, refreshProfile } = useAuth()
  const { toast } = useToast()

  const [users, setUsers] = useState<SystemUser[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)

  // Formulário
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [role, setRole] = useState<UserRole>('colaborador')
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.rpc as any)('admin_create_user', {
        p_email: cleanEmail,
        p_password: password,
        p_nome: cleanNome || null,
        p_role: role,
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
        description: `O acesso para ${cleanEmail} (${role === 'admin' ? 'Administrador' : 'Colaborador'}) foi criado.`,
      })

      // Limpa formulário
      setNome('')
      setEmail('')
      setPassword('')
      setConfirmPassword('')
      setRole('colaborador')
      setFormOpen(false)

      await loadUsers()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrorMessage(`Erro inesperado: ${msg}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleRole = async (targetUser: SystemUser) => {
    const currentRole = targetUser.role === 'admin' ? 'admin' : 'colaborador'
    const newRole: UserRole = currentRole === 'admin' ? 'colaborador' : 'admin'
    const roleLabel = newRole === 'admin' ? 'Administrador' : 'Colaborador'

    if (
      !confirm(
        `Deseja alterar o perfil de ${targetUser.name || targetUser.email} para "${roleLabel}"?`,
      )
    ) {
      return
    }

    setChangingRoleId(targetUser.id)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.rpc as any)('admin_update_user_role', {
        p_target_user_id: targetUser.id,
        p_new_role: newRole,
      })

      if (error) {
        toast({
          title: 'Erro ao alterar perfil',
          description: error.message || 'Não foi possível alterar o perfil do usuário.',
          variant: 'destructive',
        })
        return
      }

      toast({
        title: 'Perfil atualizado!',
        description: `${targetUser.email} agora tem perfil de ${roleLabel}.`,
      })

      if (targetUser.id === currentUser?.id) {
        await refreshProfile()
      }

      await loadUsers()
    } catch (err: any) {
      toast({
        title: 'Erro inesperado',
        description: err.message || 'Falha ao atualizar perfil.',
        variant: 'destructive',
      })
    } finally {
      setChangingRoleId(null)
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

              {/* SELEÇÃO DO PERFIL */}
              <div className="space-y-2 pt-1">
                <Label className="text-xs font-semibold text-slate-700 block">
                  Perfil de acesso *
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRole('colaborador')}
                    className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                      role === 'colaborador'
                        ? 'border-teal-500 bg-teal-50/50 ring-2 ring-teal-500/20'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        role === 'colaborador'
                          ? 'bg-teal-600 text-white'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <UserCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">
                        Colaborador (Visualizador)
                      </span>
                      <span className="text-[11px] text-slate-500 block leading-relaxed mt-0.5">
                        Acessa painéis, chamados e relatórios. Não pode importar planilhas nem
                        alterar dados.
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole('admin')}
                    className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                      role === 'admin'
                        ? 'border-teal-500 bg-teal-50/50 ring-2 ring-teal-500/20'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        role === 'admin' ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <Shield className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">
                        Administrador (Acesso total)
                      </span>
                      <span className="text-[11px] text-slate-500 block leading-relaxed mt-0.5">
                        Pode tudo: importar planilhas, gerenciar mapeamentos, metas de equipes e
                        usuários.
                      </span>
                    </div>
                  </button>
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
                const userRole = u.role === 'admin' ? 'admin' : 'colaborador'
                const isUserAdmin = userRole === 'admin'
                const displayName = u.name || u.nome || u.email.split('@')[0]
                const isChanging = changingRoleId === u.id

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
                    className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                          isUserAdmin ? 'bg-teal-100 text-teal-800' : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {(displayName[0] || u.email[0]).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-slate-900 truncate">
                            {displayName}
                          </span>
                          {isMe && (
                            <Badge className="bg-teal-50 text-teal-700 border-teal-200 text-[10px] font-semibold">
                              Você
                            </Badge>
                          )}
                          {isUserAdmin ? (
                            <Badge className="bg-teal-600 text-white text-[10px] font-semibold flex items-center gap-1 shadow-xs">
                              <Shield className="w-3 h-3" />
                              <span>Administrador</span>
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[10px] text-slate-600 bg-slate-100 border-slate-200 font-medium flex items-center gap-1"
                            >
                              <UserCheck className="w-3 h-3 text-slate-500" />
                              <span>Colaborador</span>
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5 truncate">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-mono truncate">{u.email}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-slate-500 border-t lg:border-t-0 pt-2 lg:pt-0 border-slate-100">
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

                      {/* AÇÃO DE PROMOVER / DEMOVER */}
                      {isAdmin && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isChanging}
                          onClick={() => handleToggleRole(u)}
                          className="h-8 text-xs rounded-xl bg-white border-slate-200 hover:bg-slate-50 gap-1.5 shadow-2xs font-medium ml-auto lg:ml-2"
                          title={
                            isUserAdmin
                              ? 'Alterar para Colaborador (somente leitura)'
                              : 'Promover para Administrador'
                          }
                        >
                          {isChanging ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                          )}
                          <span>
                            {isUserAdmin ? 'Mudar para Colaborador' : 'Tornar Administrador'}
                          </span>
                        </Button>
                      )}
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
