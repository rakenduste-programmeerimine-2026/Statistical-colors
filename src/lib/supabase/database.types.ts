// Database types for the Supabase client.
// Written to match supabase/migrations by hand. Once the project is linked,
// regenerate with: npm run db:types

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      images: {
        Row: {
          id: string;
          owner_id: string;
          batch_id: string;
          file_name: string;
          format: string;
          width: number;
          height: number;
          total_pixels: number;
          unique_colors: number;
          include_alpha: boolean;
          color_space: string;
          summary_csv_path: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id?: string;
          batch_id?: string;
          file_name: string;
          format: string;
          width: number;
          height: number;
          unique_colors: number;
          include_alpha?: boolean;
          color_space?: string;
          summary_csv_path?: string | null;
          created_at?: string;
        };
        Update: {
          summary_csv_path?: string | null;
        };
        Relationships: [];
      };
      image_colors: {
        Row: {
          image_id: string;
          rank: number;
          r: number;
          g: number;
          b: number;
          a: number | null;
          hex: string;
          pixel_count: number;
          percent: number;
          user_flagged: boolean;
          user_note: string | null;
        };
        Insert: {
          image_id: string;
          rank: number;
          r: number;
          g: number;
          b: number;
          a?: number | null;
          pixel_count: number;
          percent: number;
          user_flagged?: boolean;
          user_note?: string | null;
        };
        Update: {
          user_flagged?: boolean;
          user_note?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "image_colors_image_id_fkey";
            columns: ["image_id"];
            isOneToOne: false;
            referencedRelation: "images";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
