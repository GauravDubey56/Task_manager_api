// global constants
const CONSTANTS = {
  MAX_RETRY: 5,
  PRIORITY: {
    notification: 1,
    checkout: 2,
    fetch_inventory: 3,
    payment: 4,
  },
};
const Utils = require("./utils");
// Task Serial ID Manager

class TaskIdCounter {
  taskId = 0;
  getTaskId() {
    return ++this.taskId;
  }
  constructor() {
    this.taskId = 0;
  }
  static getInstance() {
    if (!this.instance) {
      this.instance = new TaskIdCounter();
    }
    return this.instance;
  }
}

// Task entity
class Task {
  #retryCount;
  constructor({
    taskType,
    dependentTaskIds,
    taskPayload,
    maxRetry,
    priority,
    callback,
  }) {
    const taskIdCounter = TaskIdCounter.getInstance();
    this.taskId = taskIdCounter.getTaskId();
    this.taskType = taskType;
    this.dependentTaskIds = dependentTaskIds;
    this.taskPayload = taskPayload;
    this.taskStatus = "pending";
    this.message = "";
    this.priority = priority;
    this.callback = callback;
    this.maxRetry = maxRetry ?? 5;
    this.#retryCount = 0;
  }
  updateRetry() {
    this.#retryCount++;
  }

  getRetries() {
    return this.#retryCount;
  }
}

// Executor strategi interface for task execution method to be common across all task types
class ExecutorStrategy {
  constructor(payload, callback) {
    this.payload = payload;
    this.callback = callback;
  }

  execute() {
    throw new Error("Execute method must be implemented");
  }

  callbackExecutor() {
    throw new Error("CallbackExecutor method must be implemented");
  }
}

class NotificationExecutor extends ExecutorStrategy {
  response = null;
  errorMessage;
  constructor(payload, callback) {
    super(payload, callback);
  }
  async execute() {
    // Simulate network call
    try {
      const response = await Utils.callHttp(this.payload);
      this.response = response;
      return {
        success: true,
      };
    } catch (error) {
      this.errorMessage = error.message;
      if (error?.response?.data) {
        this.response = error.response.data;
      }
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async callbackExecutor(taskId) {
    try {
      if (!this.callback) {
        console.log(`Callback for task ${taskId} `);
        return;
      }
      await Utils.callHttp(
        {
          taskId: this.taskId,
          data: this.response?.data,
          message: this.errorMessage,
        },
        this.callback
      );
    } catch (error) {
      console.error(`Error in callbackExecutor: ${error.message}`);
    }
  }
}

// Overall system manager to manage tasks, dependencies and task execution

class TaskManager {
  tasks = new Map();
  dependencyManager = new Map();

  static getInstance() {
    if (!this.instance) {
      this.instance = new TaskManager();
    }
    return this.instance;
  }
  manageDependency = (taskId, dependentTaskIds) => {
    if (!dependentTaskIds) {
      return;
    }
    for (const dependentId of dependentTaskIds) {
      // task should be present in the task list and should be not completed or failed
      if (
        !this.tasks.has(dependentId) ||
        ["completed", "failed"].includes(this.tasks.get(dependentId).taskStatus)
      ) {
        throw new CustomError("Invalid dependent task", 400);
      }
      if (!this.dependencyManager.has(dependentId)) {
        this.dependencyManager.set(dependentId, []);
      }
      this.dependencyManager.get(dependentId).push(taskId);
    }
  };
  addTask(taskDetails) {
    const { taskType, dependentTaskIds, taskPayload, maxRetry } = taskDetails;
    if (dependentTaskIds && !Array.isArray(dependentTaskIds)) {
      throw new CustomError("Invalid dependent task ids", 400);
    }

    const priority = CONSTANTS.PRIORITY[taskType];
    if (!priority) {
      throw new Error("Invalid task type");
    }

    const newTask = new Task({
      taskType,
      dependentTaskIds,
      taskPayload,
      maxRetry,
      priority,
      callback: taskDetails.callback,
    });

    this.tasks.set(newTask.taskId, newTask);
    return newTask.taskId;
  }

  getTaskStatus(taskId) {
    const task = this.tasks.get(Number(taskId));
    if (!task) {
      throw new Error("Task not found");
    }
    return { status: task.taskStatus, message: task.message };
  }

  // validates a task ID and checks dependents
  // setups the executor and executes the task
  // updates and checks retries
  async processTask(taskId) {
    const task = this.tasks.get(taskId);
    if (
      !task ||
      task.taskStatus === "completed" ||
      task.taskStatus === "failed"
    ) {
      return;
    }

    console.log(`Requested Task ID: ${taskId}`);
    
    if (!(task instanceof Task)) {
      console.error(`Invalid task instance for task ${taskId}`);
      return;
    }

    const retryCount = task.getRetries();
    const maxCount = task.maxRetry ?? CONSTANTS.MAX_RETRY;
    
    if (retryCount >= maxCount) {
      task.taskStatus = "failed";
      task.message = "Max retry limit reached";
      console.log(`Task ${taskId} failed: Max retry limit reached`);
      return;
    }

    if (task.taskStatus !== "pending") {
      return;
    }

    for (const dependentId of task.dependentTaskIds) {
      const dependentTask = this.tasks.get(dependentId);
      
      if (dependentTask && dependentTask.taskStatus !== "completed") {
        task.taskStatus = "pending";
        task.message = "Dependent task not completed";
        return;
      }

    }

    try {
      const executor = this.getExecutor(
        task.taskType,
        task.taskPayload,
        task.callback
      );
      
      task.taskStatus = "in_progress";
      
      const result = await executor.execute();

      if (result.success) {
        task.taskStatus = "completed";
        await executor.callbackExecutor(task.taskId);
      } else {
        // Failure in executor
        task.updateRetry();
        if (task.getRetries() >= maxCount) {
          task.taskStatus = "failed";
          task.message = result.message;
        } else {
          task.taskStatus = "pending";
        }
      }
    } catch (error) {
      // Exception in setting up the executor
      task.updateRetry();
      
      if (task.getRetries() >= maxCount) {
        task.taskStatus = "failed";
        task.message = error.message;
      } else {
        task.taskStatus = "pending";
      }
      
      console.error(`Error in processTask ${taskId}: ${error.message} ${task.getRetries()}`);
    }
  }

  getExecutor(taskType, payload, callback) {
    // returns default NotificationExecutor for now
    switch (taskType) {
      case "notification":
      case "checkout":
      case "fetch_inventory":
      case "payment":
        return new NotificationExecutor(payload, callback);
     
      default:
        throw new Error("Unsupported task type");
    }
  }

  async processTasks() {
    const tasksByPriority = [...this.tasks.values()].reduce((acc, task) => {
      if (task.taskStatus === "pending") {
        if (!acc[task.priority]) {
          acc[task.priority] = [];
        }
        acc[task.priority].push(task);
      }
      return acc;
    }, {});

    const priorities = Object.keys(tasksByPriority).sort((a, b) => a - b);
    for (const priority of priorities) {
      const tasks = tasksByPriority[priority];
      // builds a directed graph of dependencies
      const dependencyGraph = this.buildDependencyGraph(tasks);

      const visited = new Set();
      const processQueue = [];

      for (const [taskId, dependencies] of dependencyGraph) {
        if (dependencies.length === 0) {
          processQueue.push(taskId);
        }
      }

      while (processQueue.length > 0) {
        const currentTaskId = processQueue.shift();
        if (visited.has(currentTaskId)) {
          continue;
        }

        await this.processTask(currentTaskId);
        visited.add(currentTaskId);

        for (const [taskId, dependencies] of dependencyGraph) {
          if (dependencies.includes(currentTaskId)) {
            dependencyGraph.set(
              taskId,
              dependencies.filter((dep) => dep !== currentTaskId)
            );
            if (dependencyGraph.get(taskId).length === 0) {
              processQueue.push(taskId);
            }
          }
        }
      }
    }
  }

  buildDependencyGraph(tasks) {
    const graph = new Map();

    for (const task of tasks) {
      if (!graph.has(task.taskId)) {
        graph.set(task.taskId, []);
      }

      for (const dependentId of task.dependentTaskIds) {
        if (!graph.has(dependentId)) {
          graph.set(dependentId, []);
        }
        graph.get(dependentId).push(task.taskId);
      }
    }

    return graph;
  }
  // initiator for the cron job
  startCron(interval = 1000) {
    setInterval(async () => {
      try {
        await this.processTasks();
      } catch (error) {
        console.error("Error in cron job", error.message);
      }
    }, interval);
  }


}

module.exports = {
  TaskManager,
};
