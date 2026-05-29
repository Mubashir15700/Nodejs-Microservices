import { Router } from 'express';
import { verifyToken, requireAdmin } from '../middlewares/authMiddleware';
import {
  createTask,
  getAllTasks,
  getTasksByUser,
  getTaskById,
  updateTask,
  requestTask,
  getAllRequests,
  deleteTasks,
  deleteRequests,
} from '../controllers/taskController';

const router = Router();

router.post('/', verifyToken, requireAdmin, createTask);
router.get('/', verifyToken, getAllTasks);
router.get('/requests', verifyToken, requireAdmin, getAllRequests);
router.get('/user/:userId', verifyToken, getTasksByUser);
router.get('/:id', verifyToken, getTaskById);
router.put('/:id', verifyToken, updateTask);
router.post('/:id/request', verifyToken, requestTask);
router.delete('/', verifyToken, requireAdmin, deleteTasks);
router.delete('/requests', verifyToken, requireAdmin, deleteRequests);

export default router;
