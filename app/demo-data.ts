import type { DairyTransaction, Party } from "./types";

function localDate(dayOffset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

export const PRODUCT_OPTIONS = [
  { name: "Loose milk", unit: "litre", rate: 220 },
  { name: "Yogurt", unit: "kg", rate: 280 },
  { name: "Desi ghee", unit: "kg", rate: 2600 },
  { name: "Butter", unit: "kg", rate: 1450 },
  { name: "Cream", unit: "kg", rate: 900 },
  { name: "Paneer", unit: "kg", rate: 1250 },
  { name: "Milk pack", unit: "pack", rate: 270 },
] as const;

export const DEMO_PARTIES: Party[] = [
  { id: "p1", name: "Haji Kareem Farm", role: "supplier", phone: "0300 1234567", village: "Chak 44" },
  { id: "p2", name: "Ayesha Dairy Farm", role: "supplier", phone: "0312 8841200", village: "Barki" },
  { id: "p3", name: "Madina General Store", role: "customer", phone: "0321 4009211", village: "Model Town" },
  { id: "p4", name: "Rehman Sweets", role: "customer", phone: "0307 1188220", village: "Main Bazaar" },
  { id: "p5", name: "Al-Noor Hostel", role: "customer", phone: "0333 2290144", village: "University Road" },
  { id: "p6", name: "Sajid Milk Point", role: "both", phone: "0345 7231190", village: "Kot Lakhpat" },
  { id: "p7", name: "Walk-in customers", role: "customer", village: "Counter sale" },
];

export const DEMO_TRANSACTIONS: DairyTransaction[] = [
  { id: "t1", kind: "purchase", party: "Haji Kareem Farm", product: "Loose milk", quantity: 120, unit: "litre", rate: 168, paid: 16000, fat: 4.2, date: localDate(), notes: "Morning collection", createdAt: Date.now() - 900000 },
  { id: "t2", kind: "purchase", party: "Ayesha Dairy Farm", product: "Loose milk", quantity: 85, unit: "litre", rate: 172, paid: 14620, fat: 4.6, date: localDate(), notes: "Chilled on arrival", createdAt: Date.now() - 820000 },
  { id: "t3", kind: "sale", party: "Rehman Sweets", product: "Loose milk", quantity: 48, unit: "litre", rate: 218, paid: 6000, date: localDate(), notes: "Daily kitchen supply", createdAt: Date.now() - 700000 },
  { id: "t4", kind: "sale", party: "Madina General Store", product: "Milk pack", quantity: 28, unit: "pack", rate: 265, paid: 7420, date: localDate(), createdAt: Date.now() - 620000 },
  { id: "t5", kind: "sale", party: "Al-Noor Hostel", product: "Loose milk", quantity: 65, unit: "litre", rate: 210, paid: 10000, date: localDate(), notes: "Evening delivery", createdAt: Date.now() - 540000 },
  { id: "t6", kind: "sale", party: "Walk-in customers", product: "Yogurt", quantity: 14, unit: "kg", rate: 280, paid: 3920, date: localDate(), createdAt: Date.now() - 460000 },
  { id: "t7", kind: "sale", party: "Walk-in customers", product: "Desi ghee", quantity: 3, unit: "kg", rate: 2700, paid: 8100, date: localDate(), createdAt: Date.now() - 380000 },
  { id: "t8", kind: "purchase", party: "Sajid Milk Point", product: "Yogurt", quantity: 22, unit: "kg", rate: 205, paid: 3000, date: localDate(-1), createdAt: Date.now() - 86400000 },
  { id: "t9", kind: "purchase", party: "Haji Kareem Farm", product: "Loose milk", quantity: 110, unit: "litre", rate: 166, paid: 18260, fat: 4.1, date: localDate(-1), createdAt: Date.now() - 90000000 },
  { id: "t10", kind: "sale", party: "Rehman Sweets", product: "Cream", quantity: 8, unit: "kg", rate: 920, paid: 5000, date: localDate(-1), createdAt: Date.now() - 92000000 },
  { id: "t11", kind: "purchase", party: "Ayesha Dairy Farm", product: "Butter", quantity: 12, unit: "kg", rate: 1160, paid: 13920, date: localDate(-2), createdAt: Date.now() - 172800000 },
  { id: "t12", kind: "sale", party: "Sajid Milk Point", product: "Butter", quantity: 7, unit: "kg", rate: 1450, paid: 8000, date: localDate(-2), createdAt: Date.now() - 173000000 },
  { id: "t13", kind: "purchase", party: "Sajid Milk Point", product: "Desi ghee", quantity: 8, unit: "kg", rate: 2280, paid: 18240, date: localDate(-3), createdAt: Date.now() - 259000000 },
  { id: "t14", kind: "purchase", party: "Ayesha Dairy Farm", product: "Cream", quantity: 14, unit: "kg", rate: 690, paid: 9660, date: localDate(-3), createdAt: Date.now() - 260000000 },
  { id: "t15", kind: "purchase", party: "Sajid Milk Point", product: "Milk pack", quantity: 60, unit: "pack", rate: 230, paid: 13800, date: localDate(-3), createdAt: Date.now() - 261000000 },
];

