'use client';

import { useEffect } from 'react';

interface SiteSettings {
  favicon_url?: string;
  logo_url?: string;
  og_image_url?: string;
  hero_title?: string;
  hero_subtitle?: string;
}

interface SiteMetaProps {
  settings?: SiteSettings;
}

export default function SiteMeta({ settings }: SiteMetaProps) {
  useEffect(() => {
    // Update favicon - update all favicon links
    if (settings?.favicon_url) {
      // Update standard favicon
      let link = document.querySelector("link[rel='icon']") as HTMLLinkElement;
      if (link) {
        link.href = settings.favicon_url;
      } else {
        link = document.createElement('link');
        link.rel = 'icon';
        link.href = settings.favicon_url;
        document.head.appendChild(link);
      }
      
      // Update all size-specific favicons
      const sizes = ['16x16', '32x32', '96x96', '192x192'];
      sizes.forEach(size => {
        let sizeLink = document.querySelector(`link[rel='icon'][sizes='${size}']`) as HTMLLinkElement;
        if (sizeLink) {
          sizeLink.href = settings.favicon_url!;
        } else {
          sizeLink = document.createElement('link');
          sizeLink.rel = 'icon';
          sizeLink.type = 'image/png';
          sizeLink.sizes = size;
          sizeLink.href = settings.favicon_url!;
          document.head.appendChild(sizeLink);
        }
      });
      
      // Update Apple touch icon
      let appleLink = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement;
      if (appleLink) {
        appleLink.href = settings.favicon_url;
      } else {
        appleLink = document.createElement('link');
        appleLink.rel = 'apple-touch-icon';
        appleLink.sizes = '180x180';
        appleLink.href = settings.favicon_url;
        document.head.appendChild(appleLink);
      }
    }

    // Update OG tags for social sharing (iOS iMessages, etc.)
    // iOS requires og:image:width and og:image:height for proper display
    if (settings?.og_image_url) {
      updateMetaTag('og:image', settings.og_image_url);
      updateMetaTag('og:image:url', settings.og_image_url);
      updateMetaTag('og:image:secure_url', settings.og_image_url);
      updateMetaTag('og:image:type', 'image/png');
      updateMetaTag('og:image:width', '1200');
      updateMetaTag('og:image:height', '630');
      updateMetaTag('og:image:alt', 'Minr.online - Bitcoin Lottery Pool Mining Platform');
      updateMetaTag('twitter:image', settings.og_image_url);
      updateMetaTag('twitter:image:src', settings.og_image_url);
    } else if (settings?.logo_url) {
      // Fallback to logo if no OG image
      updateMetaTag('og:image', settings.logo_url);
      updateMetaTag('og:image:width', '1200');
      updateMetaTag('og:image:height', '630');
      updateMetaTag('og:image:alt', 'Minr.online Logo');
      updateMetaTag('twitter:image', settings.logo_url);
    } else if (settings?.favicon_url) {
      // Fallback to favicon if no logo or OG image
      updateMetaTag('og:image', settings.favicon_url);
      updateMetaTag('og:image:width', '512');
      updateMetaTag('og:image:height', '512');
      updateMetaTag('og:image:alt', 'Minr.online Favicon');
      updateMetaTag('twitter:image', settings.favicon_url);
    }
    
    if (settings?.hero_title) {
      updateMetaTag('og:title', settings.hero_title);
      updateMetaTag('twitter:title', settings.hero_title);
    }
    if (settings?.hero_subtitle) {
      updateMetaTag('og:description', settings.hero_subtitle);
      updateMetaTag('twitter:description', settings.hero_subtitle);
    }
    
    // Ensure og:url is set for proper link previews
    updateMetaTag('og:url', window.location.origin);
    updateMetaTag('og:type', 'website');
    updateMetaTag('og:site_name', 'Minr.online');
  }, [settings]);

  const updateMetaTag = (property: string, content: string) => {
    const selector = property.startsWith('og:') || property.startsWith('twitter:')
      ? `meta[property="${property}"]`
      : `meta[name="${property}"]`;
    
    let meta = document.querySelector(selector) as HTMLMetaElement;
    if (!meta) {
      meta = document.createElement('meta');
      if (property.startsWith('og:') || property.startsWith('twitter:')) {
        meta.setAttribute('property', property);
      } else {
        meta.setAttribute('name', property);
      }
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', content);
  };

  return null; // This component only updates meta tags, no UI
}

