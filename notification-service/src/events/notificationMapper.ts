export const buildNotificationFromEvent = (event: any) => {
    switch (event.type) {
        case 'USER_REGISTERED':
            return {
                userId: event.data.userId,
                message: `New user registered: ${event.data.userEmail}`,
                type: 'user',
            };

        case 'TASK_ASSIGNED':
            return {
                userId: event.data.userId,
                message: `You have been assigned to task "${event.data.taskTitle}".`,
                type: 'task',
            };

        case 'TASK_REQUEST_CREATED':
            return {
                userId: event.data.adminId,
                message: `User ${event.data.requestedBy} requested task "${event.data.taskTitle}".`,
                type: 'task',
            };

        default:
            return null;
    }
};
