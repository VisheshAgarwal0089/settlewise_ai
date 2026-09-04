import { useQuery } from '@tanstack/react-query';
import { getBatches } from '../api/batchesApi.js';

export function useActiveBatch() {
  const batches = useQuery({ queryKey: ['batches', { page: 1, pageSize: 100 }], queryFn: () => getBatches({ page: 1, pageSize: 100 }) });
  const stored = localStorage.getItem('settlewise-active-batch');
  const list = batches.data?.data ?? [];
  const activeBatchId = list.some((batch) => batch.id === stored) ? stored : list[0]?.id;
  const selectBatch = (id) => { localStorage.setItem('settlewise-active-batch', id); window.dispatchEvent(new Event('settlewise-batch')); };
  return { ...batches, batches: list, activeBatchId, activeBatch: list.find((batch) => batch.id === activeBatchId), selectBatch };
}
