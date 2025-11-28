'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ReviewImage } from '@/lib/google/drive'

interface ReviewCard extends ReviewImage {
  rotation: number
  yOffset: number
}

export default function ReviewsMarquee() {
  const [reviews, setReviews] = useState<ReviewCard[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchReviews() {
      try {
        const res = await fetch('/api/reviews')
        if (!res.ok) throw new Error('Failed to fetch reviews')
        const data = await res.json()
        
        const images: ReviewImage[] = data.images || []
        
        // Shuffle array
        const shuffled = [...images].sort(() => Math.random() - 0.5)
        
        // Add random visual properties
        const processed = shuffled.map(img => ({
          ...img,
          rotation: Math.random() * 6 - 3, // -3deg to +3deg
          yOffset: Math.random() * 30 - 15, // -15px to +15px
        }))

        setReviews(processed)
      } catch (error) {
        console.error('Error loading reviews:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchReviews()
  }, [])

  if (loading || reviews.length === 0) return null

  // Duplicate content for seamless loop
  // We need enough duplicates to fill the screen width at least twice
  const marqueeContent = [...reviews, ...reviews, ...reviews]

  return (
    <div className="w-full overflow-hidden py-12 bg-transparent select-none">
      <motion.div
        className="flex gap-8 items-center px-4"
        animate={{
          x: ["0%", "-33.33%"], // Move by one set of reviews (since we have 3 sets)
        }}
        transition={{
          x: {
            repeat: Infinity,
            repeatType: "loop",
            duration: Math.max(40, reviews.length * 5), // Adjust speed based on count
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
              rotate: review.rotation,
              y: review.yOffset,
            }}
            whileHover={{ 
              scale: 1.05, 
              rotate: 0, 
              y: 0,
              zIndex: 10,
              transition: { duration: 0.2 }
            }}
          >
            {/* Polaroid Container */}
            <div className="
              bg-white dark:bg-zinc-800 
              p-3 pb-8 
              shadow-xl rounded-sm 
              border border-zinc-100 dark:border-zinc-700
              w-[280px] md:w-[320px]
              transform transition-colors duration-300
            ">
              <div className="aspect-[4/5] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-900 rounded-sm relative">
                {/* Using standard img for simplicity with external URLs, or next/image if domains allowed */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={review.url}
                  alt="Review"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}
