'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { ReviewImage } from '@/lib/google/drive'

interface ReviewCard extends ReviewImage {
  yOffset: number
  renderWidth: number
  renderHeight: number
}

interface ReviewsMarqueeProps {
  initialReviews: ReviewImage[]
}

export default function ReviewsMarquee({ initialReviews }: ReviewsMarqueeProps) {
  const [reviews, setReviews] = useState<ReviewCard[]>([])

  useEffect(() => {
    if (!initialReviews || initialReviews.length === 0) return

    // Shuffle array
    const shuffled = [...initialReviews].sort(() => Math.random() - 0.5)
    
    // Target height for the marquee items
    const TARGET_HEIGHT = 140

    // Add random visual properties and calculate dimensions
    const processed = shuffled.map(img => {
      const aspectRatio = (img.width && img.height) ? img.width / img.height : 0.8
      const width = TARGET_HEIGHT * aspectRatio

      return {
        ...img,
        renderHeight: TARGET_HEIGHT,
        renderWidth: width,
        yOffset: Math.random() * 20 - 10, // Reduced offset for smaller items
      }
    })

    setReviews(processed)
  }, [initialReviews])

  if (reviews.length === 0) return null

  // Duplicate content for seamless loop
  const marqueeContent = [...reviews, ...reviews, ...reviews]

  return (
    <div className="w-full overflow-hidden py-4 bg-transparent select-none">
      <motion.div
        className="flex gap-6 items-center px-4"
        animate={{
          x: ["0%", "-33.33%"],
        }}
        transition={{
          x: {
            repeat: Infinity,
            repeatType: "loop",
            duration: Math.max(60, reviews.length * 8), // Slower scroll
            ease: "linear",
          },
        }}
        whileHover={{ animationPlayState: "paused" }}
        style={{ width: "fit-content" }}
      >
        {marqueeContent.map((review, index) => (
          <motion.div
            key={`${review.id}-${index}`}
            className="relative flex-shrink-0"
            style={{
              y: review.yOffset,
            }}
            whileHover={{ 
              scale: 1.02, 
              zIndex: 10,
              transition: { duration: 0.2 }
            }}
          >
            <div className="relative overflow-hidden rounded-xl border-[3px] border-white dark:border-zinc-700 shadow-sm hover:shadow-md transition-all duration-300 bg-white dark:bg-zinc-800">
              <Image
                src={review.url}
                alt="Review"
                height={review.renderHeight}
                width={review.renderWidth}
                className="object-cover"
                style={{ height: `${review.renderHeight}px`, width: 'auto' }}
                draggable={false}
                quality={90}
                // Adding unoptimized={true} if standard optimization fails with Drive links, 
                // but trying standard first as per requirement for caching.
              />
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}
