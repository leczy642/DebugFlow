/**
 * server.js
 * -----------------------------------------------------------------------------
 * PURPOSE:
 * This file starts the Express server and listens for incoming requests.
 * It uses the app.js file to configure the server.
 *
 * ROLE IN PROJECT:
 * - Starts the server and listens for incoming requests
 * - Uses the app.js file to configure the server
 */

// Import the createServer function from the http module
// Import the app from the app.js file
import { createServer } from "http";
import { app } from "./src/app.js";

// Get the port from the environment variables, default to 4000
const port = process.env.BACKEND_PORT || 4000;
// Ensure backend listens on all interfaces by default
const host = process.env.BACKEND_HOST || "0.0.0.0";

// Create an HTTP server using the Express app
const server = createServer(app);

// Start the server and listen for incoming requests
server.listen(port, host, () => {
  console.log(`✅ Backend listening on http://${host}:${port}`);
});
