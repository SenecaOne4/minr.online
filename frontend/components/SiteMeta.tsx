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
    // Update favicon
    if (settings?.favicon_url) {
      const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (link) {
        link.href = settings.favicon_url;
      } else {
        const newLink = document.createElement('link');
        newLink.rel = 'icon';
        newLink.href = settings.favicon_url;
        document.head.appendChild(newLink);
      }
    }

    // Update OG tags
    if (settings?.og_image_url) {
      updateMetaTag('og:image', settings.og_image_url);
    }
    if (settings?.hero_title) {
      updateMetaTag('og:title', settings.hero_title);
      updateMetaTag('twitter:title', settings.hero_title);
    }
    if (settings?.hero_subtitle) {
      updateMetaTag('og:description', settings.hero_subtitle);
      updateMetaTag('twitter:description', settings.hero_subtitle);
    }
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

