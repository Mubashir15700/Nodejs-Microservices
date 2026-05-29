import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/envConfig';
import { createUser, getUserByEmail, getAdminId } from '../services/userService';
import { getChannel } from '../services/rabbitmqService';
import sendAdminNotification from '../producers/queuePublisher';
import handleError from '../utils/errorHandler';
import logger from '../utils/logger';

export const register = async (req: Request, res: Response) => {
  const { name, email, password } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ message: 'Name, email and password required' });
  }

  try {
    const user = await createUser({ name, email, password });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, {
      expiresIn: '7h',
    });

    const adminId = await getAdminId();

    if (!adminId) {
      logger.warn('No admin user found to notify about new registration');
      return res.status(201).json({ token });
    }

    const message = {
      type: 'USER_REGISTERED',
      data: {
        userEmail: user.email,
        userId: adminId,
      },
    };

    try {
      const channel = getChannel();
      await sendAdminNotification(channel, JSON.stringify(message));
    } catch (rabbitmqError: any) {
      logger.error(
        `RabbitMQ error during user registration notification: ${rabbitmqError.message}`
      );
    }

    res.status(201).json({ token });
  } catch (error: any) {
    if (error.response?.status === 400) {
      return res.status(400).json({ message: 'User already exists or invalid data' });
    }
    handleError(res, error);
  }
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

  try {
    const user = await getUserByEmail(email);

    const match = await bcrypt.compare(password, user.password);

    if (!match) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET, {
      expiresIn: '7h',
    });

    res.json({ token });
  } catch (error: any) {
    if (error.response?.status === 404) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    handleError(res, error);
  }
};
