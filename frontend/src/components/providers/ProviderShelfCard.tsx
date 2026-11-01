"use client";

import React, { useEffect, useState } from "react";
import { Check, Plus } from "lucide-react";
import TVArtworkCard from "@/components/tv/TVArtworkCard";
import MyListTooltip from "@/components/ui/MyListTooltip";
import { addToWishlist, isInWishlist, removeFromWishlist } from "@/lib/wishlist";
import { itemGenres, itemTitle, itemYear, tmdbImage } from "@/lib/tmdbItem";

interface ProviderShelfCardProps {
  item: any;
  onSelect: (item: any) => void;
  collections?: any[];
  onDataRefresh?: () => void;
  priority?: boolean;
  badge?: React.ReactNode;
}

/** Landscape Apple TV card for TMDB items with a My List control. */
export default function ProviderShelfCard({
  item,
  onSelect,
  collections = [],
  onDataRefresh,
  priority,
  badge,
}: ProviderShelfCardProps) {
  const [inList, setInList] = useState(false);

  useEffect(() => {
    setInList(isInWishlist(item.id));
  }, [item.id]);

  const toggle = () => {
    const ok = inList ? removeFromWishlist(item.id) : addToWishlist(item.id);
    if (ok) {
      setInList(!inList);
      onDataRefresh?.();
    }
  };

  const caption = [itemYear(item), ...itemGenres(item, 1)].filter(Boolean).join(" · ");

  return (
    <div className="group/card relative">
      <TVArtworkCard
        title={itemTitle(item)}
        image={tmdbImage(item.backdrop_path || item.poster_path, "w780")}
        caption={caption || undefined}
        badge={badge}
        onSelect={() => onSelect(item)}
        priority={priority}
      />
      {/* Sibling of the card button (buttons can't nest); sits over the artwork corner. */}
      <div className="absolute right-2.5 top-2.5 z-[3] opacity-0 transition-opacity duration-200 group-hover/card:opacity-100 group-focus-within/card:opacity-100 max-md:opacity-100">
        <MyListTooltip
          media={item}
          isInMyList={inList}
          collections={collections}
          onToggleMyList={toggle}
          onAddToCollection={() => onDataRefresh?.()}
          onRemoveFromCollection={() => onDataRefresh?.()}
          onCollectionCreated={() => onDataRefresh?.()}
        >
          <button
            type="button"
            aria-label={inList ? "In My List" : "Add to My List"}
            onClick={(e) => e.stopPropagation()}
            className="tv-glass tv-focus flex h-8 w-8 items-center justify-center rounded-full text-white transition-transform hover:scale-110"
          >
            {inList ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </button>
        </MyListTooltip>
      </div>
    </div>
  );
}
