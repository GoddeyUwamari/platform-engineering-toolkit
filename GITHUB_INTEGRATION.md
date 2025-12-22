# GitHub Integration Guide

## Overview

The Platform Engineering Toolkit CLI now includes comprehensive GitHub integration, allowing you to create and manage repositories directly from the command line.

## New Features

### 1. GitHub Authentication
- Secure token storage using `conf` package
- Token validation and verification
- Easy login/logout workflow

### 2. Repository Creation
- One-command repository creation
- Automatic git initialization
- Automatic push to GitHub
- Public/private repository support

### 3. Enhanced Interactive Mode
- GitHub integration in interactive prompts
- Repository visibility selection
- Custom descriptions

### 4. GitHub Management Commands
- Open repository in browser
- Create repository for existing projects
- Push changes quickly

## Installation & Setup

### 1. Dependencies Installed
All required dependencies are already installed:
- `@octokit/rest@^22.0.1` - GitHub API client
- `simple-git@^3.30.0` - Git operations
- `conf@^10.2.0` - Configuration management
- `open@^11.0.0` - Open URLs in browser

### 2. Create GitHub Personal Access Token

1. Go to: https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Name: `platform-toolkit-cli`
4. Select scopes:
   - ✅ **repo** (all) - Full repository access
   - ✅ **workflow** (optional) - Update GitHub Actions
5. Click "Generate token"
6. **Copy the token** (you won't see it again!)

### 3. Authenticate CLI

```bash
platform github login
```

Enter your token when prompted. The CLI will verify it and save it securely to:
```
~/.config/platform-toolkit/config.json
```

## Usage Guide

### GitHub Commands

#### Check Authentication Status
```bash
platform github status
```

Output when authenticated:
```
✔ Authenticated with GitHub

User:     GoddeyUwamari
Email:    goddey@wayuptechnology.com
Profile:  https://github.com/GoddeyUwamari
Config:   /Users/user/.config/platform-toolkit/config.json
```

Output when not authenticated:
```
⚠️  Not authenticated with GitHub

To authenticate:
  platform github login
```

#### Logout
```bash
platform github logout
```

### Creating Services with GitHub

#### Method 1: Direct Command with --github Flag

**Public Repository:**
```bash
platform create api my-awesome-api --github
```

**Private Repository:**
```bash
platform create api my-secret-api --github --private
```

**With Custom Description:**
```bash
platform create api my-api --github --description "Production REST API for XYZ"
```

What happens:
1. ✅ Creates service from template
2. ✅ Initializes git repository
3. ✅ Creates GitHub repository
4. ✅ Adds remote origin
5. ✅ Pushes code to GitHub

#### Method 2: Interactive Mode (Recommended)

```bash
platform create
```

Interactive flow when authenticated:
```
🛠️  Platform Engineering Toolkit

? Select template: (Use arrow keys)
❯ 📦 api           - Production-ready REST API with TypeScript
  🚀 microservices - Multi-tenant SaaS platform architecture

? Service name: my-awesome-api

? Create GitHub repository? (Y/n) Yes

? Repository visibility: (Use arrow keys)
❯ Public
  Private

? Repository description: Production-ready REST API

✔ Service files created
✔ Git repository initialized
✔ Repository created on GitHub
✔ Code pushed to GitHub

✅ Success!

📦 Local:  /Users/user/Desktop/my-awesome-api
🔗 GitHub: https://github.com/GoddeyUwamari/my-awesome-api

Git:
  ✔ Repository initialized
  ✔ Initial commit created
  ✔ Pushed to main branch

Next steps:
  cd my-awesome-api
  npm install
  npm run dev

View on GitHub:
  platform github open
```

#### Method 3: Create Repository for Existing Project

If you already have a local project:

```bash
cd my-existing-project
platform github create
```

With options:
```bash
platform github create --private --description "My awesome project"
```

### Managing Repositories

#### Open Repository in Browser

From within a repository:
```bash
cd my-awesome-api
platform github open
```

This will open the GitHub repository in your default browser.

#### Push Changes

Quick push of current changes:
```bash
cd my-awesome-api
# ... make changes ...
platform github push
```

This will:
1. Stage all changes
2. Create commit with message "Update from platform-toolkit"
3. Push to GitHub

## Configuration

Config file location:
```
~/.config/platform-toolkit/config.json
```

Structure:
```json
{
  "github": {
    "token": "ghp_xxxxxxxxxxxx",
    "username": "GoddeyUwamari",
    "email": "goddey@wayuptechnology.com",
    "defaultVisibility": "public",
    "defaultOrg": null
  },
  "preferences": {
    "autoGitInit": true,
    "autoNpmInstall": false
  }
}
```

## Error Handling

### Token Invalid/Expired
```
✖ Token is invalid or expired

Your token may have expired.
To fix:
  1. Create new token: https://github.com/settings/tokens
  2. Run: platform github login
```

### Repository Already Exists
```
✖ Repository "my-api" already exists on GitHub
? Use existing repository? (Y/n)
```

If you choose Yes, the CLI will use the existing repository.

### Network Errors
```
✖ Failed to create repository
Error: getaddrinfo ENOTFOUND api.github.com

Check your internet connection and try again.
```

### Not Authenticated
```
✖ Not authenticated with GitHub

Run: platform github login
```

## Backward Compatibility

All existing commands still work without GitHub:

```bash
# Create without GitHub
platform create api my-api

# Interactive without GitHub (when not authenticated)
platform create

# List templates
platform list

# Info command
platform info api
```

## Testing Checklist

### Basic Functionality
- [x] `platform --help` shows all commands
- [x] `platform github --help` shows GitHub commands
- [x] `platform github status` works without auth
- [x] `platform list` shows templates
- [x] `platform info api` shows template details
- [x] `platform create api test` creates service (backward compat)

### GitHub Authentication
- [ ] `platform github login` accepts token
- [ ] `platform github login` verifies token with GitHub
- [ ] `platform github status` shows user info when authenticated
- [ ] `platform github logout` removes credentials
- [ ] Config file created at `~/.config/platform-toolkit/config.json`

### Repository Creation
- [ ] `platform create api test --github` creates repo
- [ ] Interactive mode offers GitHub option
- [ ] Private repository flag works (`--private`)
- [ ] Custom description works (`--description`)
- [ ] Repository is accessible on GitHub
- [ ] Code is pushed successfully

### Error Scenarios
- [ ] Invalid token shows helpful error
- [ ] Existing repository offers to use existing
- [ ] Network errors handled gracefully
- [ ] Git not installed shows helpful message

## Example Workflow

```bash
# 1. First time setup
platform github login
# Enter token: ghp_xxxxxxxxxxxx
# ✔ Successfully authenticated as GoddeyUwamari

# 2. Verify authentication
platform github status
# ✔ Authenticated with GitHub

# 3. Create new service with GitHub
platform create api production-api --github --description "Production REST API"
# ✔ Service files created
# ✔ Git repository initialized
# ✔ Repository created on GitHub
# ✔ Code pushed to GitHub

# 4. Navigate to service
cd production-api

# 5. Install dependencies
npm install

# 6. Open on GitHub
platform github open

# 7. Make changes and push
# ... edit files ...
platform github push
```

## Troubleshooting

### Issue: "Conf is not a constructor"
**Solution:** This was fixed by downgrading to conf@10.2.0 (CommonJS compatible)

### Issue: Token not saving
**Check:** Config file permissions at `~/.config/platform-toolkit/config.json`

### Issue: Push fails
**Check:**
1. Git is installed: `git --version`
2. Remote is set: `git remote -v`
3. Branch is main: `git branch`

### Issue: Repository creation fails with 422
**Reason:** Repository already exists on GitHub
**Solution:** The CLI will ask if you want to use the existing repository

## Security Notes

1. **Token Storage**: Tokens are stored in plaintext at `~/.config/platform-toolkit/config.json`
   - Only readable by your user account
   - Never commit this file to version control

2. **Token Scopes**: Use minimal scopes needed
   - Required: `repo` (full repository access)
   - Optional: `workflow` (if using GitHub Actions)

3. **Token Rotation**: Regularly rotate your tokens
   - GitHub recommends 90-day rotation
   - Use `platform github logout` then `platform github login` with new token

## Support

For issues or questions:
- GitHub: https://github.com/GoddeyUwamari/platform-engineering-toolkit
- Create an issue with the `github-integration` label

## What's Next?

Planned enhancements:
- [ ] Organization repository support
- [ ] Collaborative prompts (add collaborators)
- [ ] GitHub Actions workflow templates
- [ ] Branch protection rules setup
- [ ] Issue/PR templates creation
