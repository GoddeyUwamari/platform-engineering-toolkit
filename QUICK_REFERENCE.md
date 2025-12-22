# Quick Reference - Platform CLI

## Installation

```bash
cd ~/Desktop/platform-engineering-toolkit/cli
npm install
```

## Setup GitHub (One-time)

```bash
# 1. Create token at: https://github.com/settings/tokens
#    Scopes: repo (all)

# 2. Login
platform github login

# 3. Verify
platform github status
```

## Creating Services

### Without GitHub
```bash
platform create api my-service
platform create microservices my-platform
```

### With GitHub (Public)
```bash
platform create api my-service --github
```

### With GitHub (Private)
```bash
platform create api my-service --github --private
```

### With Custom Description
```bash
platform create api my-service --github --description "My REST API"
```

### Interactive Mode
```bash
platform create
```

## GitHub Commands

| Command | Description |
|---------|-------------|
| `platform github login` | Authenticate with GitHub |
| `platform github logout` | Remove authentication |
| `platform github status` | Show auth status |
| `platform github create` | Create repo for current dir |
| `platform github push` | Push current changes |
| `platform github open` | Open repo in browser |

## Template Commands

| Command | Description |
|---------|-------------|
| `platform list` | List available templates |
| `platform info <template>` | Show template details |
| `platform info api` | API template info |
| `platform info microservices` | Microservices template info |

## General Commands

| Command | Description |
|---------|-------------|
| `platform --help` | Show all commands |
| `platform --version` | Show version |
| `platform github --help` | Show GitHub commands |
| `platform create --help` | Show create options |

## Common Workflows

### 1. Create New API with GitHub
```bash
platform create api my-api --github
cd my-api
npm install
npm run dev
```

### 2. Create Private Microservices Platform
```bash
platform create microservices my-platform --github --private
cd my-platform
npm install
docker-compose up
```

### 3. Interactive Creation
```bash
platform create
# Follow prompts
```

### 4. Add GitHub to Existing Project
```bash
cd my-existing-project
platform github create
```

### 5. Quick Update & Push
```bash
# Make changes
platform github push
```

### 6. Open Repository
```bash
platform github open
```

## Flags Reference

### `create` command flags:
- `-g, --github` - Create GitHub repository
- `-p, --private` - Make repository private
- `-d, --description <desc>` - Custom description

### `github create` command flags:
- `-p, --private` - Make repository private
- `-d, --description <desc>` - Custom description

## Config File Location
```
~/.config/platform-toolkit/config.json
```

## Template Types

| Type | Description | Use Case |
|------|-------------|----------|
| `api` | Node.js/TypeScript REST API | Single service, REST APIs |
| `microservices` | CloudBill SaaS Platform | Multi-service, SaaS platforms |

## Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| "Not authenticated" | `platform github login` |
| "Token expired" | `platform github logout` then `login` |
| "Repository exists" | Choose "Use existing" or rename |
| "Permission denied" | `chmod +x cli/index.js` |
| "Module not found" | `cd cli && npm install` |

## Examples

### Create Public API
```bash
platform create api user-service --github
```

### Create Private API with Description
```bash
platform create api payment-service \
  --github \
  --private \
  --description "Payment processing microservice"
```

### Create Microservices Platform
```bash
platform create microservices saas-platform --github
```

### Add GitHub to Existing
```bash
cd my-project
platform github create --description "My awesome project"
```

## Output Examples

### Success Output
```
✅ Success!

📦 Local:  /Users/user/Desktop/my-api
🔗 GitHub: https://github.com/username/my-api

Git:
  ✔ Repository initialized
  ✔ Initial commit created
  ✔ Pushed to main branch

Next steps:
  cd my-api
  npm install
  npm run dev
```

### Auth Status (Authenticated)
```
✔ Authenticated with GitHub

User:     username
Email:    user@email.com
Profile:  https://github.com/username
Config:   /Users/user/.config/platform-toolkit/config.json
```

### Auth Status (Not Authenticated)
```
⚠️  Not authenticated with GitHub

To authenticate:
  platform github login
```

## Tips

1. **Always authenticate first** if you plan to use GitHub integration
2. **Use interactive mode** for exploratory workflows
3. **Use direct commands** for automation and scripts
4. **Check status** if GitHub commands aren't working
5. **Verify on GitHub** after creating repositories

## Keyboard Shortcuts (Interactive Mode)

- `↑/↓` - Navigate options
- `Enter` - Select option
- `Tab` - Autocomplete (if available)
- `Ctrl+C` - Cancel

## Environment

| Variable | Value |
|----------|-------|
| Node.js | 20.x+ |
| Git | 2.x+ |
| Platform | macOS/Linux |

## Support

- Documentation: `~/Desktop/platform-engineering-toolkit/GITHUB_INTEGRATION.md`
- Testing Guide: `~/Desktop/platform-engineering-toolkit/TESTING_GUIDE.md`
- Issues: Create issue with details

## Cheat Sheet

```bash
# Setup (once)
platform github login

# Create service with GitHub
platform create api my-api --github

# Create private service
platform create api my-api --github --private

# Interactive mode
platform create

# Check status
platform github status

# List templates
platform list

# Template info
platform info api

# Add GitHub to existing
cd project && platform github create

# Quick push
platform github push

# Open in browser
platform github open

# Logout
platform github logout
```
