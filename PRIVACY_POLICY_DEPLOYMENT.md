# Privacy Policy Deployment Guide

## Overview
This document provides instructions for publishing the privacy policy to a public URL using GitHub Pages.

## Files Created
The following files have been added to enable public hosting of the privacy policy:

1. **`.github/workflows/deploy-pages.yml`** - GitHub Actions workflow for automatic deployment
2. **`docs/index.html`** - Landing page with link to privacy policy
3. **`docs/privacy-policy.html`** - Copy of the privacy policy for public access
4. **`docs/README.md`** - Documentation about the hosted files

## Enabling GitHub Pages

To make the privacy policy publicly accessible, follow these steps:

### Step 1: Enable GitHub Pages in Repository Settings

1. Go to the repository on GitHub: https://github.com/faaizhipa/3.0
2. Click on **Settings** (top right of the repository page)
3. In the left sidebar, click **Pages** (under "Code and automation")
4. Under **Source**, select:
   - Source: **GitHub Actions** (recommended) or **Deploy from a branch**
   - If using branch: Select **main** or **master** branch and **/docs** folder
5. Click **Save**

### Step 2: Merge the Pull Request

1. Merge this pull request to the main/master branch
2. The GitHub Actions workflow will automatically deploy the documentation

### Step 3: Wait for Deployment

- The workflow will run automatically after merging
- Check the **Actions** tab to monitor deployment progress
- Deployment typically takes 1-2 minutes

## Public URLs

Once GitHub Pages is enabled and the pull request is merged, the privacy policy will be accessible at:

### Main Landing Page
```
https://faaizhipa.github.io/3.0/
```

### Privacy Policy Direct Link
```
https://faaizhipa.github.io/3.0/privacy-policy.html
```

## Verification

To verify the deployment:

1. Visit the URLs above after deployment completes
2. Check that the privacy policy displays correctly
3. Verify all links and formatting are intact

## Updating the Privacy Policy

To update the privacy policy in the future:

1. Edit the file: `privacy-policy.html` in the repository root
2. The workflow will automatically copy it to `docs/privacy-policy.html` on the next update
3. Or directly edit `docs/privacy-policy.html`
4. Commit and push changes to the main/master branch
5. The workflow will automatically redeploy

## Manual Deployment Trigger

The workflow can also be triggered manually:

1. Go to the **Actions** tab
2. Select **Deploy Privacy Policy to GitHub Pages**
3. Click **Run workflow**
4. Select the branch and click **Run workflow**

## Troubleshooting

### Pages Not Showing
- Verify GitHub Pages is enabled in repository settings
- Check that the workflow completed successfully in the Actions tab
- Ensure the repository is public or you have proper access

### 404 Error
- Wait a few minutes after deployment
- Clear browser cache
- Verify the correct URL is being used

### Workflow Failures
- Check the Actions tab for error details
- Verify the `docs` folder contains the required HTML files
- Ensure repository permissions are correct

## Notes

- The privacy policy will be publicly accessible once deployed
- Changes to files in the `docs/` folder will trigger automatic redeployment
- The workflow uses GitHub's official actions for deployment
- No external hosting or services required

## Contact

For issues or questions about the deployment, please open an issue in the repository.
