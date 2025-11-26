import { createServer } from "http";
import { app } from "./src/app.js";

const port = process.env.PORT || 4000;
// Ensure backend listens on all interfaces by default
const host = process.env.HOST || "0.0.0.0";

const server = createServer(app);

server.listen(port, host, () => {
  console.log(`✅ Backend listening on http://${host}:${port}`);
});
