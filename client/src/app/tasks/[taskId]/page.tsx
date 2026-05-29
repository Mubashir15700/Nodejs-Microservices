'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ScreenMessage } from '@/components/ScreenMessage';
import { useTasksStore } from '@/store/tasksStore';
import { fetchWithAuth } from '@/lib/fetchClient';
import { useAuthStore } from '@/store/authStore';

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed';
  dueDate: string;
  assigneeId?: string;
}

export default function TaskDetailsPage() {
  const params = useParams();

  const { tasks, updateTask } = useTasksStore();
  const { user } = useAuthStore((s) => s);

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [requestingAssign, setRequestingAssign] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.taskId) return;
    const task = tasks.find((t) => t.id === params?.taskId);

    if (task) {
      setTask({
        title: task.title,
        description: task.description,
        dueDate: task.dueDate,
        status: task.status,
        id: task.id,
        assigneeId: task.assigneeId,
      });
      setLoading(false);
      return;
    } else {
      fetchWithAuth(`/api/task?action=getById&id=${params.taskId}`)
        .then((res) => res.json())
        .then((data) => {
          setTask(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [params?.taskId, tasks]);

  if (loading) {
    return <ScreenMessage message="Loading task details..." />;
  }

  if (!task) {
    return <ScreenMessage message={'Task not found'} type="error" />;
  }

  const handleStatusChange = async (newStatus: Task['status']) => {
    try {
      setUpdatingStatus(true);
      setError(null);

      const payload = {
        status: newStatus,
      };

      const response = await fetchWithAuth(`/api/task?action=update&id=${params?.taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result?.data?.message || result?.message || 'Failed to update task');
        return;
      }

      if (result.task) {
        updateTask(result.task);
      }
    } catch (err) {
      console.error('Error updating task:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleRequestAssign = async () => {
    setRequestingAssign(true);
    setError(null);

    try {
      const response = await fetchWithAuth(`/api/task?action=requestAssign&id=${params?.taskId}`, {
        method: 'POST',
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result?.data?.message || result?.message || 'Failed to request assignment');
        return;
      }

      if (result.task) {
        updateTask(result.task);
        setTask(result.task);
      }
    } catch {
      setError('Failed to request assignment');
    } finally {
      setRequestingAssign(false);
    }
  };

  const isAssignedToCurrentUser = task.assigneeId === user?.id;

  return (
    <div className="mx-auto mt-10 max-w-4xl px-4">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl transition-all dark:border-gray-700 dark:bg-gray-800">
        {/* Header */}
        <div className="border-b border-gray-200 bg-gray-50 px-8 py-6 dark:border-gray-700 dark:bg-gray-900">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                {task.title}
              </h1>

              <p className="mt-3 max-w-2xl leading-relaxed text-gray-600 dark:text-gray-300">
                {task.description}
              </p>
            </div>

            <span
              className={`inline-flex w-fit items-center rounded-full px-4 py-1 text-sm font-semibold capitalize ${
                task.status === 'completed'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                  : task.status === 'in-progress'
                    ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300'
                    : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              {task.status.replace('-', ' ')}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-6 px-8 py-6">
          {/* Info Cards */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Due Date</p>

              <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                {new Date(task.dueDate).toLocaleDateString()}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Assignee</p>

              <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                {task.assigneeId
                  ? task.assigneeId === user?.id
                    ? `${user?.name} (You)`
                    : task.assigneeId
                  : 'No assignee yet'}
              </p>
            </div>
          </div>

          {/* Status Actions */}
          <div>
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
              {isAssignedToCurrentUser ? 'Update Task Status' : 'Task Status'}
            </h2>

            <div className="flex flex-wrap gap-3">
              {['pending', 'in-progress', 'completed'].map((status) => (
                <Button
                  key={status}
                  onClick={() => handleStatusChange(status as Task['status'])}
                  disabled={updatingStatus || task.status === status || !isAssignedToCurrentUser}
                  variant={task.status === status ? 'default' : 'outline'}
                  size="sm"
                  className="rounded-full px-5"
                >
                  {status.replace('-', ' ').toUpperCase()}
                </Button>
              ))}
            </div>
          </div>

          {/* Assignment */}
          {!isAssignedToCurrentUser && (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-5 dark:border-gray-600 dark:bg-gray-900">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    Task Not Assigned to You
                  </h3>

                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Request assignment to start working on this task.
                  </p>
                </div>

                <Button
                  onClick={handleRequestAssign}
                  disabled={requestingAssign}
                  variant="secondary"
                  size="sm"
                  className="rounded-full px-5"
                >
                  {requestingAssign ? 'Requesting...' : 'Request Assignment'}
                </Button>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
