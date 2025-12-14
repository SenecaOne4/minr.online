import { Router, Response } from 'express';
import { supabase } from '../supabaseClient';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';
import { adminAuthMiddleware } from '../middleware/adminAuth';
import { uploadImage, deleteImage, listImages, validateImageFile } from '../utils/imageUpload';
import multer from 'multer';

const router: Router = Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});
const SETTINGS_ID = '00000000-0000-0000-0000-000000000000';

// All admin routes require authentication and admin access
router.use(authMiddleware);
router.use(adminAuthMiddleware);

// GET /api/admin/settings - Get site settings
router.get('/settings', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }

    const { data, error } = await supabase!
      .from('site_settings')
      .select('*')
      .eq('id', SETTINGS_ID)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Settings not found' });
    }

    res.json(data);
  } catch (error: any) {
    console.error('[admin] Error fetching settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/settings - Update site settings
router.post('/settings', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }

    const userId = req.user!.id;
    const {
      admin_btc_wallet,
      favicon_url,
      logo_url,
      og_image_url,
      hero_title,
      hero_subtitle,
      hero_image_url,
      navigation_items,
    } = req.body;

    const { data, error } = await supabase!
      .from('site_settings')
      .upsert(
        {
          id: SETTINGS_ID,
          admin_btc_wallet,
          favicon_url,
          logo_url,
          og_image_url,
          hero_title,
          hero_subtitle,
          hero_image_url,
          navigation_items: navigation_items ? JSON.parse(JSON.stringify(navigation_items)) : null,
          updated_at: new Date().toISOString(),
          updated_by: userId,
        },
        { onConflict: 'id' }
      )
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(data);
  } catch (error: any) {
    console.error('[admin] Error updating settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/upload-image - Upload image
router.post('/upload-image', upload.single('image'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Validate image
    const validation = validateImageFile(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname
    );

    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Determine folder from query parameter or default to logos
    const folder = (req.query.folder as any) || 'logos';

    // Upload image
    const result = await uploadImage(req.file.buffer, req.file.originalname, folder);

    res.json({
      url: result.url,
      path: result.path,
    });
  } catch (error: any) {
    console.error('[admin] Error uploading image:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// GET /api/admin/images - List all images
router.get('/images', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }

    const folder = req.query.folder as string | undefined;
    const images = await listImages(folder);

    // Get public URLs for each image
    const imagesWithUrls = images.map(path => {
      // Ensure path doesn't have double slashes
      const cleanPath = path.startsWith('/') ? path.substring(1) : path;
      // Remove any leading slashes and ensure proper format
      const normalizedPath = cleanPath.replace(/^\/+/, '');
      const { data } = supabase!.storage.from('site-assets').getPublicUrl(normalizedPath);
      
      // Log for debugging
      console.log(`[admin] Image path: ${path} -> normalized: ${normalizedPath} -> URL: ${data.publicUrl}`);
      
      return {
        path,
        url: data.publicUrl,
      };
    });

    res.json(imagesWithUrls);
  } catch (error: any) {
    console.error('[admin] Error listing images:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// DELETE /api/admin/images/:path - Delete image
router.delete('/images/:path', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }

    const imagePath = decodeURIComponent(req.params.path);
    await deleteImage(imagePath);

    res.json({ success: true });
  } catch (error: any) {
    console.error('[admin] Error deleting image:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// GET /api/admin/payments - View all payments (admin only)
router.get('/payments', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }

    const { data, error } = await supabase!
      .from('payment_requests')
      .select('*, profiles(email, username)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(data || []);
  } catch (error: any) {
    console.error('[admin] Error fetching payments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/payments/verify/:id - Manually verify payment
router.post('/payments/verify/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }

    const paymentId = req.params.id;
    const { tx_hash } = req.body;

    if (!tx_hash) {
      return res.status(400).json({ error: 'Transaction hash required' });
    }

    // Get payment request
    const { data: paymentRequest, error: fetchError } = await supabase!
      .from('payment_requests')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (fetchError || !paymentRequest) {
      return res.status(404).json({ error: 'Payment request not found' });
    }

    // Update payment request
    const { error: updateError } = await supabase!
      .from('payment_requests')
      .update({
        status: 'paid',
        tx_hash,
        paid_at: new Date().toISOString(),
      })
      .eq('id', paymentId);

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    // Update user profile
    await supabase!
      .from('profiles')
      .update({
        has_paid_entry_fee: true,
        entry_fee_paid_at: new Date().toISOString(),
      })
      .eq('id', paymentRequest.user_id);

    res.json({ success: true });
  } catch (error: any) {
    console.error('[admin] Error verifying payment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/users - List all users
router.get('/users', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }

    const { data: profiles, error: profilesError } = await supabase!
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (profilesError) {
      return res.status(400).json({ error: profilesError.message });
    }

    // Get user emails from auth.users
    const userIds = profiles.map(p => p.id);
    const { data: users, error: usersError } = await supabase!
      .auth.admin.listUsers();

    if (usersError) {
      console.error('[admin] Error fetching users:', usersError);
    }

    // Merge profile data with auth user data
    const usersWithProfiles = profiles.map(profile => {
      const authUser = users?.users.find(u => u.id === profile.id);
      return {
        ...profile,
        email: authUser?.email || 'N/A',
        created_at: authUser?.created_at || profile.created_at,
      };
    });

    res.json(usersWithProfiles || []);
  } catch (error: any) {
    console.error('[admin] Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/users/:id/make-admin - Make a user admin
router.post('/users/:id/make-admin', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }

    const userId = req.params.id;

    const { error } = await supabase!
      .from('profiles')
      .update({ is_admin: true })
      .eq('id', userId);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('[admin] Error making user admin:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/users/:id/remove-admin - Remove admin status
router.post('/users/:id/remove-admin', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }

    const userId = req.params.id;

    // Prevent removing yourself
    if (userId === req.user!.id) {
      return res.status(400).json({ error: 'Cannot remove your own admin status' });
    }

    const { error } = await supabase!
      .from('profiles')
      .update({ is_admin: false })
      .eq('id', userId);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('[admin] Error removing admin:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/users/:id/exempt-fee - Exempt user from entry fee
router.post('/users/:id/exempt-fee', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }

    const userId = req.params.id;
    const { exempt } = req.body;

    const { error } = await supabase!
      .from('profiles')
      .update({ 
        exempt_from_entry_fee: exempt !== false,
        has_paid_entry_fee: exempt !== false,
        entry_fee_paid_at: exempt !== false ? new Date().toISOString() : null,
      })
      .eq('id', userId);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('[admin] Error updating fee exemption:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

