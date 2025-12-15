'use client';

import { useEffect, useState } from 'react';

export default function FaviconLinks() {
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null);

  useEffect(() => {
    // Fetch public settings to get custom favicon
    const fetchFavicon = async () => {
      try {
        const response = await fetch('/api/admin/settings/public');
        if (response.ok) {
          const data = await response.json();
          if (data.favicon_url) {
            setFaviconUrl(data.favicon_url);
          }
        }
      } catch (error) {
        console.error('Error fetching favicon:', error);
      }
    };

    fetchFavicon();
  }, []);

  // Use custom favicon if available, otherwise use defaults
  const favicon = faviconUrl || '/favicon.ico';
  const favicon16 = faviconUrl || '/favicon-16x16.png';
  const favicon32 = faviconUrl || '/favicon-32x32.png';
  const favicon96 = faviconUrl || '/favicon-96x96.png';
  const favicon192 = faviconUrl || '/favicon-192x192.png';
  const appleTouchIcon = faviconUrl || '/apple-touch-icon.png';

  return (
    <>
      <link rel="icon" type="image/x-icon" href={favicon} />
      <link rel="icon" type="image/png" sizes="16x16" href={favicon16} />
      <link rel="icon" type="image/png" sizes="32x32" href={favicon32} />
      <link rel="icon" type="image/png" sizes="96x96" href={favicon96} />
      <link rel="icon" type="image/png" sizes="192x192" href={favicon192} />
      <link rel="apple-touch-icon" sizes="180x180" href={appleTouchIcon} />
    </>
  );
}

