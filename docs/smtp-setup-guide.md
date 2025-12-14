# SMTP Setup Guide for Supabase

This guide walks you through setting up custom SMTP in the Supabase dashboard so emails come from `noreply@minr.online`.

## Step-by-Step Instructions

### 1. Access SMTP Settings

1. Log in to your Supabase dashboard: https://supabase.com/dashboard
2. Select your project (`byeokczfgepuecugaikj`)
3. Go to **Project Settings** (gear icon in left sidebar)
4. Click on **Auth** in the settings menu
5. Scroll down to **SMTP Settings** section

### 2. Enable Custom SMTP

1. Toggle **Enable Custom SMTP** to ON
2. You'll see a form with SMTP configuration fields

### 3. Fill in SMTP Details

Enter the following information:

```
Host: mail.listigrepairs.com
Port: 587
Username: noreply@minr.online
Password: Password123!
Sender email: noreply@minr.online
Sender name: Minr.online
```

**Important Notes:**
- **Port 587** is for TLS/STARTTLS (recommended)
- If 587 doesn't work, try **Port 465** (SSL)
- Make sure the password is correct (case-sensitive)

### 4. Test SMTP Connection

**Note:** Supabase may not have a "Send test email" button in newer versions. Instead:

1. **Save your SMTP settings** first (click "Save" or the settings will auto-save)
2. **Test by triggering an actual email:**
   - Go to your site and try to sign in with magic link
   - Or create a new account to trigger signup email
   - Check if email arrives from `noreply@minr.online`
3. If emails don't arrive, check:
   - Password is correct
   - Port number (try 465 if 587 fails)
   - Firewall/security settings allow SMTP
   - SMTP server is accessible
   - Check spam folder

### 5. Update Email Templates

After SMTP is configured, update the email templates:

1. In Supabase dashboard, go to **Authentication** → **Email Templates**
   - You should see a list of template types on the left sidebar
   - If you don't see templates, look for **"Email Templates"** or **"Templates"** tab

2. **Find the template editor:**
   - Click on each template type to edit:
     - **Magic Link** (or "Sign in") → for sign-in emails
     - **Change Email Address** → for email change verification  
     - **Reset Password** → for password reset emails
     - **Signup** (or "Confirm signup") → for welcome emails

3. **For each template:**
   - Click on the template name in the left sidebar
   - You'll see a code editor with HTML content
   - **Copy the entire HTML** from the corresponding file in `supabase/email-templates/`:
     - `magic-link.html` → Magic Link template
     - `email-change.html` → Change Email Address template
     - `password-reset.html` → Reset Password template
     - `signup-confirmation.html` → Signup template
   - **Replace all content** in the editor with the copied HTML
   - Click **"Save"** or **"Update"** button (usually at top right)

4. **Template file locations:**
   - Open `supabase/email-templates/magic-link.html` in your editor
   - Copy everything from `<!DOCTYPE html>` to `</html>`
   - Paste into Supabase Magic Link template editor
   - Repeat for other templates

### 6. Verify Email Sending

1. Test sign-in flow:
   - Go to your site
   - Try to sign in with magic link
   - Check email comes from `noreply@minr.online`
   - Verify email styling matches your brand

2. Test signup flow:
   - Create a new account
   - Check welcome email arrives
   - Verify sender and styling

### 6. Address Spam Warning

If you see a warning about "Untrustworthy TLDs [URI: minr.online (online)]":

**This is just a warning, not an error.** The `.online` TLD is flagged by some spam filters, but emails will still send.

**To improve deliverability:**
1. **Set up SPF record** in your DNS:
   ```
   TXT record: v=spf1 include:mail.listigrepairs.com ~all
   ```

2. **Set up DKIM** (if your SMTP server supports it):
   - Get DKIM key from your SMTP provider
   - Add DNS TXT record with the key

3. **Set up DMARC** (optional but recommended):
   ```
   TXT record: _dmarc.minr.online
   Value: v=DMARC1; p=none; rua=mailto:senecaone4@gmail.com
   ```

4. **Monitor email delivery:**
   - Check spam folder initially
   - As you send more emails, reputation improves
   - Consider using a more trusted TLD for production (e.g., `.com`)

**Note:** The warning won't prevent emails from sending, but some recipients may mark them as spam initially.

## Troubleshooting

### Can't Find Email Templates Section

If you don't see "Email Templates":
- Look for **"Templates"** tab in Authentication section
- Check if you're in the correct project
- Try refreshing the page
- Some Supabase projects may have templates under **"Auth"** → **"Email Templates"**

### SMTP Connection Failed

**Error: "Connection timeout" or "Connection refused"**
- Check if port 587 or 465 is blocked by firewall
- Verify SMTP server hostname is correct
- Try different port (587 → 465 or vice versa)

**Error: "Authentication failed"**
- Double-check username and password
- Ensure password doesn't have extra spaces
- Verify username format (should be full email: `noreply@minr.online`)

**Error: "TLS/SSL error"**
- Try port 465 instead of 587 (uses SSL instead of STARTTLS)
- Check if SMTP server requires specific TLS settings

### Emails Not Arriving

- Check spam/junk folder
- Verify sender email is correct
- Check SMTP server logs (if accessible)
- Test with different email provider

### Emails Arriving But Wrong Styling

- Verify HTML templates were copied correctly
- Check for any Supabase template variables (they should work)
- Test in different email clients (Gmail, Outlook, etc.)

## Template Variables

Supabase provides these variables in templates:
- `{{ .ConfirmationURL }}` - The confirmation/sign-in URL
- `{{ .SiteURL }}` - Your site URL (from project settings)
- `{{ .Email }}` - User's email address
- `{{ .Token }}` - Confirmation token (for some templates)

These are automatically replaced when emails are sent.

## Security Notes

- Keep SMTP password secure
- Don't commit `.env` files with passwords
- Rotate passwords regularly
- Use strong passwords for SMTP account

## Alternative: Use Supabase Default SMTP

If custom SMTP doesn't work, you can use Supabase's default SMTP:
- Emails come from `noreply@mail.app.supabase.io`
- No configuration needed
- Less control over branding
- May have rate limits

To use default: Simply disable "Enable Custom SMTP" toggle.

