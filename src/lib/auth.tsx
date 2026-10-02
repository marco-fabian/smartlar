import type { Session } from "@supabase/supabase-js"
import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { supabase } from "./supabase"

type AuthState = { session: Session | null; carregando: boolean }

const AuthContext = createContext<AuthState>({ session: null, carregando: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, carregando: true })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setState({ session: data.session, carregando: false }))
    const { data } = supabase.auth.onAuthStateChange((_evento, session) =>
      setState({ session, carregando: false }),
    )
    return () => data.subscription.unsubscribe()
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
