# Supabase Email Configuration Guide

## Problem
Clinician invite emails are not being sent because Supabase email settings need to be configured.

## Solution: Configure Supabase Email Settings

### Step 1: Enable Email Auth in Supabase Dashboard

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/fhssbrbwemammanvnaji
2. Navigate to **Authentication** → **Providers**
3. Find **Email** provider and ensure it's **enabled**
4. Make sure "Confirm email" is enabled

### Step 2: Configure Site URL and Redirect URLs

1. In Supabase Dashboard, go to **Authentication** → **URL Configuration**
2. Set **Site URL** to your application URL:
   - For local development: `http://localhost:3000`
   - For production: `https://www.verawaycare.com`

3. Add **Redirect URLs** (whitelist these URLs):
   - `http://localhost:3000/invite`
   - `http://localhost:3000/auth/callback`
   - `https://www.verawaycare.com/invite`
   - `https://www.verawaycare.com/auth/callback`

### Step 3: Configure Email Templates

1. Go to **Authentication** → **Email Templates**
2. Find the **"Invite user"** template
3. Make sure it's enabled and configured
4. The default template should work, but you can customize it if needed

### Step 4: SMTP Configuration (For Production)

For production deployments, you should configure custom SMTP:

1. Go to **Project Settings** → **Auth**
2. Scroll to **SMTP Settings**
3. Configure your email provider (e.g., SendGrid, AWS SES, Resend, etc.)
4. Test the connection

**Note:** Supabase has email rate limits on the free tier (3-4 emails/hour). For production, use custom SMTP.

### Step 5: Verify Email Rate Limits

1. Go to **Authentication** → **Rate Limits**
2. Check if you've hit any rate limits
3. If needed, upgrade your plan or configure custom SMTP

## Testing the Fix

After configuring the above settings:

1. Restart your Next.js development server:
   ```bash
   npm run dev
   ```

2. Try inviting a clinician again from the onboarding page

3. Check the browser console for any errors

4. Check Supabase Dashboard → **Authentication** → **Users** to see if the user was created

5. Check your email inbox (and spam folder)

## Common Issues

### Issue: "Email rate limit exceeded"
**Solution:** Configure custom SMTP or wait for the rate limit to reset (1 hour)

### Issue: "Invalid redirect URL"
**Solution:** Make sure the redirect URL is whitelisted in URL Configuration

### Issue: "Email not confirmed"
**Solution:** Check if "Confirm email" is enabled in Email Provider settings

### Issue: "SMTP error"
**Solution:** Verify SMTP credentials and test the connection

## Environment Variables

Make sure these are set in your `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=https://fhssbrbwemammanvnaji.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000  # For production: https://www.verawaycare.com
```

## Production Deployment

For production (Vercel, Netlify, etc.), add these environment variables:

```env
NEXT_PUBLIC_SITE_URL=https://www.verawaycare.com
```

And configure your production redirect URLs in Supabase dashboard.
