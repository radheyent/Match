export type UserRole = 'admin' | 'user';
export type UserStatus = 'active' | 'disabled';
export type CustomerStatus = 'AVAILABLE' | 'ALLOCATED' | 'PULLED' | 'USED' | 'DISABLED';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  daily_pull_limit: number;
  per_pull_limit: number;
  created_at?: string;
  updated_at?: string;
}

export interface Customer {
  id: string;
  customer_number: string;
  customer_name?: string;
  matching_number: string;
  matching_number_2?: string;
  status: CustomerStatus;
  allocated_to?: string; // user profile id
  allocated_to_name?: string;
  allocated_at?: string;
  pulled_at?: string;
  uploaded_at: string;
  created_at: string;
  updated_at?: string;
}

export interface PullHistory {
  id: string;
  customer_id: string;
  customer_number: string;
  customer_name?: string;
  matching_number: string;
  matching_number_2?: string;
  user_id: string;
  user_name: string;
  action: string;
  source: string;
  pulled_at: string;
  metadata?: Record<string, unknown>;
}

export interface SendHistory {
  id: string;
  customer_id?: string;
  customer_number: string;
  user_id: string;
  user_name: string;
  channel: 'wa' | 'rcs' | 'sms';
  message: string;
  sent_at: string;
  status: 'OPENED' | 'SENT' | 'FAILED';
}

export interface MessageTemplate {
  id: string;
  name: string;
  template: string;
  is_default: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface UploadHistory {
  id: string;
  uploaded_by: string;
  uploaded_by_name: string;
  filename: string;
  total_rows: number;
  valid_rows: number;
  duplicate_rows: number;
  invalid_rows: number;
  new_rows: number;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  user_name: string;
  action: string;
  details: string;
  created_at: string;
}

export interface AllocationResult {
  success: boolean;
  customers: Customer[];
  error?: string;
  quotaRemaining?: number;
}
