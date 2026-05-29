import { Request } from 'express';
import axios from 'axios';
import { USER_SERVICE_SECRET, USER_SERVICE_URL } from '../config/envConfig';

const parseAxiosError = (error: any) => {
  if (axios.isAxiosError(error)) {
    return {
      status: error.status || error.response?.status || 500,
      message: error.response?.data?.message || error.message,
      source: 'User Service',
    };
  }

  return {
    status: 500,
    message: 'Unexpected internal error',
    source: 'Auth Service',
  };
};

export const getUserByID = async (req: Request, userId: string) => {
  const authHeader = req.headers['authorization'];

  try {
    const response = await axios.get(`${USER_SERVICE_URL}/userId/${userId}`, {
      headers: {
        Authorization: authHeader || '',
        'x-service-secret': USER_SERVICE_SECRET,
      },
    });
    return response.data;
  } catch (error) {
    throw parseAxiosError(error);
  }
};

export const getAdminId = async (req: Request) => {
  const authHeader = req.headers['authorization'];

  try {
    const response = await axios.get(`${USER_SERVICE_URL}/admin/id`, {
      headers: {
        Authorization: authHeader || '',
        'x-service-secret': USER_SERVICE_SECRET,
      },
    });
    return response.data;
  } catch (error: any) {
    throw parseAxiosError(error);
  }
};
