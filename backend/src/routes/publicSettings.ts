import { Router, Response } from 'express';
import { supabase } from '../supabaseClient';

const router: Router = Router();
const SETTINGS_ID = '00000000-0000-0000-0000-000000000000';

// GET /api/admin/settings/public - Get public site settings (no auth required)
router.get('/', async (req, res: Response) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }

    const { data, error } = await supabase
      .from('site_settings')
      .select('hero_title, hero_subtitle, hero_image_url, navigation_items, admin_btc_wallet')
      .eq('id', SETTINGS_ID)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
      console.error('[publicSettings] Error fetching public settings:', error);
      return res.status(404).json({ error: 'Public settings not found' });
    }

    res.json(data || {
      hero_title: null,
      hero_subtitle: null,
      hero_image_url: null,
      navigation_items: null,
      admin_btc_wallet: null,
    });
  } catch (error: any) {
    console.error('[publicSettings] Internal server error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

