export type PaymentMethod = 'cash' | 'card' | 'split' | 'other';

export interface PaymentItem {
  method: PaymentMethod;
  amount: number;
}

export type PaymentRecord = PaymentItem;
