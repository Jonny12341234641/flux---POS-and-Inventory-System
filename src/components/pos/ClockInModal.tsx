'use client';

import { useEffect, useState, type FormEvent } from 'react';

import { Modal } from '../ui/modal';

type ClockInModalProps = {
  isOpen: boolean;
  onClockIn: (startingCash: number) => Promise<void> | void;
  loading: boolean;
  onClose?: () => void;
};

export function ClockInModal({
  isOpen,
  onClockIn,
  loading,
  onClose,
}: ClockInModalProps) {
  const [startingCash, setStartingCash] = useState('0');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStartingCash('0');
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const parsed = Number(startingCash);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError('Starting cash must be a non-negative number.');
      return;
    }

    try {
      await onClockIn(parsed);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to open shift');
    }
  };

  const handleClose = () => {
    if (loading) return;
    setError(null);
    onClose?.();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Clock In">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <p className="text-sm text-slate-400">
          Open a shift to start processing sales.
        </p>
        <div>
          <label className="text-sm font-medium text-slate-300">
            Starting Cash
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={startingCash}
            onChange={(event) => setStartingCash(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
            required
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
            className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Opening...' : 'Open Shift'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
