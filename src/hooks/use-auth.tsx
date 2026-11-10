import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'

export type UserRole = 'admin' | 'colaborador'

interface AuthContextType {
  user: User | null
  session: Session | null
  role: UserRole
  isAdmin: boolean
  isColaborador: boolean
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<{ error: Error | null }>
  refreshProfile: () => Promise<void>
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<UserRole>('admin')
  const [loading, setLoading] = useState(true)

  const fetchRole = async (userId: string, userMetaRole?: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle()

      if (!error && data?.role) {
        setRole(data.role as UserRole)
        return
      }

      if (userMetaRole === 'colaborador' || userMetaRole === 'admin') {
        setRole(userMetaRole as UserRole)
        return
      }

      // Default para usuários existentes: admin
      setRole('admin')
    } catch {
      setRole(userMetaRole === 'colaborador' ? 'colaborador' : 'admin')
    }
  }

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // FORBIDDEN: no async/await inside this callback — sync only
      setSession(session)
      const currentUser = session?.user ?? null
      setUser(currentUser)
      if (currentUser) {
        const metaRole = (currentUser.user_metadata?.role || currentUser.app_metadata?.role) as
          | string
          | undefined
        // Inicializa com metaRole ou admin imediatamente (síncrono)
        if (metaRole === 'colaborador' || metaRole === 'admin') {
          setRole(metaRole)
        }
        // Dispara busca assíncrona fora do callback
        setTimeout(() => {
          fetchRole(currentUser.id, metaRole)
        }, 0)
      } else {
        setRole('admin')
      }
      setLoading(false)
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      const currentUser = session?.user ?? null
      setUser(currentUser)
      if (currentUser) {
        const metaRole = (currentUser.user_metadata?.role || currentUser.app_metadata?.role) as
          | string
          | undefined
        if (metaRole === 'colaborador' || metaRole === 'admin') {
          setRole(metaRole)
        }
        fetchRole(currentUser.id, metaRole)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const refreshProfile = async () => {
    if (user?.id) {
      await fetchRole(user.id, user.user_metadata?.role)
    }
  }

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/` },
    })
    return { error }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    return { error }
  }

  const isAdmin = role === 'admin'
  const isColaborador = role === 'colaborador'

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        role,
        isAdmin,
        isColaborador,
        signUp,
        signIn,
        signOut,
        refreshProfile,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
