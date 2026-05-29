'use client';

import dayjs from 'dayjs';
import { Button } from '@/components/ui/button';
import { Request } from '@/store/tasksStore';
import { ScreenMessage } from '../ScreenMessage';

interface RequestsProps {
    requests: Request[];
    isAdmin?: boolean;
    onDelete?: (id: string, requestedBy: string) => void;
    deleting?: string | null;
}

export default function Requests({
    requests,
    isAdmin = true,
    onDelete,
    deleting,
}: RequestsProps) {
    if (requests.length === 0) {
        return <ScreenMessage message="No requests found." />;
    }

    return (
        <ul className="mx-auto space-y-4">
            {requests.map((request) => (
                <li
                    key={request.id}
                    className="flex items-center justify-between rounded-md border border-gray-300 p-4 dark:border-gray-700"
                >
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{request.taskId}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Status: <span className="capitalize">{request.status}</span>
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Created: {dayjs(request.createdAt).format('MMM D, YYYY')}
                        </p>
                        {/* {task.assigneeId ? (
                            task.assigneeId === currentUserId ? (
                                <p className="text-sm text-green-600">Assigned to you</p>
                            ) : (
                                <p className="text-sm text-blue-600">Assigned to another user</p>
                            )
                        ) : (
                            <p className="text-sm text-gray-500">Unassigned</p>
                        )} */}
                    </div>

                    <div className="flex space-x-2">
                        {isAdmin && (
                            <>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => alert('Approve functionality not implemented yet')}
                                >
                                    Approve
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => alert('Reject functionality not implemented yet')}
                                >
                                    Reject
                                </Button>
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => onDelete && onDelete(request.id, request.requestedBy)}
                                >
                                    {deleting === request.id ? 'Deleting...' : 'Delete'}
                                </Button>
                            </>
                        )}
                    </div>
                </li>
            ))}
        </ul>
    );
}
