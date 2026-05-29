import { NextApiRequest, NextApiResponse } from 'next';
import { createAxiosInstance } from '@/lib/axiosInstance';
import { handleAxiosError } from '@/lib/axiosHelpers';

async function handleGetAllUsers(req: NextApiRequest, res: NextApiResponse, token?: string) {
  try {
    const axiosInstance = createAxiosInstance(token);
    const response = await axiosInstance.get('/users');
    return res.status(response.status).json(response.data);
  } catch (error: unknown) {
    return handleAxiosError(error, res);
  }
}

async function handleGetUser(req: NextApiRequest, res: NextApiResponse, token?: string) {
  try {
    const axiosInstance = createAxiosInstance(token);
    const response = await axiosInstance.get(`/users/userId/${req.query.id}`);
    return res.status(response.status).json(response.data);
  } catch (error: unknown) {
    return handleAxiosError(error, res);
  }
}

async function handleCreateUser(req: NextApiRequest, res: NextApiResponse, token?: string) {
  try {
    const axiosInstance = createAxiosInstance(token);
    const response = await axiosInstance.post(`/users`, req.body);
    return res.status(response.status).json(response.data);
  } catch (error: unknown) {
    return handleAxiosError(error, res);
  }
}

async function handleDeleteUser(req: NextApiRequest, res: NextApiResponse, token?: string) {
  try {
    const axiosInstance = createAxiosInstance(token);
    const response = await axiosInstance.delete(`/users?id=${req.query.id}`);
    return res.status(response.status).json(response.data);
  } catch (error: unknown) {
    return handleAxiosError(error, res);
  }
}

async function handleUpdateUser(req: NextApiRequest, res: NextApiResponse, token?: string) {
  try {
    const axiosInstance = createAxiosInstance(token);
    const response = await axiosInstance.put(`/users/userId/${req.query.id}`);
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
        return handleGetAllUsers(req, res, token);
      } else if (req.query.action === 'getById') {
        return handleGetUser(req, res, token);
      } else {
        return res.status(400).json({ message: 'Invalid action' });
      }
    case 'POST':
      if (req.query.action === 'create') {
        return handleCreateUser(req, res, token);
      } else {
        return res.status(400).json({ message: 'Invalid action' });
      }
    case 'DELETE':
      if (req.query.action === 'delete') {
        return handleDeleteUser(req, res, token);
      } else {
        return res.status(400).json({ message: 'Invalid action' });
      }
    case 'PUT':
      if (req.query.action === 'update') {
        return handleUpdateUser(req, res, token);
      } else {
        return res.status(400).json({ message: 'Invalid action' });
      }
    default:
      return res.status(405).json({ message: 'Method Not Allowed' });
  }
}
