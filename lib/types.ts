export const PAYMENT_METHODS = ["Cash", "GCash / E-Wallet", "Debit / Bank", "Credit Card"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type LimitMode = "soft_warn" | "hard_block";

export type Category = {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  monthly_limit: number | null;
  limit_mode: LimitMode;
  sort_order: number;
};

export type Expense = {
  id: string;
  user_id: string;
  category_id: string;
  amount: number;
  payment_method: PaymentMethod;
  note: string;
  spent_on: string; // YYYY-MM-DD
  over_budget_override: boolean;
  created_at: string;
};

export type AllowanceKind = "base" | "topup" | "adjustment" | "savings_transfer";

export type AllowanceEntry = {
  id: string;
  user_id: string;
  month: string; // YYYY-MM
  amount: number;
  kind: AllowanceKind;
  note: string | null;
  created_at: string;
};

export type SavingsTx = {
  id: string;
  user_id: string;
  kind: "rollover" | "deposit" | "withdrawal";
  amount: number;
  note: string;
  source_month: string | null;
  created_at: string;
};
