# Email Templates for Minr.online

This directory contains HTML email templates for Supabase authentication emails.

## Templates

- `magic-link.html` - Magic link sign-in emails
- `signup-confirmation.html` - Welcome email for new users
- `password-reset.html` - Password reset emails
- `email-change.html` - Email change verification emails

## Setup Instructions

1. Log in to your Supabase dashboard
2. Navigate to **Authentication** → **Email Templates**
3. For each template type, click **Edit** and paste the corresponding HTML from this directory
4. Save the template

## Customization

All templates use:
- Dark theme matching the Minr.online brand
- Gradient backgrounds
- Responsive design
- Minr.online branding and messaging

## Template Variables

Supabase provides these variables:
- `{{ .ConfirmationURL }}` - The confirmation/sign-in URL
- `{{ .SiteURL }}` - Your site URL
- `{{ .Email }}` - User's email address

## SMTP Configuration

To use custom SMTP (e.g., `noreply@minr.online`):

1. Go to **Project Settings** → **Auth** → **SMTP Settings**
2. Configure your SMTP server:
   - **Host**: `mail.listigrepairs.com`
   - **Port**: `587` (or your SMTP port)
   - **Username**: `noreply@minr.online`
   - **Password**: Your SMTP password
   - **Sender email**: `noreply@minr.online`
   - **Sender name**: `Minr.online`

3. Test the SMTP configuration
4. Update email templates to use your custom sender

## Testing

After updating templates:
1. Use Supabase's "Send test email" feature
2. Test each template type (sign-in, signup, password reset, email change)
3. Verify emails render correctly in different email clients

