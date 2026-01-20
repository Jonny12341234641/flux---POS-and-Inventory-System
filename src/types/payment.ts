export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'cheque' | 'split';

export interface PaymentRecord {
  method: PaymentMethod;
  amount: number;
}
