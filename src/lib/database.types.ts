export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      clientes: {
        Row: {
          created_at: string
          email: string | null
          endereco: string
          id: string
          nome: string
          notificar_whatsapp: boolean
          observacoes: string | null
          telefone: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          endereco: string
          id?: string
          nome: string
          notificar_whatsapp?: boolean
          observacoes?: string | null
          telefone: string
        }
        Update: {
          created_at?: string
          email?: string | null
          endereco?: string
          id?: string
          nome?: string
          notificar_whatsapp?: boolean
          observacoes?: string | null
          telefone?: string
        }
        Relationships: []
      }
      eventos_n8n: {
        Row: {
          criado_em: string
          enviado_em: string | null
          id: number
          payload: Json
          proxima_tentativa: string
          request_id: number | null
          tentativas: number
          ultimo_erro: string | null
          webhook: string
        }
        Insert: {
          criado_em?: string
          enviado_em?: string | null
          id?: never
          payload: Json
          proxima_tentativa?: string
          request_id?: number | null
          tentativas?: number
          ultimo_erro?: string | null
          webhook: string
        }
        Update: {
          criado_em?: string
          enviado_em?: string | null
          id?: never
          payload?: Json
          proxima_tentativa?: string
          request_id?: number | null
          tentativas?: number
          ultimo_erro?: string | null
          webhook?: string
        }
        Relationships: []
      }
      historico_status: {
        Row: {
          alterado_em: string
          alterado_por: string | null
          id: number
          pedido_id: string
          status_anterior: Database["public"]["Enums"]["pedido_status"] | null
          status_novo: Database["public"]["Enums"]["pedido_status"]
        }
        Insert: {
          alterado_em?: string
          alterado_por?: string | null
          id?: never
          pedido_id: string
          status_anterior?: Database["public"]["Enums"]["pedido_status"] | null
          status_novo: Database["public"]["Enums"]["pedido_status"]
        }
        Update: {
          alterado_em?: string
          alterado_por?: string | null
          id?: never
          pedido_id?: string
          status_anterior?: Database["public"]["Enums"]["pedido_status"] | null
          status_novo?: Database["public"]["Enums"]["pedido_status"]
        }
        Relationships: [
          {
            foreignKeyName: "historico_status_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_status_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "vw_pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      itens_pedido: {
        Row: {
          created_at: string
          id: string
          pedido_id: string
          preco_unitario: number
          produto_id: string
          quantidade: number
          subtotal: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          pedido_id: string
          preco_unitario: number
          produto_id: string
          quantidade: number
          subtotal?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          pedido_id?: string
          preco_unitario?: number
          produto_id?: string
          quantidade?: number
          subtotal?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "itens_pedido_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_pedido_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "vw_pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_pedido_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          cliente_id: string
          concluido_em: string | null
          created_at: string
          data_instalacao: string | null
          duracao_minutos: number
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          id: string
          numero: number
          observacoes: string | null
          status: Database["public"]["Enums"]["pedido_status"]
          tecnico_id: string | null
          updated_at: string
          valor_total: number
        }
        Insert: {
          cliente_id: string
          concluido_em?: string | null
          created_at?: string
          data_instalacao?: string | null
          duracao_minutos?: number
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          numero?: never
          observacoes?: string | null
          status?: Database["public"]["Enums"]["pedido_status"]
          tecnico_id?: string | null
          updated_at?: string
          valor_total?: number
        }
        Update: {
          cliente_id?: string
          concluido_em?: string | null
          created_at?: string
          data_instalacao?: string | null
          duracao_minutos?: number
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          numero?: never
          observacoes?: string | null
          status?: Database["public"]["Enums"]["pedido_status"]
          tecnico_id?: string | null
          updated_at?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_tecnico_id_fkey"
            columns: ["tecnico_id"]
            isOneToOne: false
            referencedRelation: "tecnicos"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          ativo: boolean
          categoria: string
          created_at: string
          descricao: string | null
          id: string
          nome: string
          preco_unitario: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          preco_unitario: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          preco_unitario?: number
          updated_at?: string
        }
        Relationships: []
      }
      status_transicoes: {
        Row: {
          de: Database["public"]["Enums"]["pedido_status"]
          para: Database["public"]["Enums"]["pedido_status"]
        }
        Insert: {
          de: Database["public"]["Enums"]["pedido_status"]
          para: Database["public"]["Enums"]["pedido_status"]
        }
        Update: {
          de?: Database["public"]["Enums"]["pedido_status"]
          para?: Database["public"]["Enums"]["pedido_status"]
        }
        Relationships: []
      }
      tecnicos: {
        Row: {
          ativo: boolean
          created_at: string
          especialidade: string
          id: string
          nome: string
          telefone: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          especialidade: string
          id?: string
          nome: string
          telefone: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          especialidade?: string
          id?: string
          nome?: string
          telefone?: string
        }
        Relationships: []
      }
    }
    Views: {
      vw_pedidos: {
        Row: {
          cliente_email: string | null
          cliente_endereco: string | null
          cliente_id: string | null
          cliente_nome: string | null
          cliente_notificar_whatsapp: boolean | null
          cliente_telefone: string | null
          concluido_em: string | null
          created_at: string | null
          data_instalacao: string | null
          duracao_minutos: number | null
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          id: string | null
          itens: Json | null
          itens_resumo: string | null
          numero: number | null
          observacoes: string | null
          status: Database["public"]["Enums"]["pedido_status"] | null
          tecnico_id: string | null
          tecnico_nome: string | null
          tecnico_telefone: string | null
          updated_at: string | null
          valor_total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_tecnico_id_fkey"
            columns: ["tecnico_id"]
            isOneToOne: false
            referencedRelation: "tecnicos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      criar_pedido: {
        Args: { p_cliente_id: string; p_itens: Json; p_observacoes?: string }
        Returns: {
          cliente_id: string
          concluido_em: string | null
          created_at: string
          data_instalacao: string | null
          duracao_minutos: number
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          id: string
          numero: number
          observacoes: string | null
          status: Database["public"]["Enums"]["pedido_status"]
          tecnico_id: string | null
          updated_at: string
          valor_total: number
        }
        SetofOptions: {
          from: "*"
          to: "pedidos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      dashboard_indicadores: { Args: never; Returns: Json }
      enviar_evento_n8n: { Args: { p_evento_id: number }; Returns: undefined }
      reprocessar_eventos_n8n: { Args: never; Returns: number }
    }
    Enums: {
      forma_pagamento:
        | "pix"
        | "cartao_credito"
        | "cartao_debito"
        | "boleto"
        | "dinheiro"
      pedido_status:
        | "orcamento"
        | "aprovado"
        | "agendado"
        | "em_andamento"
        | "concluido"
        | "cancelado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      forma_pagamento: [
        "pix",
        "cartao_credito",
        "cartao_debito",
        "boleto",
        "dinheiro",
      ],
      pedido_status: [
        "orcamento",
        "aprovado",
        "agendado",
        "em_andamento",
        "concluido",
        "cancelado",
      ],
    },
  },
} as const

