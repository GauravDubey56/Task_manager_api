const axios = require("axios");
const BASE_URL = "http://localhost:3000/task";
async function testTaskManager() {


  // Define tasks with dependencies
  const tasks = [
    {
      taskType: "notification",
      dependentTaskIds: [],
      taskPayload: { timeout: 1, text: "Task D" },
      reqId: 1,
      dependentTaskIds: [2, 3]
    },
    {
      taskType: "fetch_inventory",
      dependentTaskIds: [],
      taskPayload: { timeout: 2, text: "Task C" },
      reqId: 2,
      dependentTaskIds: [1]
    },
    {
      taskType: "checkout",
      dependentTaskIds: [],
      taskPayload: { timeout: 1.5, text: "Task B" },
      reqId: 3,
      dependentTaskIds: [1]
    },
    {
      taskType: "notification",
      dependentTaskIds: [], // Dependencies will be added later
      taskPayload: { timeout: 1, text: "Task A" },
      reqId: 4
    },
  ];

  try {
    // Add tasks and capture their IDs
    const taskIds = [1,2,3,4];
    const taskD = await axios.post(BASE_URL, tasks[3]);
    const taskC = await axios.post(BASE_URL, tasks[1]);
    const taskB = await axios.post(BASE_URL, tasks[2]);
    const taskA = await axios.post(BASE_URL, tasks[0]);

    console.log("Tasks added successfully:", taskIds);

    
  } catch (error) {
    console.error("Error during test execution:", error?.message);
  }
}

testTaskManager();
