import { NextApiRequest, NextApiResponse } from 'next';
import { handleAxiosError } from '@/lib/axiosHelpers';
import { createAxiosInstance } from '@/lib/axiosInstance';

async function handleGetAllNotifications(
  req: NextApiRequest,
  res: NextApiResponse,
  token?: string
) {
  try {
    const axiosInstance = createAxiosInstance(token);
    const response = await axiosInstance.get('/notifications');
    return res.status(response.status).json(response.data);
  } catch (error: unknown) {
    return handleAxiosError(error, res);
  }
}

async function handleReadNotifications(req: NextApiRequest, res: NextApiResponse, token?: string) {
  try {
    const axiosInstance = createAxiosInstance(token);
    const response = await axiosInstance.put('/notifications', req.body);
    return res.status(response.status).json(response.data);
  } catch (error: unknown) {
    return handleAxiosError(error, res);
  }
}

// Main handler for all API requests to this file
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = req.cookies.token;

  switch (req.method) {
    case 'GET':
      if (req.query.action === 'getAll') {
        return handleGetAllNotifications(req, res, token);
      } else {
        return res.status(400).json({ message: 'Invalid action' });
      }
    case 'PUT':
      if (req.query.action === 'markAllAsRead') {
        return handleReadNotifications(req, res, token);
      } else {
        return res.status(400).json({ message: 'Invalid action' });
      }
    default:
      return res.status(405).json({ message: 'Method Not Allowed' });
  }
}
