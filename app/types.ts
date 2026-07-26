export type TransactionKind = "sale" | "purchase";
export type Unit = "litre" | "kg" | "pack";
export type PartyRole = "customer" | "supplier" | "both";

export type DairyTransaction = {
  id: string;
  kind: TransactionKind;
  party: string;
  product: string;
  quantity: number;
  unit: Unit;
  rate: number;
  paid: number;
  fat?: number;
  date: string;
  notes?: string;
  createdAt: number;
};

export type Party = {
  id: string;
  name: string;
  role: PartyRole;
  phone?: string;
  village?: string;
};

export type InventoryItem = {
  product: string;
  unit: Unit;
  purchased: number;
  sold: number;
  stock: number;
  value: number;
};

export type LedgerRow = {
  name: string;
  role: PartyRole;
  totalBusiness: number;
  paid: number;
  balance: number;
  transactionCount: number;
};

export type FirebaseState = "demo" | "connecting" | "connected" | "error";
export type TransactionInput = Omit<DairyTransaction, "id" | "createdAt">;
