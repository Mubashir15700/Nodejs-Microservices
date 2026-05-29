import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Task from '../models/taskModel';
import TaskRequest from '../models/taskRequestModel';
import { REDIS_CACHE_TTL } from '../config/envConfig';
import { getChannel } from '../services/rabbitmqService';
import redisClient from '../services/redisService';
import { getAdminId, getUserByID } from '../services/userService';
import sendToQueue from '../producers/queuePublisher';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import handleError from '../utils/errorHandler';
import clearCache from '../utils/cache';
import { isValidObjectId } from '../utils/validators';
import logger from '../utils/logger';

export const createTask = async (req: Request, res: Response) => {
  const { title, description, assigneeId } = req.body;

  let validAssigneeId: mongoose.Types.ObjectId | undefined;
  try {
    if (assigneeId) {
      const response = await getUserByID(req, assigneeId);

      if (!response.email) {
        return res.status(404).json({ message: 'User not found' });
      }
      validAssigneeId = new mongoose.Types.ObjectId(assigneeId);
    }

    const task = new Task({
      title,
      description,
      ...(validAssigneeId && { assigneeId: validAssigneeId }),
    });
    await task.save();

    if (validAssigneeId) {
      const message = {
        type: 'TASK_ASSIGNED',
        data: {
          taskTitle: task.title,
          userId: validAssigneeId,
        },
      };

      try {
        const channel = getChannel();
        await sendToQueue(channel, JSON.stringify(message));
      } catch (rabbitmqError: any) {
        logger.error(`RabbitMQ error during task creation: ${rabbitmqError.message}`);
      }
    }

    clearCache();

    res.status(201).json(task);
  } catch (error: any) {
    if (error.code === 11000) {
      // Duplicate key error
      return res.status(400).json({ message: 'Task with this title already exists.' });
    }
    handleError(res, error);
  }
};

export const getAllTasks = async (_req: Request, res: Response) => {
  try {
    const cacheKey = 'tasks:all';

    try {
      const cachedTasks = await redisClient.get(cacheKey);
      if (cachedTasks) {
        logger.info('Returning tasks from cache');
        return res.json(JSON.parse(cachedTasks));
      }
    } catch (err) {
      logger.warn(`Redis get failed — continuing without cache: ${err}`);
    }

    const tasks = await Task.find();

    try {
      await redisClient.setEx(cacheKey, REDIS_CACHE_TTL, JSON.stringify(tasks));
    } catch (err) {
      logger.warn(`Redis setEx failed — skipping cache set: ${err}`);
    }

    res.json(tasks);
  } catch (error: any) {
    handleError(res, error);
  }
};

export const getTasksByUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;

    if (!isValidObjectId(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    if (req.user && req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({ message: 'Access denied. Admins only.' });
    }

    const user = await getUserByID(req, userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const tasks = await Task.find({ assigneeId: userId }).sort({ createdAt: -1 });

    res.json(tasks);
  } catch (error: any) {
    handleError(res, error);
  }
};

export const getTaskById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid task ID' });
    }

    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json(task);
  } catch (error: any) {
    handleError(res, error);
  }
};

export const updateTask = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid task ID' });
    }

    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const prevAssignee = task.assigneeId?.toString();

    const isAdmin = req.user?.role === 'admin';
    const isAssignee = task.assigneeId?.toString() === req.user?.id;

    if (!isAdmin && !isAssignee) {
      return res.status(403).json({ message: 'Access denied. You are not the assignee.' });
    }

    const allowedFields = isAdmin
      ? ['title', 'description', 'dueDate', 'status', 'assigneeId']
      : ['status'];

    const updates = req.body;
    const invalidFields = Object.keys(updates).filter(key => !allowedFields.includes(key));
    if (invalidFields.length > 0) {
      return res.status(400).json({ message: `Invalid fields: ${invalidFields.join(', ')}` });
    }

    if (updates.status && !['pending', 'in-progress', 'completed'].includes(updates.status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    // Apply allowed updates
    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        (task as any)[field] = updates[field];
      }
    });

    const wasAssigneeChanged = isAdmin && updates.assigneeId && updates.assigneeId !== prevAssignee;

    const updatedTask = await task.save();

    // Send message to queue after successful save
    if (wasAssigneeChanged) {
      const assignee = await getUserByID(req, updates.assigneeId);

      if (!assignee) {
        return res.status(404).json({ message: 'Assignee not found' });
      }

      const message = {
        type: 'TASK_ASSIGNED',
        data: {
          taskTitle: task.title,
          userId: updates.assigneeId,
        },
      };

      try {
        const channel = getChannel();
        await sendToQueue(channel, JSON.stringify(message));
      } catch (rabbitmqError: any) {
        logger.error(`RabbitMQ error during task update: ${rabbitmqError.message}`);
      }
    }

    clearCache();

    res.status(200).json({
      message: 'Task updated successfully',
      task: updatedTask.toObject({ versionKey: false }),
    });
  } catch (error: any) {
    handleError(res, error);
  }
};

export const requestTask = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { id } = req.params;
    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    if (task.assigneeId?.toString() === userId) {
      return res.status(400).json({
        message: 'You already have this task assigned',
      });
    }

    const user = await getUserByID(req, userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (task.assigneeId) {
      return res.status(400).json({
        message: 'Task already assigned',
      });
    }

    // Create request
    let request;

    try {
      request = await TaskRequest.create({
        taskId: id,
        requestedBy: user.email,
      });
    } catch (err: any) {
      if (err.code === 11000) {
        return res.status(400).json({
          message: 'Request already sent',
        });
      }
      throw err;
    }

    try {
      const channel = getChannel();

      if (!channel) {
        logger.error('RabbitMQ channel not available');
      } else {
        const adminId = await getAdminId(req);

        if (!adminId) {
          logger.warn('Admin ID not found, skipping notification');
        } else {
          const message = {
            type: 'TASK_REQUEST_CREATED',
            data: {
              taskId: id,
              requestedBy: user.email,
              taskTitle: task.title,
              adminId,
            },
          };

          await sendToQueue(channel, JSON.stringify(message));
        }
      }
    } catch (rabbitmqError: any) {
      logger.error('RabbitMQ error during task request', rabbitmqError);
    }

    return res.status(201).json({
      message: 'Request sent successfully',
      data: request,
    });
  } catch (error: any) {
    handleError(res, error);
  }
};

export const getAllRequests = async (req: Request, res: Response) => {
  try {
    const requests = await TaskRequest.find().populate('taskId', 'title');
    res.json(requests);
  } catch (error: any) {
    handleError(res, error);
  }
};

export const deleteTasks = async (req: Request, res: Response) => {
  try {
    const { id } = req.query;

    let result;
    if (id) {
      if (!isValidObjectId(id as string)) {
        return res.status(400).json({ message: 'Invalid task ID' });
      }

      result = await Task.findByIdAndDelete(id);
      if (!result) {
        return res.status(404).json({ message: 'Task not found' });
      }

      clearCache();

      return res.status(200).json({ message: 'Task deleted successfully' });
    } else {
      const deleteResult = await Task.deleteMany({});
      if (deleteResult.deletedCount === 0) {
        return res.status(404).json({ message: 'No tasks found to delete' });
      }

      clearCache();

      return res
        .status(200)
        .json({ message: `${deleteResult.deletedCount} tasks have been deleted.` });
    }
  } catch (error: any) {
    handleError(res, error);
  }
};

export const deleteRequests = async (req: Request, res: Response) => {
  try {
    const { id } = req.query;

    let result;
    if (id) {
      if (!isValidObjectId(id as string)) {
        return res.status(400).json({ message: 'Invalid request ID' });
      }

      result = await TaskRequest.findByIdAndDelete(id);
      if (!result) {
        return res.status(404).json({ message: 'Request not found' });
      }

      return res.status(200).json({ message: 'Request deleted successfully' });
    } else {
      const deleteResult = await TaskRequest.deleteMany({});
      if (deleteResult.deletedCount === 0) {
        return res.status(404).json({ message: 'No requests found to delete' });
      }

      return res
        .status(200)
        .json({ message: `${deleteResult.deletedCount} requests have been deleted.` });
    }
  } catch (error: any) {
    handleError(res, error);
  }
};
