import { getClients } from './auth'
import { config } from '../env'
import { logger } from '../logger'

export interface ReviewImage {
  id: string
  url: string
  width?: number
  height?: number
  mimeType: string
}

export async function listReviewImages(): Promise<ReviewImage[]> {
  const folderId = config.GOOGLE_DRIVE_FOLDER_ID
  
  if (!folderId) {
    logger.warn('GOOGLE_DRIVE_FOLDER_ID is not set')
    return []
  }

  try {
    const { drive } = getClients()
    
    // Query to list only images in the specific folder that are not trashed
    const query = `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`
    
    const response = await drive.files.list({
      q: query,
      // We need id, webContentLink (download link), and imageMediaMetadata for dimensions
      fields: 'files(id, webContentLink, mimeType, imageMediaMetadata, thumbnailLink)',
      pageSize: 100, // Limit to 100 reviews for now
    })

    const files = response.data.files || []

    // Map to our interface
    return files.map(file => {
        // Use thumbnailLink with a large size (s0) or webContentLink as fallback.
        // thumbnailLink is often better for direct embedding as it doesn't require redirect handling/cookies sometimes.
        // But for full quality, let's try to construct a viewable link.
        // Actually, 'thumbnailLink' usually allows public view if file is shared, but here we use service account.
        // We might need to use a proxy or the 'thumbnailLink' provided by Drive API which is accessible.
        // Let's prefer 'thumbnailLink' with size parameter 's1000' (1000px width) to get a good quality image.
        // Default thumbnailLink usually ends with '=s220'. We can replace it.
        
        let url = file.thumbnailLink 
            ? file.thumbnailLink.replace('=s220', '=s1000') 
            : file.webContentLink;

        return {
          id: file.id!,
          // If no thumbnail link, fallback to webContentLink (might have CORS issues directly, but let's test)
          url: url || '',
          width: file.imageMediaMetadata?.width || undefined,
          height: file.imageMediaMetadata?.height || undefined,
          mimeType: file.mimeType!,
        }
    }).filter(img => img.url) // Filter out any without URL

  } catch (error) {
    logger.error({ err: error }, 'Error listing review images from Drive:')
    return []
  }
}
