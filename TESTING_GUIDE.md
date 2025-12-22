# Testing Guide - GitHub Integration

## Quick Start Testing

### Prerequisites
1. Have a GitHub account
2. Create a Personal Access Token at: https://github.com/settings/tokens
   - Scopes needed: `repo` (all)

## Test Sequence

### 1. Test Basic CLI (No GitHub)

```bash
cd ~/Desktop/platform-engineering-toolkit/cli

# Test help
node index.js --help

# Expected output: Shows all commands including 'github'

# Test list
node index.js list

# Expected output: Shows api and microservices templates

# Test info
node index.js info api

# Expected output: Detailed API template information

# Test backward compatibility (create without GitHub)
cd /tmp
node ~/Desktop/platform-engineering-toolkit/cli/index.js create api test-basic
cd test-basic
ls -la  # Should see all template files
git log  # Should see initial commit
cd ..
rm -rf test-basic
```

### 2. Test GitHub Authentication

```bash
cd ~/Desktop/platform-engineering-toolkit/cli

# Test status (not authenticated)
node index.js github status

# Expected output:
# ⚠️  Not authenticated with GitHub
# To authenticate:
#   platform github login

# Test login
node index.js github login

# When prompted, paste your token
# Expected output:
# ✔ Successfully authenticated as [YourUsername]
# Token saved to: /Users/user/.config/platform-toolkit/config.json

# Test status (authenticated)
node index.js github status

# Expected output:
# ✔ Authenticated with GitHub
# User:     [YourUsername]
# Email:    [YourEmail]
# Profile:  https://github.com/[YourUsername]

# Verify config file
cat ~/.config/platform-toolkit/config.json

# Expected: JSON with your token and username
```

### 3. Test Repository Creation with --github Flag

```bash
cd /tmp

# Test public repository creation
node ~/Desktop/platform-engineering-toolkit/cli/index.js create api test-github-public --github

# Expected flow:
# ✔ Service files created
# ✔ Git repository initialized
# ✔ Repository created on GitHub
# ✔ Code pushed to GitHub
#
# ✅ Success!
# 📦 Local:  /private/tmp/test-github-public
# 🔗 GitHub: https://github.com/[YourUsername]/test-github-public

# Verify on GitHub
# Go to: https://github.com/[YourUsername]/test-github-public
# Should see all files pushed

# Cleanup
rm -rf test-github-public

# Delete repo on GitHub:
# Go to repo settings → Delete this repository
```

### 4. Test Private Repository

```bash
cd /tmp

# Test private repository creation
node ~/Desktop/platform-engineering-toolkit/cli/index.js create api test-github-private --github --private

# Expected: Same as above but repository is private

# Verify on GitHub - should see "Private" badge

# Cleanup
rm -rf test-github-private
# Delete repo on GitHub
```

### 5. Test with Custom Description

```bash
cd /tmp

# Test with custom description
node ~/Desktop/platform-engineering-toolkit/cli/index.js create api test-custom-desc --github --description "My awesome REST API"

# Verify on GitHub - repository description should be "My awesome REST API"

# Cleanup
rm -rf test-custom-desc
# Delete repo on GitHub
```

### 6. Test Interactive Mode (Authenticated)

```bash
cd /tmp

# Run interactive mode
node ~/Desktop/platform-engineering-toolkit/cli/index.js create

# Expected prompts:
# ? Select template: (Use arrow keys)
#   Select: api
#
# ? Service name:
#   Enter: test-interactive
#
# ? Create GitHub repository? (Y/n)
#   Enter: Yes
#
# ? Repository visibility:
#   Select: Public
#
# ? Repository description:
#   Enter: Interactive mode test
#
# Expected output: Same success message with GitHub link

# Verify on GitHub

# Cleanup
rm -rf test-interactive
# Delete repo on GitHub
```

### 7. Test github create (For Existing Project)

```bash
cd /tmp

# Create a test project manually
mkdir test-existing
cd test-existing
echo "# Test" > README.md
echo "console.log('test')" > index.js

# Create GitHub repo for it
node ~/Desktop/platform-engineering-toolkit/cli/index.js github create --description "Existing project test"

# Expected:
# ✔ Initializing git repository...
# ✔ Repository created on GitHub
# ✔ Code pushed to GitHub
#
# ✅ Success!
# 🔗 GitHub: https://github.com/[YourUsername]/test-existing

# Verify on GitHub

# Cleanup
cd ..
rm -rf test-existing
# Delete repo on GitHub
```

### 8. Test github open

```bash
cd /tmp
node ~/Desktop/platform-engineering-toolkit/cli/index.js create api test-open --github

cd test-open

# Open in browser
node ~/Desktop/platform-engineering-toolkit/cli/index.js github open

# Expected: Browser opens to repository page

# Cleanup
cd ..
rm -rf test-open
# Delete repo on GitHub
```

### 9. Test github push

```bash
cd /tmp
node ~/Desktop/platform-engineering-toolkit/cli/index.js create api test-push --github

cd test-push

# Make a change
echo "# Updated" >> README.md

# Push changes
node ~/Desktop/platform-engineering-toolkit/cli/index.js github push

# Expected:
# ✔ Pushed to GitHub

# Verify on GitHub - should see new commit

# Cleanup
cd ..
rm -rf test-push
# Delete repo on GitHub
```

### 10. Test Error Handling

#### Test Invalid Token
```bash
# Logout first
node ~/Desktop/platform-engineering-toolkit/cli/index.js github logout

# Login with invalid token
node ~/Desktop/platform-engineering-toolkit/cli/index.js github login
# Enter: invalid_token_123

# Expected:
# ✖ Authentication failed
# Error: Bad credentials
```

#### Test Repository Already Exists
```bash
# First create a repository
cd /tmp
node ~/Desktop/platform-engineering-toolkit/cli/index.js create api test-duplicate --github

# Try to create again (will fail locally due to directory, so delete first)
rm -rf test-duplicate

# Try again
node ~/Desktop/platform-engineering-toolkit/cli/index.js create api test-duplicate --github

# Expected:
# ✖ Repository "test-duplicate" already exists on GitHub
# ? Use existing repository? (Y/n)

# Choose Yes
# Expected: Uses existing repository and pushes

# Cleanup
rm -rf test-duplicate
# Delete repo on GitHub
```

#### Test Without Authentication
```bash
# Logout
node ~/Desktop/platform-engineering-toolkit/cli/index.js github logout

# Try to create with --github flag
cd /tmp
node ~/Desktop/platform-engineering-toolkit/cli/index.js create api test-no-auth --github

# Expected:
# ✔ Service files created
# ✔ Git repository initialized
# ✖ Not authenticated with GitHub
# Run: platform github login

# Cleanup
rm -rf test-no-auth
```

### 11. Test Logout

```bash
# Check status
node ~/Desktop/platform-engineering-toolkit/cli/index.js github status

# Logout
node ~/Desktop/platform-engineering-toolkit/cli/index.js github logout

# Expected:
# ✔ Logged out ([YourUsername])

# Check status again
node ~/Desktop/platform-engineering-toolkit/cli/index.js github status

# Expected:
# ⚠️  Not authenticated with GitHub
```

## Automated Test Script

Create a file `test-github.sh`:

```bash
#!/bin/bash

set -e

CLI_PATH="$HOME/Desktop/platform-engineering-toolkit/cli/index.js"
TEST_DIR="/tmp/platform-test-$$"

echo "Creating test directory: $TEST_DIR"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

test_passed() {
  echo -e "${GREEN}✓ $1${NC}"
}

test_failed() {
  echo -e "${RED}✗ $1${NC}"
  exit 1
}

# Test 1: Help
echo "Testing: Help command"
node "$CLI_PATH" --help > /dev/null 2>&1 && test_passed "Help command" || test_failed "Help command"

# Test 2: List
echo "Testing: List command"
node "$CLI_PATH" list > /dev/null 2>&1 && test_passed "List command" || test_failed "List command"

# Test 3: Info
echo "Testing: Info command"
node "$CLI_PATH" info api > /dev/null 2>&1 && test_passed "Info command" || test_failed "Info command"

# Test 4: GitHub status (no auth)
echo "Testing: GitHub status (no auth)"
node "$CLI_PATH" github status 2>&1 | grep -q "Not authenticated" && test_passed "GitHub status (no auth)" || test_failed "GitHub status (no auth)"

# Test 5: Create without GitHub
echo "Testing: Create without GitHub"
node "$CLI_PATH" create api test-basic > /dev/null 2>&1 && test_passed "Create without GitHub" || test_failed "Create without GitHub"
[ -d "test-basic" ] && test_passed "Directory created" || test_failed "Directory not created"
rm -rf test-basic

# Test 6: GitHub help
echo "Testing: GitHub help"
node "$CLI_PATH" github --help > /dev/null 2>&1 && test_passed "GitHub help" || test_failed "GitHub help"

echo ""
echo "Basic tests passed! ✓"
echo ""
echo "Manual testing required:"
echo "1. platform github login (with real token)"
echo "2. platform create api test --github"
echo "3. Verify on GitHub"
echo ""

# Cleanup
cd /
rm -rf "$TEST_DIR"
```

Run it:
```bash
chmod +x test-github.sh
./test-github.sh
```

## Manual Verification Checklist

After running automated tests, manually verify:

- [ ] GitHub repository created and visible
- [ ] Repository has all template files
- [ ] Commits show up in GitHub
- [ ] README renders correctly
- [ ] Repository visibility (public/private) is correct
- [ ] Repository description is correct
- [ ] Branch is `main` (not `master`)
- [ ] Can clone repository from GitHub
- [ ] `platform github open` opens correct URL

## Cleanup

After all testing, cleanup:

```bash
# Logout from CLI
node ~/Desktop/platform-engineering-toolkit/cli/index.js github logout

# Delete all test repositories from GitHub
# Go to: https://github.com/[YourUsername]?tab=repositories
# Delete repositories starting with "test-"

# Optional: Remove config file
rm ~/.config/platform-toolkit/config.json
```

## Common Issues

### Issue: Permission denied
```bash
chmod +x ~/Desktop/platform-engineering-toolkit/cli/index.js
```

### Issue: Module not found
```bash
cd ~/Desktop/platform-engineering-toolkit/cli
npm install
```

### Issue: Git not found
```bash
# Install git
brew install git  # macOS
```

### Issue: Config file exists
```bash
# Remove old config
rm -rf ~/.config/platform-toolkit
```

## Success Criteria

All tests should:
- ✅ Complete without errors
- ✅ Create repositories on GitHub
- ✅ Push code successfully
- ✅ Show proper error messages
- ✅ Maintain backward compatibility

## Next Steps

After testing, you can:
1. Update README with GitHub integration details
2. Add GitHub Actions for CI/CD to templates
3. Create more templates
4. Add organization support
5. Implement collaborative features
