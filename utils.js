// HTTP Utils
const validHttpPayload = (payload) => {
  if (payload.timeout && !Number.isNaN(payload.timeout) && payload.text) {
    return true;
  }
  // validating url, method, body with Axios API
  if (!payload.url || !payload.method) {
    throw new CustomError("Invalid payload", 400);
  }
  if (
    ["get", "post", "put", "delete"].indexOf(payload.method.toLowerCase()) ===
    -1
  ) {
    throw new CustomError("Invalid method", 400);
  }
  return true;
};
const callHttp = async (payload, url) => {
  try {
    if (payload.timeout && !Number.isNaN(payload.timeout)) {
      if (payload.text) {
        console.log("--Simulating timeout of ", payload.text);
      }
      await timeout(Number(payload.timeout));
      if (payload.text) {
        console.log("--Completed timeout of ", payload.text, " completed");
      }
      return {
        success: true,
        data: `Success response after ${payload.timeout} seconds`,
      };
    }
    const response = await axios.request({
      url: url || payload.url,
      method: payload.method,
      data: payload.body,
    });
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return {
      success: false,
      data: error.message,
    };
  }
};

const timeout = (sec) =>
    new Promise((resolve) => setTimeout(resolve, sec * 1000));

module.exports = {
    validHttpPayload,
    callHttp,
}