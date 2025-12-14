# Email Template File Locations

Here's exactly which files to copy into which Supabase templates:

## Template Mapping

| Supabase Template Name | File to Copy | Location |
|------------------------|--------------|----------|
| **Magic Link** (or "Sign in") | `magic-link.html` | `supabase/email-templates/magic-link.html` |
| **Signup** (or "Confirm signup") | `signup-confirmation.html` | `supabase/email-templates/signup-confirmation.html` |
| **Reset Password** | `password-reset.html` | `supabase/email-templates/password-reset.html` |
| **Change Email Address** | `email-change.html` | `supabase/email-templates/email-change.html` |

## How to Copy Templates

### Step 1: Open the Template File

1. Open the file from `supabase/email-templates/` in your code editor
2. Select **ALL** content (Ctrl+A / Cmd+A)
3. Copy it (Ctrl+C / Cmd+C)

### Step 2: Paste into Supabase

1. Go to Supabase Dashboard → **Authentication** → **Email Templates**
2. Click on the template name (e.g., "Magic Link")
3. You'll see an HTML editor
4. Select all existing content and delete it
5. Paste your copied HTML
6. Click **"Save"** or **"Update"**

### Step 3: Verify

After saving, test by:
- Requesting a magic link sign-in
- Creating a new account
- Requesting password reset

Check that emails arrive with your custom styling.

## Quick Copy Commands

If you're on Mac/Linux, you can quickly view files:

```bash
# View magic link template
cat supabase/email-templates/magic-link.html

# View signup template  
cat supabase/email-templates/signup-confirmation.html

# View password reset template
cat supabase/email-templates/password-reset.html

# View email change template
cat supabase/email-templates/email-change.html
```

## Template Variables

These Supabase variables will be automatically replaced:
- `{{ .ConfirmationURL }}` → The sign-in/confirmation link
- `{{ .SiteURL }}` → Your site URL
- `{{ .Email }}` → User's email address
- `{{ .Token }}` → Confirmation token (some templates)

Don't modify these - they're required for emails to work!

