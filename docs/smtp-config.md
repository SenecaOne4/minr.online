# SMTP Configuration for Minr.online

This guide explains how to configure custom SMTP for Supabase authentication emails.

## SMTP Server Details

- **Host**: `mail.listigrepairs.com`
- **Port**: `587` (TLS) or `465` (SSL)
- **Username**: `noreply@minr.online`
- **Password**: `Password123!`
- **Sender Email**: `noreply@minr.online`
- **Sender Name**: `Minr.online`

## Setup Steps

1. **Access Supabase Dashboard**
   - Log in to your Supabase project
   - Navigate to **Project Settings** → **Auth**

2. **Configure SMTP Settings**
   - Scroll to **SMTP Settings** section
   - Enable **Custom SMTP**
   - Enter the following:
     ```
     Host: mail.listigrepairs.com
     Port: 587
     Username: noreply@minr.online
     Password: Password123!
     Sender email: noreply@minr.online
     Sender name: Minr.online
     ```

3. **Test Configuration**
   - Click **Send test email**
   - Check your inbox for the test email
   - Verify sender address shows as `noreply@minr.online`

4. **Update Email Templates**
   - Go to **Authentication** → **Email Templates**
   - Update templates from `supabase/email-templates/` directory
   - Templates are already branded for Minr.online

## Troubleshooting

### Emails Not Sending

- Verify SMTP credentials are correct
- Check firewall/security settings allow outbound SMTP
- Ensure port 587 is not blocked
- Check SMTP server logs for errors

### Emails Going to Spam

- Set up SPF record for `minr.online` domain
- Set up DKIM signing (if supported by SMTP server)
- Set up DMARC policy
- Use a dedicated IP for sending (if available)

### Authentication Failed

- Double-check username and password
- Verify TLS/SSL settings match server requirements
- Some servers require authentication even for port 587

## Email Template Customization

All email templates are located in `supabase/email-templates/`:
- `magic-link.html` - Sign-in links
- `signup-confirmation.html` - Welcome emails
- `password-reset.html` - Password reset
- `email-change.html` - Email verification

See `supabase/email-templates/README.md` for template setup instructions.

