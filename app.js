const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser"); 
const { TaskManager } = require("./TaskManager");
const Utils = require("./utils");
class CustomError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}


const asyncHandler = (fn) => {
  return async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      if (error instanceof CustomError) {
        return res.status(error.statusCode).json({ error: error.message });
      } else {
        return res.status(500).json({ error: "Internal server error" });
      }
    }
  };
};

// Server APP setup
const app = express();
const taskManager = TaskManager.getInstance();
taskManager.startCron(2000);



app.use(express.json());

// Controllers
const addTask = (req, res) => {
  Utils.validHttpPayload(req.body.taskPayload);
  const taskId = taskManager.addTask(req.body);
  return res.status(201).json({ taskId });
};
const getTasks = (req, res) => {
  const status = taskManager.getTaskStatus(req.params.id);
  return res.json(200).json({
    status,
  });
};


app.use(bodyParser.json());
// End points
app.post("/task", asyncHandler(addTask));

app.get("/task/:id", asyncHandler(getTasks));

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
