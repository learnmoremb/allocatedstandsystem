export type Role = 'admin' | 'council' | 'user';

export interface User {
  _id: string;
  fullName: string;
  email: string;
  nationalId?: string;
  phone?: string;
  address?: string;
  role: Role;
  isActive: boolean;
  mustChangePassword?: boolean;
  createdAt?: string;
}

export interface Stand {
  _id: string;
  standNumber: string;
  area: string;
  sizeSqm: number;
  landUse: string;
  price: number;
  depositPercent: number;
  description?: string;
  status: 'available' | 'reserved' | 'allocated' | 'withdrawn';
  allocatedTo?: User | null;
}

export interface Application {
  _id: string;
  applicant: User;
  stand: Stand;
  motivation?: string;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  reviewNote?: string;
  createdAt: string;
  reviewedAt?: string;
  competingApplications?: number;
}

export type Stage = 'awaiting_deposit' | 'deposit_paid' | 'installments' | 'fully_paid' | 'title_processing' | 'completed';

export interface Allocation {
  _id: string;
  allocationNumber: string;
  user: User;
  stand: Stand;
  totalAmount: number;
  depositAmount: number;
  amountPaid: number;
  balance: number;
  percentPaid: number;
  stage: Stage;
  status: 'active' | 'completed' | 'cancelled';
  stageHistory: { stage: Stage; note?: string; at: string; changedBy?: { fullName: string; role: string } }[];
  allocatedAt: string;
  cancelReason?: string;
}

export interface Payment {
  _id: string;
  allocation: any;
  user: any;
  amount: number;
  method: string;
  reference?: string;
  paymentDate: string;
  receipt?: { originalName: string; mimeType: string; size: number };
  status: 'pending' | 'approved' | 'rejected';
  reviewNote?: string;
  reviewedBy?: { fullName: string };
  reviewedAt?: string;
  createdAt: string;
}

export interface News {
  _id: string;
  title: string;
  body: string;
  category: 'land_open' | 'development' | 'payment' | 'general';
  area?: string;
  pinned: boolean;
  createdBy?: { fullName: string; role: string };
  createdAt: string;
}

export interface Infrastructure {
  _id: string;
  title: string;
  type: string;
  area: string;
  description?: string;
  status: 'planned' | 'in_progress' | 'completed' | 'on_hold';
  startDate?: string;
  expectedCompletion?: string;
  progress: number;
}

export interface AppNotification {
  _id: string;
  title: string;
  message?: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

export interface Finding {
  type: 'double_allocation' | 'same_person_multiple_stands' | 'duplicate_record' | 'conflict_with_system';
  severity: 'high' | 'medium' | 'low';
  score: number;
  reason: string;
  records: any[];
}

export interface DuplicateReport {
  _id: string;
  source: 'csv' | 'system';
  fileName: string;
  totalRecords: number;
  findings?: Finding[];
  summary: { doubleAllocations: number; samePersonMultipleStands: number; duplicateRecords: number; conflictsWithSystem: number };
  createdBy?: { fullName: string };
  createdAt: string;
}

export const STAGES: { key: Stage; label: string }[] = [
  { key: 'awaiting_deposit', label: 'Awaiting deposit' },
  { key: 'deposit_paid', label: 'Deposit paid' },
  { key: 'installments', label: 'Paying instalments' },
  { key: 'fully_paid', label: 'Fully paid' },
  { key: 'title_processing', label: 'Title deed processing' },
  { key: 'completed', label: 'Completed' },
];

export const LABELS: Record<string, string> = {
  ...Object.fromEntries(STAGES.map((s) => [s.key, s.label])),
  land_open: 'Land open',
  development: 'Development',
  payment: 'Payment',
  general: 'General',
  in_progress: 'In progress',
  on_hold: 'On hold',
  bank_transfer: 'Bank transfer',
  mobile_money: 'Mobile money',
  double_allocation: 'Double allocation',
  same_person_multiple_stands: 'Same person, multiple stands',
  duplicate_record: 'Duplicate record',
  conflict_with_system: 'Conflicts with system',
};
