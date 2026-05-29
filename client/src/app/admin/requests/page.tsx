'use client';

import { useEffect, useState } from 'react';
import { Request, useTasksStore } from '@/store/tasksStore';
import { fetchWithAuth } from '@/lib/fetchClient';
import Requests from '@/components/admin/Requests';

export default function RequestsPage() {
  const tasksStore = useTasksStore();

  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getRequests = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetchWithAuth('/api/task?action=getRequests');
      if (!res.ok) throw new Error('Failed to fetch requests');

      const requestsData = await res.json();

      console.log('requestsData: ', requestsData);

      setRequests(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        requestsData.map((request: any) => ({
          id: request._id,
          taskId: request.taskId,
          requestedBy: request.requestedBy,
          status: request.status,
          createdAt: new Date(request.createdAt),
        }))
      );
    } catch (err) {
      console.error(err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const deleteRequest = async (id: string, requestedBy: string) => {
    if (!confirm(`Are you sure you want to delete this request?`)) return;

    try {
      setDeleting(id);

      const res = await fetchWithAuth(`/api/task?action=deleteRequest&id=${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || 'Failed to delete request');
      }

      setRequests((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      console.error(err);
      alert((err as Error).message);
    } finally {
      setDeleting(null);
    }
  };

  useEffect(() => {
    if (!tasksStore.requests.length) {
      getRequests();
    }
    {
      setRequests(tasksStore.requests);
    }
  }, [tasksStore.requests, tasksStore.requests.length]);

  console.log('requests: ', requests);

  return (
    <div className="p-1">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Requests</h1>
      </div>

      {loading && <p>Loading requests...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}

      {!loading && !error && (
        <div className="max-h-[85vh] overflow-y-auto">
          <Requests requests={requests} isAdmin onDelete={deleteRequest} deleting={deleting} />
        </div>
      )}
    </div>
  );
}
