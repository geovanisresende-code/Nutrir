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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          organization_id: string
          role: string
          thread_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          organization_id: string
          role: string
          thread_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          organization_id?: string
          role?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "ai_chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chat_threads: {
        Row: {
          created_at: string
          created_by: string
          id: string
          organization_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          organization_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          organization_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_image_diagnoses: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string | null
          crop: string | null
          diagnosis: string | null
          field_id: string | null
          id: string
          image_path: string
          organization_id: string
          raw: Json | null
          severity: string | null
          treatment: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          crop?: string | null
          diagnosis?: string | null
          field_id?: string | null
          id?: string
          image_path: string
          organization_id: string
          raw?: Json | null
          severity?: string | null
          treatment?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          crop?: string | null
          diagnosis?: string | null
          field_id?: string | null
          id?: string
          image_path?: string
          organization_id?: string
          raw?: Json | null
          severity?: string | null
          treatment?: string | null
        }
        Relationships: []
      }
      ai_recommendations: {
        Row: {
          created_at: string
          created_by: string | null
          field_id: string | null
          id: string
          metadata: Json | null
          model: string
          organization_id: string
          prompt: string
          response: string
          sample_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          field_id?: string | null
          id?: string
          metadata?: Json | null
          model?: string
          organization_id: string
          prompt: string
          response: string
          sample_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          field_id?: string | null
          id?: string
          metadata?: Json | null
          model?: string
          organization_id?: string
          prompt?: string
          response?: string
          sample_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_recommendations_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_recommendations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_recommendations_sample_id_fkey"
            columns: ["sample_id"]
            isOneToOne: false
            referencedRelation: "soil_samples"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          client_id: string | null
          created_at: string
          description: string | null
          entity_id: string | null
          entity_type: string
          field_id: string | null
          id: string
          metadata: Json | null
          organization_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          client_id?: string | null
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type: string
          field_id?: string | null
          id?: string
          metadata?: Json | null
          organization_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          client_id?: string | null
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string
          field_id?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          created_at: string
          created_by: string | null
          document: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          document?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          document?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      collection_points: {
        Row: {
          accuracy_m: number | null
          altitude_m: number | null
          client_id: string | null
          created_at: string
          created_by: string | null
          field_id: string | null
          id: string
          kind: string
          latitude: number
          longitude: number
          notes: string | null
          organization_id: string
          route_id: string | null
        }
        Insert: {
          accuracy_m?: number | null
          altitude_m?: number | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          field_id?: string | null
          id?: string
          kind?: string
          latitude: number
          longitude: number
          notes?: string | null
          organization_id: string
          route_id?: string | null
        }
        Update: {
          accuracy_m?: number | null
          altitude_m?: number | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          field_id?: string | null
          id?: string
          kind?: string
          latitude?: number
          longitude?: number
          notes?: string | null
          organization_id?: string
          route_id?: string | null
        }
        Relationships: []
      }
      collection_routes: {
        Row: {
          area_geometry: Json | null
          client_id: string | null
          created_at: string
          created_by: string | null
          field_id: string | null
          finished_at: string | null
          hectares: number | null
          id: string
          name: string
          organization_id: string
          path: Json | null
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          area_geometry?: Json | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          field_id?: string | null
          finished_at?: string | null
          hectares?: number | null
          id?: string
          name: string
          organization_id: string
          path?: Json | null
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          area_geometry?: Json | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          field_id?: string | null
          finished_at?: string | null
          hectares?: number | null
          id?: string
          name?: string
          organization_id?: string
          path?: Json | null
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      commodity_quotes: {
        Row: {
          commodity: string
          fetched_at: string
          id: string
          price_brl: number
          raw: Json | null
          reference_date: string | null
          source: string
          unit: string
          variation_pct: number | null
        }
        Insert: {
          commodity: string
          fetched_at?: string
          id?: string
          price_brl: number
          raw?: Json | null
          reference_date?: string | null
          source?: string
          unit?: string
          variation_pct?: number | null
        }
        Update: {
          commodity?: string
          fetched_at?: string
          id?: string
          price_brl?: number
          raw?: Json | null
          reference_date?: string | null
          source?: string
          unit?: string
          variation_pct?: number | null
        }
        Relationships: []
      }
      crop_nutrient_ranges: {
        Row: {
          adequate_max: number | null
          analysis_type: string
          created_at: string
          crop: string
          id: string
          low_max: number | null
          medium_max: number | null
          notes: string | null
          nutrient: string
          unit: string | null
        }
        Insert: {
          adequate_max?: number | null
          analysis_type: string
          created_at?: string
          crop: string
          id?: string
          low_max?: number | null
          medium_max?: number | null
          notes?: string | null
          nutrient: string
          unit?: string | null
        }
        Update: {
          adequate_max?: number | null
          analysis_type?: string
          created_at?: string
          crop?: string
          id?: string
          low_max?: number | null
          medium_max?: number | null
          notes?: string | null
          nutrient?: string
          unit?: string | null
        }
        Relationships: []
      }
      erp_webhooks: {
        Row: {
          created_at: string
          created_by: string | null
          enabled: boolean
          id: string
          label: string
          last_used_at: string | null
          organization_id: string
          token: string
          total_calls: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          label: string
          last_used_at?: string | null
          organization_id: string
          token?: string
          total_calls?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          label?: string
          last_used_at?: string | null
          organization_id?: string
          token?: string
          total_calls?: number
        }
        Relationships: []
      }
      farms: {
        Row: {
          created_at: string
          id: string
          location: string | null
          name: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          location?: string | null
          name: string
          organization_id: string
        }
        Update: {
          created_at?: string
          id?: string
          location?: string | null
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "farms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fields: {
        Row: {
          centroid_lat: number | null
          centroid_lng: number | null
          client_id: string | null
          created_at: string
          created_by: string | null
          cultura: string | null
          farm_id: string | null
          geometry: Json
          hectares: number | null
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          centroid_lat?: number | null
          centroid_lng?: number | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          cultura?: string | null
          farm_id?: string | null
          geometry: Json
          hectares?: number | null
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          centroid_lat?: number | null
          centroid_lng?: number | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          cultura?: string | null
          farm_id?: string | null
          geometry?: Json
          hectares?: number | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fields_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fields_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leaf_samples: {
        Row: {
          b: number | null
          ca: number | null
          classification: Json | null
          client_id: string | null
          collected_at: string
          created_at: string
          created_by: string | null
          crop: string | null
          cu: number | null
          fe: number | null
          field_id: string | null
          id: string
          k: number | null
          mg: number | null
          mn: number | null
          n: number | null
          organization_id: string
          p: number | null
          point_id: string | null
          raw: Json | null
          report_path: string | null
          s: number | null
          zn: number | null
        }
        Insert: {
          b?: number | null
          ca?: number | null
          classification?: Json | null
          client_id?: string | null
          collected_at?: string
          created_at?: string
          created_by?: string | null
          crop?: string | null
          cu?: number | null
          fe?: number | null
          field_id?: string | null
          id?: string
          k?: number | null
          mg?: number | null
          mn?: number | null
          n?: number | null
          organization_id: string
          p?: number | null
          point_id?: string | null
          raw?: Json | null
          report_path?: string | null
          s?: number | null
          zn?: number | null
        }
        Update: {
          b?: number | null
          ca?: number | null
          classification?: Json | null
          client_id?: string | null
          collected_at?: string
          created_at?: string
          created_by?: string | null
          crop?: string | null
          cu?: number | null
          fe?: number | null
          field_id?: string | null
          id?: string
          k?: number | null
          mg?: number | null
          mn?: number | null
          n?: number | null
          organization_id?: string
          p?: number | null
          point_id?: string | null
          raw?: Json | null
          report_path?: string | null
          s?: number | null
          zn?: number | null
        }
        Relationships: []
      }
      ndvi_readings: {
        Row: {
          captured_at: string
          created_at: string
          field_id: string | null
          id: string
          ndvi_max: number | null
          ndvi_mean: number | null
          ndvi_min: number | null
          organization_id: string
          raw: Json | null
          source: string | null
        }
        Insert: {
          captured_at: string
          created_at?: string
          field_id?: string | null
          id?: string
          ndvi_max?: number | null
          ndvi_mean?: number | null
          ndvi_min?: number | null
          organization_id: string
          raw?: Json | null
          source?: string | null
        }
        Update: {
          captured_at?: string
          created_at?: string
          field_id?: string | null
          id?: string
          ndvi_max?: number | null
          ndvi_mean?: number | null
          ndvi_min?: number | null
          organization_id?: string
          raw?: Json | null
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ndvi_readings_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ndvi_readings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string | null
          metadata: Json | null
          organization_id: string
          read_at: string | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string | null
          metadata?: Json | null
          organization_id: string
          read_at?: string | null
          title: string
          type?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string | null
          metadata?: Json | null
          organization_id?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      nutrir_auditoria_status: {
        Row: {
          created_at: string
          entidade: string
          entidade_id: string
          id: string
          motivo: string | null
          organization_id: string
          status_anterior: string | null
          status_novo: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          entidade: string
          entidade_id: string
          id?: string
          motivo?: string | null
          organization_id: string
          status_anterior?: string | null
          status_novo: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          entidade?: string
          entidade_id?: string
          id?: string
          motivo?: string | null
          organization_id?: string
          status_anterior?: string | null
          status_novo?: string
          user_id?: string | null
        }
        Relationships: []
      }
      nutrir_campos_teste: {
        Row: {
          area_geometry: Json | null
          area_total_ha: number
          centro_lat: number | null
          centro_lng: number | null
          centroid_lat: number | null
          centroid_lng: number | null
          cliente_id: string
          created_at: string
          cultura: string | null
          data_finalizacao: string | null
          data_inicio: string
          data_plantio: string | null
          geometria: Json | null
          id: string
          observacoes: string | null
          organization_id: string
          produtos: Json
          propriedade_id: string | null
          relatorio_final_path: string | null
          relatorio_final_resumo: string | null
          representante_id: string | null
          status: Database["public"]["Enums"]["campo_teste_status"]
          titulo: string
          updated_at: string
          user_id: string | null
          variedade: string | null
        }
        Insert: {
          area_geometry?: Json | null
          area_total_ha?: number
          centro_lat?: number | null
          centro_lng?: number | null
          centroid_lat?: number | null
          centroid_lng?: number | null
          cliente_id: string
          created_at?: string
          cultura?: string | null
          data_finalizacao?: string | null
          data_inicio?: string
          data_plantio?: string | null
          geometria?: Json | null
          id?: string
          observacoes?: string | null
          organization_id: string
          produtos?: Json
          propriedade_id?: string | null
          relatorio_final_path?: string | null
          relatorio_final_resumo?: string | null
          representante_id?: string | null
          status?: Database["public"]["Enums"]["campo_teste_status"]
          titulo: string
          updated_at?: string
          user_id?: string | null
          variedade?: string | null
        }
        Update: {
          area_geometry?: Json | null
          area_total_ha?: number
          centro_lat?: number | null
          centro_lng?: number | null
          centroid_lat?: number | null
          centroid_lng?: number | null
          cliente_id?: string
          created_at?: string
          cultura?: string | null
          data_finalizacao?: string | null
          data_inicio?: string
          data_plantio?: string | null
          geometria?: Json | null
          id?: string
          observacoes?: string | null
          organization_id?: string
          produtos?: Json
          propriedade_id?: string | null
          relatorio_final_path?: string | null
          relatorio_final_resumo?: string | null
          representante_id?: string | null
          status?: Database["public"]["Enums"]["campo_teste_status"]
          titulo?: string
          updated_at?: string
          user_id?: string | null
          variedade?: string | null
        }
        Relationships: []
      }
      nutrir_campos_teste_ndvi: {
        Row: {
          campo_teste_id: string
          created_at: string
          data: string
          fonte: string
          id: string
          ndvi_max: number | null
          ndvi_mean: number | null
          ndvi_min: number | null
          organization_id: string
        }
        Insert: {
          campo_teste_id: string
          created_at?: string
          data: string
          fonte?: string
          id?: string
          ndvi_max?: number | null
          ndvi_mean?: number | null
          ndvi_min?: number | null
          organization_id: string
        }
        Update: {
          campo_teste_id?: string
          created_at?: string
          data?: string
          fonte?: string
          id?: string
          ndvi_max?: number | null
          ndvi_mean?: number | null
          ndvi_min?: number | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrir_campos_teste_ndvi_campo_teste_id_fkey"
            columns: ["campo_teste_id"]
            isOneToOne: false
            referencedRelation: "nutrir_campos_teste"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrir_campos_teste_relatorios: {
        Row: {
          campo_teste_id: string
          created_at: string
          data: string
          estagio: string | null
          fotos: Json
          id: string
          ndvi_medio: number | null
          observacoes: string | null
          organization_id: string
          user_id: string | null
        }
        Insert: {
          campo_teste_id: string
          created_at?: string
          data?: string
          estagio?: string | null
          fotos?: Json
          id?: string
          ndvi_medio?: number | null
          observacoes?: string | null
          organization_id: string
          user_id?: string | null
        }
        Update: {
          campo_teste_id?: string
          created_at?: string
          data?: string
          estagio?: string | null
          fotos?: Json
          id?: string
          ndvi_medio?: number | null
          observacoes?: string | null
          organization_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nutrir_campos_teste_relatorios_campo_teste_id_fkey"
            columns: ["campo_teste_id"]
            isOneToOne: false
            referencedRelation: "nutrir_campos_teste"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrir_cliente_propriedades: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          cliente_id: string
          complemento: string | null
          contato_email: string | null
          contato_nome: string | null
          contato_telefone: string | null
          created_at: string
          endereco: string | null
          id: string
          inscricao_estadual: string | null
          latitude: number | null
          longitude: number | null
          nome_fazenda: string
          numero: string | null
          observacoes: string | null
          ordem: number
          organization_id: string
          uf: string | null
          updated_at: string
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cliente_id: string
          complemento?: string | null
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          created_at?: string
          endereco?: string | null
          id?: string
          inscricao_estadual?: string | null
          latitude?: number | null
          longitude?: number | null
          nome_fazenda: string
          numero?: string | null
          observacoes?: string | null
          ordem?: number
          organization_id: string
          uf?: string | null
          updated_at?: string
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cliente_id?: string
          complemento?: string | null
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          created_at?: string
          endereco?: string | null
          id?: string
          inscricao_estadual?: string | null
          latitude?: number | null
          longitude?: number | null
          nome_fazenda?: string
          numero?: string | null
          observacoes?: string | null
          ordem?: number
          organization_id?: string
          uf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrir_cliente_propriedades_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "nutrir_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrir_clientes: {
        Row: {
          ativo: boolean
          bairro: string | null
          categoria: Database["public"]["Enums"]["nutrir_cliente_categoria"]
          cep: string | null
          cidade: string | null
          client_id: string | null
          cnpj: string | null
          complemento: string | null
          contato_nome: string | null
          cpf: string | null
          created_at: string
          email: string | null
          endereco: string | null
          id: string
          inscricao_estadual: string | null
          nome_fantasia: string | null
          numero: string | null
          observacoes: string | null
          organization_id: string
          razao_social: string
          regional_id: string | null
          representante_id: string | null
          telefone: string | null
          uf: string | null
          updated_at: string
          user_id: string | null
          whatsapp: string | null
        }
        Insert: {
          ativo?: boolean
          bairro?: string | null
          categoria?: Database["public"]["Enums"]["nutrir_cliente_categoria"]
          cep?: string | null
          cidade?: string | null
          client_id?: string | null
          cnpj?: string | null
          complemento?: string | null
          contato_nome?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          inscricao_estadual?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          observacoes?: string | null
          organization_id: string
          razao_social: string
          regional_id?: string | null
          representante_id?: string | null
          telefone?: string | null
          uf?: string | null
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          ativo?: boolean
          bairro?: string | null
          categoria?: Database["public"]["Enums"]["nutrir_cliente_categoria"]
          cep?: string | null
          cidade?: string | null
          client_id?: string | null
          cnpj?: string | null
          complemento?: string | null
          contato_nome?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          inscricao_estadual?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          observacoes?: string | null
          organization_id?: string
          razao_social?: string
          regional_id?: string | null
          representante_id?: string | null
          telefone?: string | null
          uf?: string | null
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nutrir_clientes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrir_clientes_regional_id_fkey"
            columns: ["regional_id"]
            isOneToOne: false
            referencedRelation: "nutrir_regionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrir_clientes_representante_id_fkey"
            columns: ["representante_id"]
            isOneToOne: false
            referencedRelation: "nutrir_representantes"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrir_colaboradores: {
        Row: {
          adiantamento: number | null
          ajuda_custo: number | null
          ativo: boolean
          bonus_meta_pct: number | null
          cargo: Database["public"]["Enums"]["nutrir_cargo"]
          comissao_base_pct: number | null
          cpf_cnpj: string | null
          created_at: string
          email: string | null
          id: string
          meta_mensal: number | null
          nome: string
          observacoes: string | null
          organization_id: string
          razao_social: string | null
          regional_id: string | null
          registro_core: string | null
          superior_id: string | null
          telefone: string | null
          updated_at: string
          user_id: string | null
          veiculo_aluguel_mensal: number | null
          veiculo_modelo: string | null
          veiculo_placa: string | null
          veiculo_tipo:
            | Database["public"]["Enums"]["nutrir_veiculo_tipo"]
            | null
          veiculo_valor: number | null
        }
        Insert: {
          adiantamento?: number | null
          ajuda_custo?: number | null
          ativo?: boolean
          bonus_meta_pct?: number | null
          cargo: Database["public"]["Enums"]["nutrir_cargo"]
          comissao_base_pct?: number | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          meta_mensal?: number | null
          nome: string
          observacoes?: string | null
          organization_id: string
          razao_social?: string | null
          regional_id?: string | null
          registro_core?: string | null
          superior_id?: string | null
          telefone?: string | null
          updated_at?: string
          user_id?: string | null
          veiculo_aluguel_mensal?: number | null
          veiculo_modelo?: string | null
          veiculo_placa?: string | null
          veiculo_tipo?:
            | Database["public"]["Enums"]["nutrir_veiculo_tipo"]
            | null
          veiculo_valor?: number | null
        }
        Update: {
          adiantamento?: number | null
          ajuda_custo?: number | null
          ativo?: boolean
          bonus_meta_pct?: number | null
          cargo?: Database["public"]["Enums"]["nutrir_cargo"]
          comissao_base_pct?: number | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          meta_mensal?: number | null
          nome?: string
          observacoes?: string | null
          organization_id?: string
          razao_social?: string | null
          regional_id?: string | null
          registro_core?: string | null
          superior_id?: string | null
          telefone?: string | null
          updated_at?: string
          user_id?: string | null
          veiculo_aluguel_mensal?: number | null
          veiculo_modelo?: string | null
          veiculo_placa?: string | null
          veiculo_tipo?:
            | Database["public"]["Enums"]["nutrir_veiculo_tipo"]
            | null
          veiculo_valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "nutrir_colaboradores_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrir_colaboradores_regional_id_fkey"
            columns: ["regional_id"]
            isOneToOne: false
            referencedRelation: "nutrir_regionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrir_colaboradores_superior_id_fkey"
            columns: ["superior_id"]
            isOneToOne: false
            referencedRelation: "nutrir_colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrir_comissoes: {
        Row: {
          base_calculo: number
          bonus_meta: number
          cliente_id: string | null
          created_at: string
          data_pagamento: string | null
          id: string
          mes_referencia: string
          observacoes: string | null
          organization_id: string
          pedido_id: string | null
          percentual: number
          representante_id: string | null
          status: Database["public"]["Enums"]["comissao_status"]
          updated_at: string
          user_id: string | null
          valor: number
        }
        Insert: {
          base_calculo?: number
          bonus_meta?: number
          cliente_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          id?: string
          mes_referencia: string
          observacoes?: string | null
          organization_id: string
          pedido_id?: string | null
          percentual?: number
          representante_id?: string | null
          status?: Database["public"]["Enums"]["comissao_status"]
          updated_at?: string
          user_id?: string | null
          valor?: number
        }
        Update: {
          base_calculo?: number
          bonus_meta?: number
          cliente_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          id?: string
          mes_referencia?: string
          observacoes?: string | null
          organization_id?: string
          pedido_id?: string | null
          percentual?: number
          representante_id?: string | null
          status?: Database["public"]["Enums"]["comissao_status"]
          updated_at?: string
          user_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "nutrir_comissoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "nutrir_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrir_comissoes_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "nutrir_pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrir_comissoes_representante_id_fkey"
            columns: ["representante_id"]
            isOneToOne: false
            referencedRelation: "nutrir_representantes"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrir_complexador_fatores: {
        Row: {
          complexador_id: string
          fator_l_kg_sal: number
          id: string
          nivel: string
          nutriente_id: string
          observacao: string | null
        }
        Insert: {
          complexador_id: string
          fator_l_kg_sal?: number
          id?: string
          nivel?: string
          nutriente_id: string
          observacao?: string | null
        }
        Update: {
          complexador_id?: string
          fator_l_kg_sal?: number
          id?: string
          nivel?: string
          nutriente_id?: string
          observacao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nutrir_complexador_fatores_complexador_id_fkey"
            columns: ["complexador_id"]
            isOneToOne: false
            referencedRelation: "nutrir_complexadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrir_complexador_fatores_nutriente_id_fkey"
            columns: ["nutriente_id"]
            isOneToOne: false
            referencedRelation: "nutrir_nutrientes"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrir_complexadores: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
          preco_litro: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          preco_litro?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          preco_litro?: number
          updated_at?: string
        }
        Relationships: []
      }
      nutrir_consultoria_culturas: {
        Row: {
          ativo: boolean
          categoria: string | null
          created_at: string
          fonte: string | null
          grid_minimo: number | null
          id: string
          nome: string
          ordem: number | null
          peso_unidade_kg: number | null
          preco_unidade: number | null
          produtividade_kg_ha: number | null
          rendimento_bruto_ha: number | null
          unidade_comercial: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          fonte?: string | null
          grid_minimo?: number | null
          id?: string
          nome: string
          ordem?: number | null
          peso_unidade_kg?: number | null
          preco_unidade?: number | null
          produtividade_kg_ha?: number | null
          rendimento_bruto_ha?: number | null
          unidade_comercial?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          fonte?: string | null
          grid_minimo?: number | null
          id?: string
          nome?: string
          ordem?: number | null
          peso_unidade_kg?: number | null
          preco_unidade?: number | null
          produtividade_kg_ha?: number | null
          rendimento_bruto_ha?: number | null
          unidade_comercial?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      nutrir_contas_receber: {
        Row: {
          cliente_id: string | null
          created_at: string
          data_emissao: string
          data_pagamento: string | null
          data_vencimento: string
          id: string
          numero_nf: string | null
          observacoes: string | null
          organization_id: string
          parcela: number
          parcelas_total: number
          pedido_id: string | null
          representante_id: string | null
          status: Database["public"]["Enums"]["cr_status"]
          updated_at: string
          valor: number
          valor_pago: number
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          data_emissao?: string
          data_pagamento?: string | null
          data_vencimento: string
          id?: string
          numero_nf?: string | null
          observacoes?: string | null
          organization_id: string
          parcela?: number
          parcelas_total?: number
          pedido_id?: string | null
          representante_id?: string | null
          status?: Database["public"]["Enums"]["cr_status"]
          updated_at?: string
          valor: number
          valor_pago?: number
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          data_emissao?: string
          data_pagamento?: string | null
          data_vencimento?: string
          id?: string
          numero_nf?: string | null
          observacoes?: string | null
          organization_id?: string
          parcela?: number
          parcelas_total?: number
          pedido_id?: string | null
          representante_id?: string | null
          status?: Database["public"]["Enums"]["cr_status"]
          updated_at?: string
          valor?: number
          valor_pago?: number
        }
        Relationships: [
          {
            foreignKeyName: "nutrir_contas_receber_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "nutrir_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrir_contas_receber_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "nutrir_pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrir_contas_receber_representante_id_fkey"
            columns: ["representante_id"]
            isOneToOne: false
            referencedRelation: "nutrir_representantes"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrir_crm_interacoes: {
        Row: {
          cliente_id: string | null
          created_at: string
          created_by: string | null
          data: string
          descricao: string
          id: string
          oportunidade_id: string | null
          organization_id: string
          tipo: string
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          descricao: string
          id?: string
          oportunidade_id?: string | null
          organization_id: string
          tipo?: string
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          descricao?: string
          id?: string
          oportunidade_id?: string | null
          organization_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrir_crm_interacoes_oportunidade_id_fkey"
            columns: ["oportunidade_id"]
            isOneToOne: false
            referencedRelation: "nutrir_crm_oportunidades"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrir_crm_oportunidades: {
        Row: {
          cliente_id: string | null
          cliente_nome: string | null
          created_at: string
          created_by: string | null
          data_prevista: string | null
          descricao: string | null
          etapa: string
          id: string
          motivo_perda: string | null
          ordem: number
          organization_id: string
          probabilidade: number
          representante_id: string | null
          titulo: string
          updated_at: string
          valor_estimado: number | null
        }
        Insert: {
          cliente_id?: string | null
          cliente_nome?: string | null
          created_at?: string
          created_by?: string | null
          data_prevista?: string | null
          descricao?: string | null
          etapa?: string
          id?: string
          motivo_perda?: string | null
          ordem?: number
          organization_id: string
          probabilidade?: number
          representante_id?: string | null
          titulo: string
          updated_at?: string
          valor_estimado?: number | null
        }
        Update: {
          cliente_id?: string | null
          cliente_nome?: string | null
          created_at?: string
          created_by?: string | null
          data_prevista?: string | null
          descricao?: string | null
          etapa?: string
          id?: string
          motivo_perda?: string | null
          ordem?: number
          organization_id?: string
          probabilidade?: number
          representante_id?: string | null
          titulo?: string
          updated_at?: string
          valor_estimado?: number | null
        }
        Relationships: []
      }
      nutrir_cultura_demanda: {
        Row: {
          created_at: string
          cultura_id: string
          exportacao_kg_ton: number | null
          extracao_kg_ton: number | null
          fator_kg: number | null
          id: string
          nutriente_id: string
          produtividade_referencia_kg: number | null
          unidade_referencia: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          cultura_id: string
          exportacao_kg_ton?: number | null
          extracao_kg_ton?: number | null
          fator_kg?: number | null
          id?: string
          nutriente_id: string
          produtividade_referencia_kg?: number | null
          unidade_referencia?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          cultura_id?: string
          exportacao_kg_ton?: number | null
          extracao_kg_ton?: number | null
          fator_kg?: number | null
          id?: string
          nutriente_id?: string
          produtividade_referencia_kg?: number | null
          unidade_referencia?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrir_cultura_demanda_cultura_id_fkey"
            columns: ["cultura_id"]
            isOneToOne: false
            referencedRelation: "nutrir_culturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrir_cultura_demanda_nutriente_id_fkey"
            columns: ["nutriente_id"]
            isOneToOne: false
            referencedRelation: "nutrir_nutrientes"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrir_culturas: {
        Row: {
          ativo: boolean
          categoria: string
          ciclo_dias: number | null
          created_at: string
          descricao: string | null
          id: string
          imagem_url: string | null
          nome: string
          nome_cientifico: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string
          ciclo_dias?: number | null
          created_at?: string
          descricao?: string | null
          id?: string
          imagem_url?: string | null
          nome: string
          nome_cientifico?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string
          ciclo_dias?: number | null
          created_at?: string
          descricao?: string | null
          id?: string
          imagem_url?: string | null
          nome?: string
          nome_cientifico?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      nutrir_embalagens: {
        Row: {
          ativo: boolean
          created_at: string
          custo_adicional_litro: number
          descricao: string | null
          id: string
          multiplicador: number | null
          nome: string
          organization_id: string
          unidade: string
          updated_at: string
          volume: number | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          custo_adicional_litro?: number
          descricao?: string | null
          id?: string
          multiplicador?: number | null
          nome: string
          organization_id: string
          unidade?: string
          updated_at?: string
          volume?: number | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          custo_adicional_litro?: number
          descricao?: string | null
          id?: string
          multiplicador?: number | null
          nome?: string
          organization_id?: string
          unidade?: string
          updated_at?: string
          volume?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "nutrir_embalagens_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrir_estagios: {
        Row: {
          created_at: string
          cultura_id: string
          descricao: string | null
          dias_apos_plantio_max: number | null
          dias_apos_plantio_min: number | null
          id: string
          nome: string
          ordem: number
          percentual_dose: number | null
          periodo: string | null
          updated_at: string | null
          volume_max_l_ha: number | null
          volume_min_l_ha: number | null
        }
        Insert: {
          created_at?: string
          cultura_id: string
          descricao?: string | null
          dias_apos_plantio_max?: number | null
          dias_apos_plantio_min?: number | null
          id?: string
          nome: string
          ordem?: number
          percentual_dose?: number | null
          periodo?: string | null
          updated_at?: string | null
          volume_max_l_ha?: number | null
          volume_min_l_ha?: number | null
        }
        Update: {
          created_at?: string
          cultura_id?: string
          descricao?: string | null
          dias_apos_plantio_max?: number | null
          dias_apos_plantio_min?: number | null
          id?: string
          nome?: string
          ordem?: number
          percentual_dose?: number | null
          periodo?: string | null
          updated_at?: string | null
          volume_max_l_ha?: number | null
          volume_min_l_ha?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "nutrir_estagios_cultura_id_fkey"
            columns: ["cultura_id"]
            isOneToOne: false
            referencedRelation: "nutrir_culturas"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrir_estoque_cliente: {
        Row: {
          cliente_id: string
          created_at: string
          custo_medio: number
          id: string
          organization_id: string
          produto_id: string | null
          produto_nome: string
          saldo: number
          ultima_movimentacao: string | null
          unidade: string
          updated_at: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          custo_medio?: number
          id?: string
          organization_id: string
          produto_id?: string | null
          produto_nome: string
          saldo?: number
          ultima_movimentacao?: string | null
          unidade?: string
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          custo_medio?: number
          id?: string
          organization_id?: string
          produto_id?: string | null
          produto_nome?: string
          saldo?: number
          ultima_movimentacao?: string | null
          unidade?: string
          updated_at?: string
        }
        Relationships: []
      }
      nutrir_estoque_lotes: {
        Row: {
          created_at: string
          custo_unitario: number
          data_fabricacao: string | null
          data_validade: string | null
          deposito: string | null
          id: string
          numero_lote: string
          observacoes: string | null
          organization_id: string
          produto_id: string | null
          produto_nome: string
          quantidade: number
          unidade: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          custo_unitario?: number
          data_fabricacao?: string | null
          data_validade?: string | null
          deposito?: string | null
          id?: string
          numero_lote: string
          observacoes?: string | null
          organization_id: string
          produto_id?: string | null
          produto_nome: string
          quantidade?: number
          unidade?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          custo_unitario?: number
          data_fabricacao?: string | null
          data_validade?: string | null
          deposito?: string | null
          id?: string
          numero_lote?: string
          observacoes?: string | null
          organization_id?: string
          produto_id?: string | null
          produto_nome?: string
          quantidade?: number
          unidade?: string
          updated_at?: string
        }
        Relationships: []
      }
      nutrir_estoque_movimentacoes: {
        Row: {
          cliente_id: string
          created_at: string
          custo_unitario: number | null
          estoque_id: string
          id: string
          observacao: string | null
          organization_id: string
          origem: string | null
          origem_id: string | null
          quantidade: number
          tipo: Database["public"]["Enums"]["estoque_mov_tipo"]
          user_id: string | null
        }
        Insert: {
          cliente_id: string
          created_at?: string
          custo_unitario?: number | null
          estoque_id: string
          id?: string
          observacao?: string | null
          organization_id: string
          origem?: string | null
          origem_id?: string | null
          quantidade: number
          tipo: Database["public"]["Enums"]["estoque_mov_tipo"]
          user_id?: string | null
        }
        Update: {
          cliente_id?: string
          created_at?: string
          custo_unitario?: number | null
          estoque_id?: string
          id?: string
          observacao?: string | null
          organization_id?: string
          origem?: string | null
          origem_id?: string | null
          quantidade?: number
          tipo?: Database["public"]["Enums"]["estoque_mov_tipo"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nutrir_estoque_movimentacoes_estoque_id_fkey"
            columns: ["estoque_id"]
            isOneToOne: false
            referencedRelation: "nutrir_estoque_cliente"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrir_financeiro_categorias: {
        Row: {
          ativo: boolean
          cor: string | null
          created_at: string
          id: string
          nome: string
          organization_id: string
          tipo: string
        }
        Insert: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          id?: string
          nome: string
          organization_id: string
          tipo?: string
        }
        Update: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          id?: string
          nome?: string
          organization_id?: string
          tipo?: string
        }
        Relationships: []
      }
      nutrir_financeiro_contas: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          organization_id: string
          saldo_inicial: number
          tipo: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          organization_id: string
          saldo_inicial?: number
          tipo?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          organization_id?: string
          saldo_inicial?: number
          tipo?: string
        }
        Relationships: []
      }
      nutrir_financeiro_lancamentos: {
        Row: {
          anexo_path: string | null
          categoria_id: string | null
          cliente_id: string | null
          conta_id: string | null
          created_at: string
          created_by: string | null
          data: string
          descricao: string
          forma_pagamento: string | null
          id: string
          observacoes: string | null
          organization_id: string
          pedido_id: string | null
          status: string
          tipo: string
          valor: number
        }
        Insert: {
          anexo_path?: string | null
          categoria_id?: string | null
          cliente_id?: string | null
          conta_id?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          descricao: string
          forma_pagamento?: string | null
          id?: string
          observacoes?: string | null
          organization_id: string
          pedido_id?: string | null
          status?: string
          tipo: string
          valor: number
        }
        Update: {
          anexo_path?: string | null
          categoria_id?: string | null
          cliente_id?: string | null
          conta_id?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          descricao?: string
          forma_pagamento?: string | null
          id?: string
          observacoes?: string | null
          organization_id?: string
          pedido_id?: string | null
          status?: string
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "nutrir_financeiro_lancamentos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "nutrir_financeiro_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrir_financeiro_lancamentos_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "nutrir_financeiro_contas"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrir_foliar_historico: {
        Row: {
          aplicacao_foliar_l_ha: number
          area_ha: number
          complexador: string
          created_at: string
          created_by: string | null
          cultura: string | null
          custo_convencional_rs_ha: number
          custo_nutrir_rs_ha: number
          economia_rs_ha: number
          economia_total_rs: number
          fazenda: string | null
          id: string
          inputs: Json
          nivel: string
          numero_batidas: number
          organization_id: string
          produtor: string | null
          resultado: Json
          titulo: string
          updated_at: string
        }
        Insert: {
          aplicacao_foliar_l_ha?: number
          area_ha?: number
          complexador?: string
          created_at?: string
          created_by?: string | null
          cultura?: string | null
          custo_convencional_rs_ha?: number
          custo_nutrir_rs_ha?: number
          economia_rs_ha?: number
          economia_total_rs?: number
          fazenda?: string | null
          id?: string
          inputs: Json
          nivel?: string
          numero_batidas?: number
          organization_id: string
          produtor?: string | null
          resultado: Json
          titulo: string
          updated_at?: string
        }
        Update: {
          aplicacao_foliar_l_ha?: number
          area_ha?: number
          complexador?: string
          created_at?: string
          created_by?: string | null
          cultura?: string | null
          custo_convencional_rs_ha?: number
          custo_nutrir_rs_ha?: number
          economia_rs_ha?: number
          economia_total_rs?: number
          fazenda?: string | null
          id?: string
          inputs?: Json
          nivel?: string
          numero_batidas?: number
          organization_id?: string
          produtor?: string | null
          resultado?: Json
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      nutrir_formula_cabecalho: {
        Row: {
          ativa_calculadora: boolean
          auto_ajuste_limite: boolean
          created_at: string
          descricao: string | null
          fator_diluicao: number
          formula_codigo: string
          id: string
          instrucoes_preparo: string | null
          nivel: string
          status: string
          titulo: string
          updated_at: string
          volume_batida_padrao_l: number | null
        }
        Insert: {
          ativa_calculadora?: boolean
          auto_ajuste_limite?: boolean
          created_at?: string
          descricao?: string | null
          fator_diluicao?: number
          formula_codigo: string
          id?: string
          instrucoes_preparo?: string | null
          nivel?: string
          status?: string
          titulo: string
          updated_at?: string
          volume_batida_padrao_l?: number | null
        }
        Update: {
          ativa_calculadora?: boolean
          auto_ajuste_limite?: boolean
          created_at?: string
          descricao?: string | null
          fator_diluicao?: number
          formula_codigo?: string
          id?: string
          instrucoes_preparo?: string | null
          nivel?: string
          status?: string
          titulo?: string
          updated_at?: string
          volume_batida_padrao_l?: number | null
        }
        Relationships: []
      }
      nutrir_formula_limite: {
        Row: {
          formula_codigo: string
          id: string
          limite_max_kg_por_1000l: number
        }
        Insert: {
          formula_codigo: string
          id?: string
          limite_max_kg_por_1000l?: number
        }
        Update: {
          formula_codigo?: string
          id?: string
          limite_max_kg_por_1000l?: number
        }
        Relationships: []
      }
      nutrir_formula_nivel_dose: {
        Row: {
          formula_codigo: string
          id: string
          nivel: string
          nutriente_id: string | null
          parametro: string | null
          unidade: string
          valor: number
        }
        Insert: {
          formula_codigo: string
          id?: string
          nivel?: string
          nutriente_id?: string | null
          parametro?: string | null
          unidade?: string
          valor?: number
        }
        Update: {
          formula_codigo?: string
          id?: string
          nivel?: string
          nutriente_id?: string | null
          parametro?: string | null
          unidade?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "nutrir_formula_nivel_dose_nutriente_id_fkey"
            columns: ["nutriente_id"]
            isOneToOne: false
            referencedRelation: "nutrir_nutrientes"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrir_formula_regra: {
        Row: {
          ativo: boolean
          base_calculo: string | null
          complexante_nome: string | null
          dose_valor: number | null
          fator_complex_l_kg: number
          fator_diluicao: number
          formula_codigo: string
          id: string
          materia_prima_id: string | null
          materia_prima_nome: string
          nivel: string
          ordem: number
          percentual: number
          tipo_calculo: string
          unidade: string
        }
        Insert: {
          ativo?: boolean
          base_calculo?: string | null
          complexante_nome?: string | null
          dose_valor?: number | null
          fator_complex_l_kg?: number
          fator_diluicao?: number
          formula_codigo: string
          id?: string
          materia_prima_id?: string | null
          materia_prima_nome: string
          nivel?: string
          ordem?: number
          percentual?: number
          tipo_calculo?: string
          unidade?: string
        }
        Update: {
          ativo?: boolean
          base_calculo?: string | null
          complexante_nome?: string | null
          dose_valor?: number | null
          fator_complex_l_kg?: number
          fator_diluicao?: number
          formula_codigo?: string
          id?: string
          materia_prima_id?: string | null
          materia_prima_nome?: string
          nivel?: string
          ordem?: number
          percentual?: number
          tipo_calculo?: string
          unidade?: string
        }
        Relationships: []
      }
      nutrir_formulacao_itens: {
        Row: {
          formulacao_id: string
          id: string
          materia_prima_id: string
          observacao: string | null
          ordem: number
          percentual: number | null
          quantidade: number
          unidade: string
        }
        Insert: {
          formulacao_id: string
          id?: string
          materia_prima_id: string
          observacao?: string | null
          ordem?: number
          percentual?: number | null
          quantidade: number
          unidade?: string
        }
        Update: {
          formulacao_id?: string
          id?: string
          materia_prima_id?: string
          observacao?: string | null
          ordem?: number
          percentual?: number | null
          quantidade?: number
          unidade?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrir_formulacao_itens_formulacao_id_fkey"
            columns: ["formulacao_id"]
            isOneToOne: false
            referencedRelation: "nutrir_formulacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrir_formulacao_itens_materia_prima_id_fkey"
            columns: ["materia_prima_id"]
            isOneToOne: false
            referencedRelation: "nutrir_materias_primas"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrir_formulacoes: {
        Row: {
          ativo: boolean
          codigo: string | null
          created_at: string
          custo_estimado: number | null
          descricao: string | null
          id: string
          nome: string
          organization_id: string
          produto_id: string | null
          rendimento_total: number | null
          unidade_rendimento: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo?: string | null
          created_at?: string
          custo_estimado?: number | null
          descricao?: string | null
          id?: string
          nome: string
          organization_id: string
          produto_id?: string | null
          rendimento_total?: number | null
          unidade_rendimento?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string | null
          created_at?: string
          custo_estimado?: number | null
          descricao?: string | null
          id?: string
          nome?: string
          organization_id?: string
          produto_id?: string | null
          rendimento_total?: number | null
          unidade_rendimento?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrir_formulacoes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrir_formulacoes_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "nutrir_produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrir_formulas_custom: {
        Row: {
          ativa: boolean
          auto_ajuste_limite: boolean
          codigo: string
          complexador_id: string | null
          created_at: string
          descricao: string | null
          enxofre_automatico: boolean
          fator_diluicao_global: number
          id: string
          limite_sais_pct: number
          motor: string
          nivel: string
          nome: string
          organization_id: string
          status: string
          updated_at: string
          volume_batida_padrao_l: number
        }
        Insert: {
          ativa?: boolean
          auto_ajuste_limite?: boolean
          codigo: string
          complexador_id?: string | null
          created_at?: string
          descricao?: string | null
          enxofre_automatico?: boolean
          fator_diluicao_global?: number
          id?: string
          limite_sais_pct?: number
          motor?: string
          nivel?: string
          nome: string
          organization_id: string
          status?: string
          updated_at?: string
          volume_batida_padrao_l?: number
        }
        Update: {
          ativa?: boolean
          auto_ajuste_limite?: boolean
          codigo?: string
          complexador_id?: string | null
          created_at?: string
          descricao?: string | null
          enxofre_automatico?: boolean
          fator_diluicao_global?: number
          id?: string
          limite_sais_pct?: number
          motor?: string
          nivel?: string
          nome?: string
          organization_id?: string
          status?: string
          updated_at?: string
          volume_batida_padrao_l?: number
        }
        Relationships: [
          {
            foreignKeyName: "nutrir_formulas_custom_complexador_id_fkey"
            columns: ["complexador_id"]
            isOneToOne: false
            referencedRelation: "nutrir_complexadores"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrir_formulas_custom_nutrientes: {
        Row: {
          ativo: boolean
          formula_id: string
          garantia_pct_override: number | null
          id: string
          materia_prima_id: string
          nutriente_id: string
          ordem: number
          step_arredondamento: number
        }
        Insert: {
          ativo?: boolean
          formula_id: string
          garantia_pct_override?: number | null
          id?: string
          materia_prima_id: string
          nutriente_id: string
          ordem?: number
          step_arredondamento?: number
        }
        Update: {
          ativo?: boolean
          formula_id?: string
          garantia_pct_override?: number | null
          id?: string
          materia_prima_id?: string
          nutriente_id?: string
          ordem?: number
          step_arredondamento?: number
        }
        Relationships: [
          {
            foreignKeyName: "nutrir_formulas_custom_nutrientes_formula_id_fkey"
            columns: ["formula_id"]
            isOneToOne: false
            referencedRelation: "nutrir_formulas_custom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrir_formulas_custom_nutrientes_materia_prima_id_fkey"
            columns: ["materia_prima_id"]
            isOneToOne: false
            referencedRelation: "nutrir_materias_primas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrir_formulas_custom_nutrientes_nutriente_id_fkey"
            columns: ["nutriente_id"]
            isOneToOne: false
            referencedRelation: "nutrir_nutrientes"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrir_materias_primas: {
        Row: {
          ativo: boolean
          codigo: string | null
          compatibilidade: string | null
          created_at: string
          embalagem_id: string | null
          fornecedor: string | null
          id: string
          imagem_url: string | null
          nome: string
          observacoes: string | null
          organization_id: string
          preco_atual: number | null
          status: string | null
          tipo: string | null
          unidade_preco: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo?: string | null
          compatibilidade?: string | null
          created_at?: string
          embalagem_id?: string | null
          fornecedor?: string | null
          id?: string
          imagem_url?: string | null
          nome: string
          observacoes?: string | null
          organization_id: string
          preco_atual?: number | null
          status?: string | null
          tipo?: string | null
          unidade_preco?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string | null
          compatibilidade?: string | null
          created_at?: string
          embalagem_id?: string | null
          fornecedor?: string | null
          id?: string
          imagem_url?: string | null
          nome?: string
          observacoes?: string | null
          organization_id?: string
          preco_atual?: number | null
          status?: string | null
          tipo?: string | null
          unidade_preco?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrir_materias_primas_embalagem_id_fkey"
            columns: ["embalagem_id"]
            isOneToOne: false
            referencedRelation: "nutrir_embalagens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrir_materias_primas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrir_modalidades: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          margens_por_categoria: Json | null
          multiplicador: number | null
          nome: string
          organization_id: string
          prazo_dias: number | null
          tipo: string | null
          tipo_negociacao: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          margens_por_categoria?: Json | null
          multiplicador?: number | null
          nome: string
          organization_id: string
          prazo_dias?: number | null
          tipo?: string | null
          tipo_negociacao?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          margens_por_categoria?: Json | null
          multiplicador?: number | null
          nome?: string
          organization_id?: string
          prazo_dias?: number | null
          tipo?: string | null
          tipo_negociacao?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrir_modalidades_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrir_mp_garantias: {
        Row: {
          id: string
          materia_prima_id: string
          nutriente_id: string
          teor: number
          unidade: string
        }
        Insert: {
          id?: string
          materia_prima_id: string
          nutriente_id: string
          teor: number
          unidade?: string
        }
        Update: {
          id?: string
          materia_prima_id?: string
          nutriente_id?: string
          teor?: number
          unidade?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrir_mp_garantias_materia_prima_id_fkey"
            columns: ["materia_prima_id"]
            isOneToOne: false
            referencedRelation: "nutrir_materias_primas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrir_mp_garantias_nutriente_id_fkey"
            columns: ["nutriente_id"]
            isOneToOne: false
            referencedRelation: "nutrir_nutrientes"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrir_mp_incompatibilidade: {
        Row: {
          created_at: string
          id: string
          materia_prima_a_id: string
          materia_prima_b_id: string
          motivo: string | null
          severidade: string
        }
        Insert: {
          created_at?: string
          id?: string
          materia_prima_a_id: string
          materia_prima_b_id: string
          motivo?: string | null
          severidade?: string
        }
        Update: {
          created_at?: string
          id?: string
          materia_prima_a_id?: string
          materia_prima_b_id?: string
          motivo?: string | null
          severidade?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrir_mp_incompatibilidade_materia_prima_a_id_fkey"
            columns: ["materia_prima_a_id"]
            isOneToOne: false
            referencedRelation: "nutrir_materias_primas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrir_mp_incompatibilidade_materia_prima_b_id_fkey"
            columns: ["materia_prima_b_id"]
            isOneToOne: false
            referencedRelation: "nutrir_materias_primas"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrir_npk_historico: {
        Row: {
          area_ha: number | null
          created_at: string
          cultura: string | null
          custo_por_ha: number | null
          custo_total: number | null
          economia_vs_formulado_pct: number | null
          economia_vs_mp_pct: number | null
          fazenda: string | null
          id: string
          inputs: Json
          modo_aplicacao: string | null
          modo_producao: string | null
          organization_id: string
          produtor: string | null
          resultado: Json
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          area_ha?: number | null
          created_at?: string
          cultura?: string | null
          custo_por_ha?: number | null
          custo_total?: number | null
          economia_vs_formulado_pct?: number | null
          economia_vs_mp_pct?: number | null
          fazenda?: string | null
          id?: string
          inputs?: Json
          modo_aplicacao?: string | null
          modo_producao?: string | null
          organization_id: string
          produtor?: string | null
          resultado?: Json
          titulo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          area_ha?: number | null
          created_at?: string
          cultura?: string | null
          custo_por_ha?: number | null
          custo_total?: number | null
          economia_vs_formulado_pct?: number | null
          economia_vs_mp_pct?: number | null
          fazenda?: string | null
          id?: string
          inputs?: Json
          modo_aplicacao?: string | null
          modo_producao?: string | null
          organization_id?: string
          produtor?: string | null
          resultado?: Json
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrir_npk_historico_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrir_nutriente_sal_padrao: {
        Row: {
          created_at: string
          fator_conversao: number | null
          garantia_percentual: number | null
          id: string
          materia_prima_id: string
          nutriente_id: string
          padrao: boolean
        }
        Insert: {
          created_at?: string
          fator_conversao?: number | null
          garantia_percentual?: number | null
          id?: string
          materia_prima_id: string
          nutriente_id: string
          padrao?: boolean
        }
        Update: {
          created_at?: string
          fator_conversao?: number | null
          garantia_percentual?: number | null
          id?: string
          materia_prima_id?: string
          nutriente_id?: string
          padrao?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "nutrir_nutriente_sal_padrao_materia_prima_id_fkey"
            columns: ["materia_prima_id"]
            isOneToOne: false
            referencedRelation: "nutrir_materias_primas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrir_nutriente_sal_padrao_nutriente_id_fkey"
            columns: ["nutriente_id"]
            isOneToOne: false
            referencedRelation: "nutrir_nutrientes"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrir_nutrientes: {
        Row: {
          ativo: boolean
          categoria: string | null
          id: string
          nome: string
          ordem: number
          simbolo: string
          unidade_padrao: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          id?: string
          nome: string
          ordem?: number
          simbolo: string
          unidade_padrao?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          id?: string
          nome?: string
          ordem?: number
          simbolo?: string
          unidade_padrao?: string
        }
        Relationships: []
      }
      nutrir_orcamento_itens: {
        Row: {
          amostras_por_talhao: number
          area_ha: number
          created_at: string
          cultura_id: string | null
          cultura_nome: string
          field_id: string | null
          grid_ha: number
          id: string
          metodo_amostragem: string
          numero_amostragens: number
          numero_talhoes: number
          orcamento_id: string
          ordem: number
          subtotal: number
          total_amostras: number
          valor_amostra: number
          valor_ha: number
        }
        Insert: {
          amostras_por_talhao?: number
          area_ha: number
          created_at?: string
          cultura_id?: string | null
          cultura_nome: string
          field_id?: string | null
          grid_ha?: number
          id?: string
          metodo_amostragem?: string
          numero_amostragens?: number
          numero_talhoes?: number
          orcamento_id: string
          ordem?: number
          subtotal?: number
          total_amostras?: number
          valor_amostra?: number
          valor_ha?: number
        }
        Update: {
          amostras_por_talhao?: number
          area_ha?: number
          created_at?: string
          cultura_id?: string | null
          cultura_nome?: string
          field_id?: string | null
          grid_ha?: number
          id?: string
          metodo_amostragem?: string
          numero_amostragens?: number
          numero_talhoes?: number
          orcamento_id?: string
          ordem?: number
          subtotal?: number
          total_amostras?: number
          valor_amostra?: number
          valor_ha?: number
        }
        Relationships: [
          {
            foreignKeyName: "nutrir_orcamento_itens_cultura_id_fkey"
            columns: ["cultura_id"]
            isOneToOne: false
            referencedRelation: "nutrir_culturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrir_orcamento_itens_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "nutrir_orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrir_orcamentos: {
        Row: {
          area_total_ha: number
          client_id: string | null
          cliente_id: string | null
          created_at: string
          created_by: string | null
          id: string
          observacoes: string | null
          organization_id: string
          parametros: Json
          representante_id: string | null
          status: string
          titulo: string
          total_geral: number
          updated_at: string
        }
        Insert: {
          area_total_ha?: number
          client_id?: string | null
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          observacoes?: string | null
          organization_id: string
          parametros: Json
          representante_id?: string | null
          status?: string
          titulo: string
          total_geral?: number
          updated_at?: string
        }
        Update: {
          area_total_ha?: number
          client_id?: string | null
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          observacoes?: string | null
          organization_id?: string
          parametros?: Json
          representante_id?: string | null
          status?: string
          titulo?: string
          total_geral?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrir_orcamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "nutrir_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrir_orcamentos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrir_orcamentos_representante_id_fkey"
            columns: ["representante_id"]
            isOneToOne: false
            referencedRelation: "nutrir_representantes"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrir_ouvidoria: {
        Row: {
          cliente_id: string | null
          cliente_nome_livre: string | null
          created_at: string
          id: string
          mensagem: string
          nivel: Database["public"]["Enums"]["nutrir_alerta_nivel"]
          organization_id: string
          respondido_em: string | null
          respondido_por: string | null
          resposta: string | null
          status: Database["public"]["Enums"]["nutrir_ouvidoria_status"]
          titulo: string
          updated_at: string
          user_id: string
          visita_id: string | null
        }
        Insert: {
          cliente_id?: string | null
          cliente_nome_livre?: string | null
          created_at?: string
          id?: string
          mensagem: string
          nivel?: Database["public"]["Enums"]["nutrir_alerta_nivel"]
          organization_id: string
          respondido_em?: string | null
          respondido_por?: string | null
          resposta?: string | null
          status?: Database["public"]["Enums"]["nutrir_ouvidoria_status"]
          titulo: string
          updated_at?: string
          user_id: string
          visita_id?: string | null
        }
        Update: {
          cliente_id?: string | null
          cliente_nome_livre?: string | null
          created_at?: string
          id?: string
          mensagem?: string
          nivel?: Database["public"]["Enums"]["nutrir_alerta_nivel"]
          organization_id?: string
          respondido_em?: string | null
          respondido_por?: string | null
          resposta?: string | null
          status?: Database["public"]["Enums"]["nutrir_ouvidoria_status"]
          titulo?: string
          updated_at?: string
          user_id?: string
          visita_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nutrir_ouvidoria_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "nutrir_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrir_parametros_consultoria: {
        Row: {
          custo_amostra: number
          grid_min_cereais: number
          id: string
          meta_lucratividade: number
          organization_id: string
          piso_amostra: number
          piso_hectare: number
          rendimento_ref_soja: number
          updated_at: string
        }
        Insert: {
          custo_amostra?: number
          grid_min_cereais?: number
          id?: string
          meta_lucratividade?: number
          organization_id: string
          piso_amostra?: number
          piso_hectare?: number
          rendimento_ref_soja?: number
          updated_at?: string
        }
        Update: {
          custo_amostra?: number
          grid_min_cereais?: number
          id?: string
          meta_lucratividade?: number
          organization_id?: string
          piso_amostra?: number
          piso_hectare?: number
          rendimento_ref_soja?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrir_parametros_consultoria_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrir_pedido_itens: {
        Row: {
          desconto_pct: number | null
          embalagem_id: string | null
          id: string
          ordem: number
          pedido_id: string
          preco_unitario: number
          produto_id: string
          quantidade: number
          subtotal: number
        }
        Insert: {
          desconto_pct?: number | null
          embalagem_id?: string | null
          id?: string
          ordem?: number
          pedido_id: string
          preco_unitario: number
          produto_id: string
          quantidade: number
          subtotal: number
        }
        Update: {
          desconto_pct?: number | null
          embalagem_id?: string | null
          id?: string
          ordem?: number
          pedido_id?: string
          preco_unitario?: number
          produto_id?: string
          quantidade?: number
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "nutrir_pedido_itens_embalagem_id_fkey"
            columns: ["embalagem_id"]
            isOneToOne: false
            referencedRelation: "nutrir_embalagens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrir_pedido_itens_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "nutrir_pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrir_pedido_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "nutrir_produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrir_pedidos: {
        Row: {
          assinatura_em: string | null
          assinatura_nome: string | null
          assinatura_path: string | null
          cliente_id: string | null
          condicao_pagamento: string | null
          created_at: string
          created_by: string | null
          data_entrega: string | null
          data_pedido: string
          data_vencimento: string | null
          desconto: number
          id: string
          modalidade_id: string | null
          numero: string | null
          observacoes: string | null
          orcamento_origem_id: string | null
          organization_id: string
          regional_id: string | null
          representante_id: string | null
          status: string
          subtotal: number
          tipo_venda: string | null
          total: number
          updated_at: string
        }
        Insert: {
          assinatura_em?: string | null
          assinatura_nome?: string | null
          assinatura_path?: string | null
          cliente_id?: string | null
          condicao_pagamento?: string | null
          created_at?: string
          created_by?: string | null
          data_entrega?: string | null
          data_pedido?: string
          data_vencimento?: string | null
          desconto?: number
          id?: string
          modalidade_id?: string | null
          numero?: string | null
          observacoes?: string | null
          orcamento_origem_id?: string | null
          organization_id: string
          regional_id?: string | null
          representante_id?: string | null
          status?: string
          subtotal?: number
          tipo_venda?: string | null
          total?: number
          updated_at?: string
        }
        Update: {
          assinatura_em?: string | null
          assinatura_nome?: string | null
          assinatura_path?: string | null
          cliente_id?: string | null
          condicao_pagamento?: string | null
          created_at?: string
          created_by?: string | null
          data_entrega?: string | null
          data_pedido?: string
          data_vencimento?: string | null
          desconto?: number
          id?: string
          modalidade_id?: string | null
          numero?: string | null
          observacoes?: string | null
          orcamento_origem_id?: string | null
          organization_id?: string
          regional_id?: string | null
          representante_id?: string | null
          status?: string
          subtotal?: number
          tipo_venda?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrir_pedidos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "nutrir_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrir_pedidos_modalidade_id_fkey"
            columns: ["modalidade_id"]
            isOneToOne: false
            referencedRelation: "nutrir_modalidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrir_pedidos_orcamento_origem_id_fkey"
            columns: ["orcamento_origem_id"]
            isOneToOne: false
            referencedRelation: "nutrir_orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrir_pedidos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrir_pedidos_regional_id_fkey"
            columns: ["regional_id"]
            isOneToOne: false
            referencedRelation: "nutrir_regionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrir_pedidos_representante_id_fkey"
            columns: ["representante_id"]
            isOneToOne: false
            referencedRelation: "nutrir_representantes"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrir_portal_tokens: {
        Row: {
          ativo: boolean
          cliente_id: string
          created_at: string
          expira_em: string | null
          id: string
          organization_id: string
          token: string
          ultimo_acesso: string | null
        }
        Insert: {
          ativo?: boolean
          cliente_id: string
          created_at?: string
          expira_em?: string | null
          id?: string
          organization_id: string
          token?: string
          ultimo_acesso?: string | null
        }
        Update: {
          ativo?: boolean
          cliente_id?: string
          created_at?: string
          expira_em?: string | null
          id?: string
          organization_id?: string
          token?: string
          ultimo_acesso?: string | null
        }
        Relationships: []
      }
      nutrir_precos: {
        Row: {
          ativo: boolean
          created_at: string
          embalagem_id: string | null
          id: string
          modalidade_id: string | null
          moeda: string
          observacoes: string | null
          organization_id: string
          preco: number
          produto_id: string
          regional_id: string | null
          updated_at: string
          vigencia_fim: string | null
          vigencia_inicio: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          embalagem_id?: string | null
          id?: string
          modalidade_id?: string | null
          moeda?: string
          observacoes?: string | null
          organization_id: string
          preco: number
          produto_id: string
          regional_id?: string | null
          updated_at?: string
          vigencia_fim?: string | null
          vigencia_inicio?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          embalagem_id?: string | null
          id?: string
          modalidade_id?: string | null
          moeda?: string
          observacoes?: string | null
          organization_id?: string
          preco?: number
          produto_id?: string
          regional_id?: string | null
          updated_at?: string
          vigencia_fim?: string | null
          vigencia_inicio?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrir_precos_embalagem_id_fkey"
            columns: ["embalagem_id"]
            isOneToOne: false
            referencedRelation: "nutrir_embalagens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrir_precos_modalidade_id_fkey"
            columns: ["modalidade_id"]
            isOneToOne: false
            referencedRelation: "nutrir_modalidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrir_precos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrir_precos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "nutrir_produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrir_precos_regional_id_fkey"
            columns: ["regional_id"]
            isOneToOne: false
            referencedRelation: "nutrir_regionais"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrir_produto_garantias: {
        Row: {
          id: string
          nutriente_id: string
          observacao: string | null
          produto_id: string
          teor: number
          unidade: string
        }
        Insert: {
          id?: string
          nutriente_id: string
          observacao?: string | null
          produto_id: string
          teor: number
          unidade?: string
        }
        Update: {
          id?: string
          nutriente_id?: string
          observacao?: string | null
          produto_id?: string
          teor?: number
          unidade?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrir_produto_garantias_nutriente_id_fkey"
            columns: ["nutriente_id"]
            isOneToOne: false
            referencedRelation: "nutrir_nutrientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrir_produto_garantias_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "nutrir_produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrir_produto_imagens: {
        Row: {
          descricao: string | null
          id: string
          ordem: number
          principal: boolean
          produto_id: string
          url: string
        }
        Insert: {
          descricao?: string | null
          id?: string
          ordem?: number
          principal?: boolean
          produto_id: string
          url: string
        }
        Update: {
          descricao?: string | null
          id?: string
          ordem?: number
          principal?: boolean
          produto_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrir_produto_imagens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "nutrir_produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrir_produto_recomendacoes: {
        Row: {
          created_at: string
          cultura_id: string
          dosagem_max: number | null
          dosagem_min: number | null
          estagio_id: string | null
          id: string
          intervalo_dias: number | null
          numero_aplicacoes: number | null
          observacoes: string | null
          produto_id: string
          unidade: string
        }
        Insert: {
          created_at?: string
          cultura_id: string
          dosagem_max?: number | null
          dosagem_min?: number | null
          estagio_id?: string | null
          id?: string
          intervalo_dias?: number | null
          numero_aplicacoes?: number | null
          observacoes?: string | null
          produto_id: string
          unidade?: string
        }
        Update: {
          created_at?: string
          cultura_id?: string
          dosagem_max?: number | null
          dosagem_min?: number | null
          estagio_id?: string | null
          id?: string
          intervalo_dias?: number | null
          numero_aplicacoes?: number | null
          observacoes?: string | null
          produto_id?: string
          unidade?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrir_produto_recomendacoes_cultura_id_fkey"
            columns: ["cultura_id"]
            isOneToOne: false
            referencedRelation: "nutrir_culturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrir_produto_recomendacoes_estagio_id_fkey"
            columns: ["estagio_id"]
            isOneToOne: false
            referencedRelation: "nutrir_estagios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrir_produto_recomendacoes_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "nutrir_produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrir_produtos: {
        Row: {
          armazenamento: string | null
          ativo: boolean
          categoria: string | null
          classificacao: string | null
          codigo: string | null
          compatibilidade: string | null
          created_at: string
          custo_industria: number | null
          descricao: string | null
          dose_recomendada: string | null
          id: string
          imagem_url: string | null
          linha: string | null
          modo_aplicacao: string | null
          nome: string
          observacoes: string | null
          organization_id: string
          recomendacao_uso: string | null
          registro_mapa: string | null
          tipos_negociacao_permitidos: Json | null
          updated_at: string
        }
        Insert: {
          armazenamento?: string | null
          ativo?: boolean
          categoria?: string | null
          classificacao?: string | null
          codigo?: string | null
          compatibilidade?: string | null
          created_at?: string
          custo_industria?: number | null
          descricao?: string | null
          dose_recomendada?: string | null
          id?: string
          imagem_url?: string | null
          linha?: string | null
          modo_aplicacao?: string | null
          nome: string
          observacoes?: string | null
          organization_id: string
          recomendacao_uso?: string | null
          registro_mapa?: string | null
          tipos_negociacao_permitidos?: Json | null
          updated_at?: string
        }
        Update: {
          armazenamento?: string | null
          ativo?: boolean
          categoria?: string | null
          classificacao?: string | null
          codigo?: string | null
          compatibilidade?: string | null
          created_at?: string
          custo_industria?: number | null
          descricao?: string | null
          dose_recomendada?: string | null
          id?: string
          imagem_url?: string | null
          linha?: string | null
          modo_aplicacao?: string | null
          nome?: string
          observacoes?: string | null
          organization_id?: string
          recomendacao_uso?: string | null
          registro_mapa?: string | null
          tipos_negociacao_permitidos?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrir_produtos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrir_rdv: {
        Row: {
          categoria: Database["public"]["Enums"]["rdv_categoria"]
          cidade: string | null
          cliente_id: string | null
          combustivel_tipo: string | null
          created_at: string
          cupom_path: string | null
          data: string
          descricao: string | null
          hotel_nome: string | null
          id: string
          km_final: number | null
          km_inicial: number | null
          litros: number | null
          notas_revisao: string | null
          organization_id: string
          preco_litro: number | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["rdv_status"]
          uf: string | null
          updated_at: string
          user_id: string
          valor: number
          visita_id: string | null
        }
        Insert: {
          categoria: Database["public"]["Enums"]["rdv_categoria"]
          cidade?: string | null
          cliente_id?: string | null
          combustivel_tipo?: string | null
          created_at?: string
          cupom_path?: string | null
          data?: string
          descricao?: string | null
          hotel_nome?: string | null
          id?: string
          km_final?: number | null
          km_inicial?: number | null
          litros?: number | null
          notas_revisao?: string | null
          organization_id: string
          preco_litro?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["rdv_status"]
          uf?: string | null
          updated_at?: string
          user_id: string
          valor: number
          visita_id?: string | null
        }
        Update: {
          categoria?: Database["public"]["Enums"]["rdv_categoria"]
          cidade?: string | null
          cliente_id?: string | null
          combustivel_tipo?: string | null
          created_at?: string
          cupom_path?: string | null
          data?: string
          descricao?: string | null
          hotel_nome?: string | null
          id?: string
          km_final?: number | null
          km_inicial?: number | null
          litros?: number | null
          notas_revisao?: string | null
          organization_id?: string
          preco_litro?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["rdv_status"]
          uf?: string | null
          updated_at?: string
          user_id?: string
          valor?: number
          visita_id?: string | null
        }
        Relationships: []
      }
      nutrir_regionais: {
        Row: {
          ativo: boolean
          created_at: string
          custo_adicional_litro: number
          descricao: string | null
          id: string
          multiplicador: number | null
          nome: string
          organization_id: string
          uf: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          custo_adicional_litro?: number
          descricao?: string | null
          id?: string
          multiplicador?: number | null
          nome: string
          organization_id: string
          uf?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          custo_adicional_litro?: number
          descricao?: string | null
          id?: string
          multiplicador?: number | null
          nome?: string
          organization_id?: string
          uf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrir_regionais_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrir_regras_calculo: {
        Row: {
          categoria: string | null
          chave: string
          descricao: string | null
          editavel: boolean | null
          id: string
          updated_at: string | null
          valor: number
          valor_numerico: number | null
          valor_texto: string | null
        }
        Insert: {
          categoria?: string | null
          chave: string
          descricao?: string | null
          editavel?: boolean | null
          id?: string
          updated_at?: string | null
          valor: number
          valor_numerico?: number | null
          valor_texto?: string | null
        }
        Update: {
          categoria?: string | null
          chave?: string
          descricao?: string | null
          editavel?: boolean | null
          id?: string
          updated_at?: string | null
          valor?: number
          valor_numerico?: number | null
          valor_texto?: string | null
        }
        Relationships: []
      }
      nutrir_representantes: {
        Row: {
          ativo: boolean
          comissao_percentual: number | null
          cpf: string | null
          created_at: string
          email: string | null
          id: string
          nome: string
          organization_id: string
          regional_id: string | null
          telefone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ativo?: boolean
          comissao_percentual?: number | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome: string
          organization_id: string
          regional_id?: string | null
          telefone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ativo?: boolean
          comissao_percentual?: number | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          organization_id?: string
          regional_id?: string | null
          telefone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nutrir_representantes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrir_representantes_regional_id_fkey"
            columns: ["regional_id"]
            isOneToOne: false
            referencedRelation: "nutrir_regionais"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrir_romaneios: {
        Row: {
          cliente_id: string | null
          cliente_nome: string | null
          created_at: string
          created_by: string | null
          data_emissao: string
          data_entrega: string | null
          endereco_entrega: string | null
          id: string
          itens: Json
          motorista: string | null
          numero: string
          observacoes: string | null
          organization_id: string
          pedido_id: string | null
          placa: string | null
          status: string
          transportadora: string | null
          updated_at: string
        }
        Insert: {
          cliente_id?: string | null
          cliente_nome?: string | null
          created_at?: string
          created_by?: string | null
          data_emissao?: string
          data_entrega?: string | null
          endereco_entrega?: string | null
          id?: string
          itens?: Json
          motorista?: string | null
          numero: string
          observacoes?: string | null
          organization_id: string
          pedido_id?: string | null
          placa?: string | null
          status?: string
          transportadora?: string | null
          updated_at?: string
        }
        Update: {
          cliente_id?: string | null
          cliente_nome?: string | null
          created_at?: string
          created_by?: string | null
          data_emissao?: string
          data_entrega?: string | null
          endereco_entrega?: string | null
          id?: string
          itens?: Json
          motorista?: string | null
          numero?: string
          observacoes?: string | null
          organization_id?: string
          pedido_id?: string | null
          placa?: string | null
          status?: string
          transportadora?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      nutrir_users: {
        Row: {
          ativo: boolean
          created_at: string
          email: string | null
          id: string
          nome: string | null
          organization_id: string
          role: Database["public"]["Enums"]["nutrir_role"]
          telefone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          email?: string | null
          id?: string
          nome?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["nutrir_role"]
          telefone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          email?: string | null
          id?: string
          nome?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["nutrir_role"]
          telefone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrir_users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrir_visitas: {
        Row: {
          alerta_nivel:
            | Database["public"]["Enums"]["nutrir_alerta_nivel"]
            | null
          campo_teste_id: string | null
          cliente_id: string | null
          cliente_nome_livre: string | null
          created_at: string
          data_visita: string
          fotos: Json
          id: string
          latitude: number | null
          longitude: number | null
          motivo: Database["public"]["Enums"]["nutrir_visita_motivo"]
          motivo_outro: string | null
          observacao: string | null
          organization_id: string
          ouvidoria_id: string | null
          propriedade_id: string | null
          relato: string
          updated_at: string
          user_id: string
        }
        Insert: {
          alerta_nivel?:
            | Database["public"]["Enums"]["nutrir_alerta_nivel"]
            | null
          campo_teste_id?: string | null
          cliente_id?: string | null
          cliente_nome_livre?: string | null
          created_at?: string
          data_visita?: string
          fotos?: Json
          id?: string
          latitude?: number | null
          longitude?: number | null
          motivo: Database["public"]["Enums"]["nutrir_visita_motivo"]
          motivo_outro?: string | null
          observacao?: string | null
          organization_id: string
          ouvidoria_id?: string | null
          propriedade_id?: string | null
          relato: string
          updated_at?: string
          user_id: string
        }
        Update: {
          alerta_nivel?:
            | Database["public"]["Enums"]["nutrir_alerta_nivel"]
            | null
          campo_teste_id?: string | null
          cliente_id?: string | null
          cliente_nome_livre?: string | null
          created_at?: string
          data_visita?: string
          fotos?: Json
          id?: string
          latitude?: number | null
          longitude?: number | null
          motivo?: Database["public"]["Enums"]["nutrir_visita_motivo"]
          motivo_outro?: string | null
          observacao?: string | null
          organization_id?: string
          ouvidoria_id?: string | null
          propriedade_id?: string | null
          relato?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrir_visitas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "nutrir_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrir_visitas_ouvidoria_id_fkey"
            columns: ["ouvidoria_id"]
            isOneToOne: false
            referencedRelation: "nutrir_ouvidoria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrir_visitas_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "nutrir_cliente_propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      org_subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          organization_id: string
          price_id: string
          product_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          organization_id: string
          price_id: string
          product_id: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          organization_id?: string
          price_id?: string
          product_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      organization_invites: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["invite_status"]
          token: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invite_status"]
          token?: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invite_status"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          mapbox_token: string | null
          name: string
          ndvi_source: string
          owner_id: string
          plan_tier: Database["public"]["Enums"]["plan_tier"]
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          mapbox_token?: string | null
          name: string
          ndvi_source?: string
          owner_id: string
          plan_tier?: Database["public"]["Enums"]["plan_tier"]
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          mapbox_token?: string | null
          name?: string
          ndvi_source?: string
          owner_id?: string
          plan_tier?: Database["public"]["Enums"]["plan_tier"]
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          created_at: string
          id: string
          max_ai_calls_month: number
          max_hectares: number
          max_ndvi_calls_month: number
          max_users: number
          name: string
          price_cents: number
          stripe_price_id_monthly: string | null
          stripe_price_id_yearly: string | null
          tier: Database["public"]["Enums"]["plan_tier"]
        }
        Insert: {
          created_at?: string
          id?: string
          max_ai_calls_month?: number
          max_hectares?: number
          max_ndvi_calls_month?: number
          max_users?: number
          name: string
          price_cents?: number
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          tier: Database["public"]["Enums"]["plan_tier"]
        }
        Update: {
          created_at?: string
          id?: string
          max_ai_calls_month?: number
          max_hectares?: number
          max_ndvi_calls_month?: number
          max_users?: number
          name?: string
          price_cents?: number
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          tier?: Database["public"]["Enums"]["plan_tier"]
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          default_org_id: string | null
          email: string
          full_name: string | null
          id: string
          onboarding_completed_at: string | null
          onboarding_step: number
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          default_org_id?: string | null
          email: string
          full_name?: string | null
          id: string
          onboarding_completed_at?: string | null
          onboarding_step?: number
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          default_org_id?: string | null
          email?: string
          full_name?: string | null
          id?: string
          onboarding_completed_at?: string | null
          onboarding_step?: number
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_org_id_fkey"
            columns: ["default_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string | null
          field_id: string | null
          id: string
          kind: string
          metadata: Json | null
          organization_id: string
          sample_id: string | null
          storage_path: string
          title: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          field_id?: string | null
          id?: string
          kind: string
          metadata?: Json | null
          organization_id: string
          sample_id?: string | null
          storage_path: string
          title: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          field_id?: string | null
          id?: string
          kind?: string
          metadata?: Json | null
          organization_id?: string
          sample_id?: string | null
          storage_path?: string
          title?: string
        }
        Relationships: []
      }
      signup_requests: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          notes: string | null
          organization_id: string | null
          requested_role: Database["public"]["Enums"]["app_role"]
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          notes?: string | null
          organization_id?: string | null
          requested_role?: Database["public"]["Enums"]["app_role"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          notes?: string | null
          organization_id?: string | null
          requested_role?: Database["public"]["Enums"]["app_role"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "signup_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      soil_samples: {
        Row: {
          calcium: number | null
          cec: number | null
          classification: Json | null
          client_id: string | null
          collected_at: string
          created_at: string
          created_by: string | null
          crop: string | null
          field_id: string | null
          id: string
          magnesium: number | null
          nitrogen: number | null
          organic_matter: number | null
          organization_id: string
          ph: number | null
          phosphorus: number | null
          point_id: string | null
          potassium: number | null
          raw: Json | null
          report_path: string | null
          sulfur: number | null
        }
        Insert: {
          calcium?: number | null
          cec?: number | null
          classification?: Json | null
          client_id?: string | null
          collected_at?: string
          created_at?: string
          created_by?: string | null
          crop?: string | null
          field_id?: string | null
          id?: string
          magnesium?: number | null
          nitrogen?: number | null
          organic_matter?: number | null
          organization_id: string
          ph?: number | null
          phosphorus?: number | null
          point_id?: string | null
          potassium?: number | null
          raw?: Json | null
          report_path?: string | null
          sulfur?: number | null
        }
        Update: {
          calcium?: number | null
          cec?: number | null
          classification?: Json | null
          client_id?: string | null
          collected_at?: string
          created_at?: string
          created_by?: string | null
          crop?: string | null
          field_id?: string | null
          id?: string
          magnesium?: number | null
          nitrogen?: number | null
          organic_matter?: number | null
          organization_id?: string
          ph?: number | null
          phosphorus?: number | null
          point_id?: string | null
          potassium?: number | null
          raw?: Json | null
          report_path?: string | null
          sulfur?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "soil_samples_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "soil_samples_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_metrics: {
        Row: {
          amount: number
          id: string
          metric: string
          occurred_at: string
          organization_id: string
        }
        Insert: {
          amount?: number
          id?: string
          metric: string
          occurred_at?: string
          organization_id: string
        }
        Update: {
          amount?: number
          id?: string
          metric?: string
          occurred_at?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_positions: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          position: Database["public"]["Enums"]["position_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          position: Database["public"]["Enums"]["position_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          position?: Database["public"]["Enums"]["position_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_positions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_test_user_to_org: {
        Args: { _email: string; _role: Database["public"]["Enums"]["app_role"] }
        Returns: string
      }
      approve_signup_request: {
        Args: {
          _request_id: string
          _role?: Database["public"]["Enums"]["app_role"]
        }
        Returns: string
      }
      atualizar_status_cr: { Args: never; Returns: number }
      create_notification: {
        Args: {
          _link?: string
          _message: string
          _metadata?: Json
          _org: string
          _title: string
          _type: string
          _user: string
        }
        Returns: string
      }
      estoque_movimentar: {
        Args: {
          _cliente: string
          _custo?: number
          _obs?: string
          _org: string
          _origem?: string
          _origem_id?: string
          _produto_nome: string
          _quantidade: number
          _tipo: Database["public"]["Enums"]["estoque_mov_tipo"]
          _unidade: string
        }
        Returns: string
      }
      get_org_usage: {
        Args: { _org: string }
        Returns: {
          ai_calls_month: number
          hectares: number
          members: number
          ndvi_calls_month: number
          reports_month: number
        }[]
      }
      get_user_position: {
        Args: { _org: string; _user: string }
        Returns: Database["public"]["Enums"]["position_type"]
      }
      has_nutrir_cargo: {
        Args: {
          _cargos: Database["public"]["Enums"]["nutrir_cargo"][]
          _org: string
          _user: string
        }
        Returns: boolean
      }
      has_nutrir_role: {
        Args: {
          _org: string
          _roles: Database["public"]["Enums"]["nutrir_role"][]
          _user: string
        }
        Returns: boolean
      }
      has_org_role: {
        Args: {
          _org: string
          _roles: Database["public"]["Enums"]["app_role"][]
          _user: string
        }
        Returns: boolean
      }
      has_position: {
        Args: {
          _org: string
          _positions: Database["public"]["Enums"]["position_type"][]
          _user: string
        }
        Returns: boolean
      }
      is_org_member: { Args: { _org: string; _user: string }; Returns: boolean }
      reject_signup_request: {
        Args: { _notes?: string; _request_id: string }
        Returns: string
      }
      user_org_ids: { Args: { _user: string }; Returns: string[] }
    }
    Enums: {
      app_role: "owner" | "admin" | "member" | "viewer"
      campo_teste_status: "em_andamento" | "finalizado" | "cancelado"
      comissao_status: "prevista" | "apurada" | "paga" | "cancelada"
      cr_status: "em_aberto" | "vencendo" | "vencido" | "pago" | "cancelado"
      estoque_mov_tipo: "entrada" | "saida" | "ajuste"
      invite_status: "pending" | "accepted" | "revoked" | "expired"
      nutrir_alerta_nivel: "muito_urgente" | "ponto_atencao" | "relato_rotina"
      nutrir_cargo:
        | "diretor"
        | "gerente_regional"
        | "rtv"
        | "at"
        | "consultor"
        | "representante"
      nutrir_cliente_categoria:
        | "produtor_rural"
        | "grupo"
        | "revenda"
        | "b2b"
        | "cooperativa"
      nutrir_ouvidoria_status:
        | "aberto"
        | "em_analise"
        | "respondido"
        | "fechado"
      nutrir_role:
        | "admin"
        | "gerente"
        | "representante"
        | "vendedor"
        | "consultor"
      nutrir_veiculo_tipo: "empresa" | "locado" | "particular" | "sem_veiculo"
      nutrir_visita_motivo:
        | "rotina_relacionamento"
        | "prospeccao_venda"
        | "acompanhamento_teste"
        | "entrega_produto"
        | "acompanhamento_aplicacao"
        | "geracao_demanda"
        | "dia_de_campo"
        | "evento_social"
        | "outro"
      plan_tier: "free" | "pro" | "enterprise"
      position_type:
        | "proprietario"
        | "diretor"
        | "gerente"
        | "representante"
        | "assistente_tecnico"
        | "cliente"
      rdv_categoria:
        | "combustivel"
        | "alimentacao"
        | "hospedagem"
        | "pedagio"
        | "manutencao"
        | "estacionamento"
        | "outros"
      rdv_status: "rascunho" | "enviado" | "aprovado" | "rejeitado" | "pago"
      sample_status: "low" | "medium" | "high" | "optimal"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["owner", "admin", "member", "viewer"],
      campo_teste_status: ["em_andamento", "finalizado", "cancelado"],
      comissao_status: ["prevista", "apurada", "paga", "cancelada"],
      cr_status: ["em_aberto", "vencendo", "vencido", "pago", "cancelado"],
      estoque_mov_tipo: ["entrada", "saida", "ajuste"],
      invite_status: ["pending", "accepted", "revoked", "expired"],
      nutrir_alerta_nivel: ["muito_urgente", "ponto_atencao", "relato_rotina"],
      nutrir_cargo: [
        "diretor",
        "gerente_regional",
        "rtv",
        "at",
        "consultor",
        "representante",
      ],
      nutrir_cliente_categoria: [
        "produtor_rural",
        "grupo",
        "revenda",
        "b2b",
        "cooperativa",
      ],
      nutrir_ouvidoria_status: [
        "aberto",
        "em_analise",
        "respondido",
        "fechado",
      ],
      nutrir_role: [
        "admin",
        "gerente",
        "representante",
        "vendedor",
        "consultor",
      ],
      nutrir_veiculo_tipo: ["empresa", "locado", "particular", "sem_veiculo"],
      nutrir_visita_motivo: [
        "rotina_relacionamento",
        "prospeccao_venda",
        "acompanhamento_teste",
        "entrega_produto",
        "acompanhamento_aplicacao",
        "geracao_demanda",
        "dia_de_campo",
        "evento_social",
        "outro",
      ],
      plan_tier: ["free", "pro", "enterprise"],
      position_type: [
        "proprietario",
        "diretor",
        "gerente",
        "representante",
        "assistente_tecnico",
        "cliente",
      ],
      rdv_categoria: [
        "combustivel",
        "alimentacao",
        "hospedagem",
        "pedagio",
        "manutencao",
        "estacionamento",
        "outros",
      ],
      rdv_status: ["rascunho", "enviado", "aprovado", "rejeitado", "pago"],
      sample_status: ["low", "medium", "high", "optimal"],
    },
  },
} as const
