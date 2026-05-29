import { create } from 'zustand';

interface Task {
  id: string;
  _id: string;
  title: string;
  description: string;
  assigneeId?: string;
  status: 'pending' | 'in-progress' | 'completed';
  dueDate: string;
}

export interface Request {
  id: string;
  _id: string;
  taskId: string;
  requestedBy: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
}

interface TasksState {
  tasks: Task[];
  requests: Request[];
  setTasks: (tasks: Task[]) => void;
  setRequests: (requests: Request[]) => void;
  addTask: (task: Task) => void;
  updateTask: (updatedTask: Task) => void;
  deleteTask: (taskId: string) => void;
}

export const useTasksStore = create<TasksState>((set) => ({
  tasks: [],
  requests: [],

  setTasks: (tasks) => set({ tasks }),
  setRequests: (requests) => set({ requests }),

  addTask: (task) =>
    set((state) => ({
      tasks: [...state.tasks, task],
    })),

  updateTask: (updatedTask) =>
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t)),
    })),

  deleteTask: (taskId) =>
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== taskId),
    })),
}));
