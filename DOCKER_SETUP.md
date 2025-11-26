# Docker Setup Instructions

## Installing Docker Desktop for macOS

### Option 1: Manual Installation (Recommended)

1. **Download Docker Desktop:**
   - Visit: https://www.docker.com/products/docker-desktop
   - Click "Download for Mac"
   - Choose the version for your Mac (Apple Silicon or Intel)

2. **Install Docker Desktop:**
   - Open the downloaded `.dmg` file
   - Drag Docker.app to your Applications folder
   - Open Docker.app from Applications
   - Follow the setup wizard
   - Docker Desktop will start automatically

3. **Verify Installation:**
   ```bash
   docker --version
   docker compose version
   ```

### Option 2: Install via Homebrew (Requires Admin Password)

Run this command in your terminal (you'll be prompted for your password):
```bash
brew install --cask docker
```

Then start Docker Desktop:
- Open Applications → Docker.app
- Or run: `open -a Docker`

## Starting Docker Compose

Once Docker Desktop is installed and running:

1. **Make sure Docker Desktop is running:**
   - Check the menu bar for the Docker icon (whale icon)
   - If it's not running, open Docker Desktop from Applications

2. **Update your API keys in `backend/.env`:**
   ```bash
   OPENAI_API_KEY=your_actual_openai_api_key
   VECTOR_DB_API_KEY=your_actual_pinecone_api_key
   ```

3. **Start the services:**
   ```bash
   docker compose up -d --build
   ```
   
   **Note:** Use `docker compose` (with a space), not `docker-compose` (with a hyphen)
   
   Modern Docker installations use `docker compose` as a plugin command.

4. **View logs:**
   ```bash
   docker compose logs -f
   ```

5. **Stop the services:**
   ```bash
   docker compose down
   ```

## Troubleshooting

### "command not found: docker-compose"
- Use `docker compose` (with a space) instead of `docker-compose`
- This is the modern Docker Compose V2 syntax

### "Cannot connect to the Docker daemon"
- Make sure Docker Desktop is running
- Check the Docker icon in your menu bar
- Try restarting Docker Desktop

### Port already in use
- Make sure ports 3000 and 4000 are not being used by other applications
- Check: `lsof -i :3000` and `lsof -i :4000`

### Build errors
- Make sure your API keys are set in `backend/.env`
- Check Docker has enough resources allocated (Docker Desktop → Settings → Resources)

