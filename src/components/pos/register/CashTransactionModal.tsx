'use client';

import { useEffect, useState, type FormEvent } from 'react';

import { Modal } from '../../ui/modal';

type CashTransactionType = 'pay_in' | 'pay_out';

type CashTransactionModalProps = {
  isOpen: boolean;
  type: CashTransactionType;
  onClose: () => void;
};

const reasonOptions = ['Safe Drop', 'Petty Cash', 'Change'];

export function CashTransactionModal({
  isOpen,
  type,
  onClose,
}: CashTransactionModalProps) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState(reasonOptions[0]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setReason(reasonOptions[0]);
      setNotes('');
      setError(null);
    }
  }, [isOpen]);

  const title = type === 'pay_in' ? 'Pay In' : 'Pay Out';
  const actionLabel = type === 'pay_in' ? 'Add Cash' : 'Remove Cash';
  const actionClasses =
    type === 'pay_in'
      ? 'bg-emerald-500 hover:bg-emerald-600'
      : 'bg-red-500 hover:bg-red-600';

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Amount must be greater than zero.');
      return;
    }

    const payload = {
      type,
      amount: parsedAmount,
      reason,
      notes: notes.trim(),
    };

    console.log('[Register] Cash transaction', payload);
    onClose();
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="text-sm font-medium text-slate-300">
            Amount
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-3 text-2xl font-semibold text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
            placeholder="0.00"
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-300">
            Reason
          </label>
          <select
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
          >
            {reasonOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-300">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
            rows={3}
            placeholder="Optional details..."
          />
        </div>
        {error ? (
          <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        ) : null}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            className={`rounded-md px-4 py-2 text-sm font-semibold text-white transition ${actionClasses}`}
          >
            {actionLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
