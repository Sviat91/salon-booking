import { getCachedReviews } from '@/lib/reviews'
import HomeClient from '@/components/home/HomeClient'

/**
 * Landing Page - Master Selection
 * Server Component that fetches reviews data and renders the client-side home page
 */
export default async function HomePage() {
  // Fetch reviews on the server (cached via Redis)
  const reviews = await getCachedReviews()

  return <HomeClient initialReviews={reviews} />
}
