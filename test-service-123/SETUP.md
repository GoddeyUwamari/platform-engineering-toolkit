# Setup Instructions for Phase 1

Follow these steps to set up and run the Production API Framework.

## Step-by-Step Installation

### Step 1: Verify Prerequisites

Ensure you have the correct versions installed:

```bash
node --version  # Should be >= 20.0.0
npm --version   # Should be >= 9.0.0
```

### Step 2: Install Dependencies

From the project root directory, run:

```bash
npm install
```

**Expected Output:**
- Installation of all dependencies listed in package.json
- No errors or warnings (some peer dependency warnings are acceptable)

### Step 3: Verify TypeScript Configuration

Check that TypeScript is properly configured:

```bash
npm run type-check
```

**Expected Output:**
- No type errors
- Exit code 0

### Step 4: Run Code Quality Checks

Verify that ESLint and Prettier are working:

```bash
npm run lint
```

**Expected Output:**
- No linting errors

```bash
npm run format:check
```

**Expected Output:**
- All files are formatted correctly

### Step 5: Build the Project

Compile TypeScript to JavaScript:

```bash
npm run build
```

**Expected Output:**
- `dist/` folder created with compiled JavaScript files
- No compilation errors

### Step 6: Start Development Server

Run the development server with hot reload:

```bash
npm run dev
```

**Expected Output:**
```
🚀 Server started successfully!
📦 Application: production-api-framework
🌍 Environment: development
🔗 URL: http://localhost:3000
📡 API Version: v1
...
```

### Step 7: Test Endpoints

In a new terminal window, test the API endpoints:

```bash
# Test health check
curl http://localhost:3000/health

# Expected response:
{
  "success": true,
  "message": "API is running",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 123.456,
  "environment": "development",
  "version": "v1"
}

# Test readiness check
curl http://localhost:3000/ready

# Test API info
curl http://localhost:3000/

# Test API v1
curl http://localhost:3000/api/v1
```

Or open in your browser:
- http://localhost:3000/health
- http://localhost:3000/ready
- http://localhost:3000/api/v1

### Step 8: Test Production Build

Stop the dev server (Ctrl+C) and test production build:

```bash
npm start
```

**Expected Output:**
- Same as development server
- Server runs from compiled `dist/` files

### Step 9: Initialize Git Repository

```bash
# Initialize git
git init

# Add all files
git add .

# Create first commit
git commit -m "feat: initial commit - Phase 1 complete

- Setup Node.js/TypeScript project structure
- Configure Express.js with security middleware
- Add health check and readiness probe endpoints
- Implement error handling and logging
- Setup code quality tools (ESLint, Prettier)
- Create comprehensive documentation"
```

### Step 10: Connect to GitHub (Optional)

```bash
# Create a new repository on GitHub, then:
git remote add origin https://github.com/yourusername/production-api-framework.git
git branch -M main
git push -u origin main
```

## Troubleshooting

### Port Already in Use

If you see `EADDRINUSE` error:

1. Find and kill the process using port 3000:
   ```bash
   # macOS/Linux
   lsof -ti:3000 | xargs kill -9

   # Windows
   netstat -ano | findstr :3000
   taskkill /PID <PID> /F
   ```

2. Or change the port in `.env`:
   ```
   PORT=3001
   ```

### TypeScript Errors

If you see TypeScript compilation errors:

1. Delete `node_modules` and reinstall:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

2. Clear TypeScript cache:
   ```bash
   rm -rf dist
   npm run build
   ```

### ESLint Errors

If ESLint shows errors:

1. Try auto-fixing:
   ```bash
   npm run lint:fix
   ```

2. Format code:
   ```bash
   npm run format
   ```

## Verification Checklist

Use this checklist to ensure Phase 1 is complete:

- [ ] All dependencies installed without errors
- [ ] `npm run type-check` passes with no errors
- [ ] `npm run lint` passes with no errors
- [ ] `npm run build` creates `dist/` folder
- [ ] `npm run dev` starts server successfully
- [ ] `http://localhost:3000/health` returns 200 OK
- [ ] `http://localhost:3000/ready` returns 200 OK
- [ ] `http://localhost:3000/api/v1` returns API info
- [ ] `npm start` runs production build
- [ ] Git repository initialized with first commit
- [ ] README.md is complete and professional
- [ ] All configuration files present (.env, .eslintrc.json, etc.)

## Next Steps

Once Phase 1 is complete:

1. **Phase 2**: Add PostgreSQL and Redis
2. **Phase 3**: Docker containerization
3. **Phase 4**: CI/CD with GitHub Actions
4. **Phase 5**: Monitoring and testing

## Need Help?

- Check the main [README.md](README.md) for detailed documentation
- Review configuration files for proper settings
- Ensure all environment variables are set in `.env`
