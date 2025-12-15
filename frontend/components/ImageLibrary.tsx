'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Image {
  path: string;
  url: string;
}

interface ImageLibraryProps {
  folder?: string;
  onSelect?: (image: Image) => void;
  selectedPath?: string;
}

export default function ImageLibrary({ folder, onSelect, selectedPath }: ImageLibraryProps) {
  const [images, setImages] = useState<Image[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    loadImages();
  }, [folder]);

  const loadImages = async () => {
    try {
      if (!supabase) {
        setLoading(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Use relative URL for NGINX proxy
      const url = folder
        ? `/api/admin/images?folder=${folder}`
        : `/api/admin/images`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setImages(data);
      }
    } catch (error) {
      console.error('Error loading images:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (path: string) => {
    if (!confirm('Are you sure you want to delete this image?')) {
      return;
    }

    setDeleting(path);

    try {
      if (!supabase) return;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Use relative URL for NGINX proxy
      const response = await fetch(`/api/admin/images/${encodeURIComponent(path)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        setImages(images.filter(img => img.path !== path));
      }
    } catch (error) {
      console.error('Error deleting image:', error);
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="text-center text-white py-8">Loading images...</div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="text-center text-gray-400 py-8">No images found</div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {images.map((image) => (
        <div
          key={image.path}
          className={`relative group border-2 rounded-xl overflow-hidden transition-all duration-200 ${
            selectedPath === image.path
              ? 'border-blue-500 ring-2 ring-blue-500/50'
              : 'border-white/20 hover:border-white/40'
          }`}
        >
          <img
            src={image.url}
            alt={image.path}
            className="w-full h-32 object-cover"
            title={`URL: ${image.url}`}
            onError={(e) => {
              // Fallback if image fails to load
              const target = e.target as HTMLImageElement;
              console.error(`[ImageLibrary] Failed to load image:`, {
                url: image.url,
                path: image.path,
                error: 'Image load failed'
              });
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                const placeholder = document.createElement('div');
                placeholder.className = 'w-full h-32 bg-gray-700 flex flex-col items-center justify-center text-gray-400 text-xs p-2';
                placeholder.innerHTML = `
                  <div>Image not found</div>
                  <div class="text-[10px] break-all mt-1">${image.url.substring(0, 50)}...</div>
                `;
                parent.appendChild(placeholder);
              }
            }}
            onLoad={() => {
              console.log(`[ImageLibrary] Successfully loaded image:`, image.url);
            }}
            loading="lazy"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-all duration-200 flex items-center justify-center gap-2">
            {onSelect && (
              <button
                onClick={() => onSelect(image)}
                className="opacity-0 group-hover:opacity-100 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-sm transition-all duration-200"
              >
                Select
              </button>
            )}
            <button
              onClick={() => handleDelete(image.path)}
              disabled={deleting === image.path}
              className="opacity-0 group-hover:opacity-100 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg text-sm transition-all duration-200 disabled:opacity-50"
            >
              {deleting === image.path ? 'Deleting...' : 'Delete'}
            </button>
          </div>
          {selectedPath === image.path && (
            <div className="absolute top-2 right-2 bg-blue-600 text-white text-xs px-2 py-1 rounded">
              Selected
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

