import React, { useState } from 'react';
import ReactPlayer from 'react-player';
import { Play, X } from 'lucide-react';
import { formatCurrency } from '../utils/currency';

interface Video {
  id: number;
  thumbnail: string;
  url: string;
  title: string;
  price: number;
}

interface VideoGalleryProps {
  videos: Video[];
}

export function VideoGallery({ videos }: VideoGalleryProps) {
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {videos.map((video) => (
          <div
            key={video.id}
            className="relative group cursor-pointer rounded-lg overflow-hidden"
            onClick={() => setSelectedVideo(video)}
          >
            <img
              src={video.thumbnail}
              alt={video.title}
              className="w-full h-48 object-cover"
            />
            <div className="absolute inset-0 bg-black bg-opacity-40 group-hover:bg-opacity-50 transition-opacity flex items-center justify-center">
              <Play className="w-12 h-12 text-white opacity-75 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="absolute bottom-0 left-0 right-0 p-2 text-white text-sm bg-gradient-to-t from-black/60">
              {video.title}
            </p>
          </div>
        ))}
      </div>

      {selectedVideo && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
          <div className="relative w-full max-w-4xl bg-black rounded-lg overflow-hidden">
            <button
              onClick={() => setSelectedVideo(null)}
              className="absolute top-4 right-4 text-white z-10 hover:text-gray-300"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="aspect-video">
              <ReactPlayer
                url={selectedVideo.url}
                width="100%"
                height="100%"
                controls
                playing
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
