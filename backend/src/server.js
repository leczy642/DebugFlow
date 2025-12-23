import { createServer } from "http";
import { app } from "./app.js";

const port = process.env.BACKEND_PORT || 4000;
const host = process.env.BACKEND_HOST || "0.0.0.0";

const server = createServer(app);

server.listen(port, host, () => {
  console.log(`✅ Backend listening on http://${host}:${port}`);
});
