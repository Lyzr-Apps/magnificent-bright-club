/**
 * File Upload Utility for AI Agent Interactions
 *
 * This utility provides functions to upload files and use them with AI agents.
 * Files are uploaded to secure storage and return asset IDs that can be
 * passed to the agent chat API.
 *
 * @example
 * // Upload a single file
 * const { asset_ids } = await uploadFiles(file)
 *
 * // Upload multiple files
 * const { asset_ids } = await uploadFiles([file1, file2])
 *
 * // Use with agent chat
 * const response = await fetch('/api/agent', {
 *   method: 'POST',
 *   body: JSON.stringify({
 *     message: 'What is in this image?',
 *     agent_id: 'your-agent-id',
 *     assets: asset_ids  // Pass the uploaded asset IDs
 *   })
 * })
 */

export interface UploadedAsset {
  success: boolean
  asset_id: string
  file_name: string
  type: string
  url: string
  file_size: number
  mime_type: string
  created_at: string
  error: string | null
}

export interface UploadResponse {
  success: boolean
  asset_ids: string[]
  assets?: UploadedAsset[]
  total_files?: number
  successful_uploads?: number
  failed_uploads?: number
  message?: string
  error?: string
  timestamp?: string
}

export interface AgentChatWithFilesOptions {
  message: string
  agent_id: string
  files?: File | File[]
  user_id?: string
  session_id?: string
}

/**
 * Upload one or more files to the secure storage
 *
 * @param files - Single file or array of files to upload
 * @returns Promise with asset_ids that can be used in agent chat
 *
 * @example
 * // From file input
 * const input = document.querySelector('input[type="file"]')
 * const { asset_ids } = await uploadFiles(input.files[0])
 *
 * // From drag and drop
 * const { asset_ids } = await uploadFiles(e.dataTransfer.files)
 */
export async function uploadFiles(files: File | File[] | FileList): Promise<UploadResponse> {
  const fileArray = files instanceof FileList
    ? Array.from(files)
    : Array.isArray(files)
      ? files
      : [files]

  if (fileArray.length === 0) {
    return {
      success: false,
      asset_ids: [],
      error: 'No files provided'
    }
  }

  const formData = new FormData()
  for (const file of fileArray) {
    formData.append('files', file)
  }

  try {
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    })

    const data = await response.json()

    if (!response.ok) {
      return {
        success: false,
        asset_ids: [],
        error: data.error || `Upload failed with status ${response.status}`,
      }
    }

    return {
      success: true,
      asset_ids: data.asset_ids || [],
      assets: data.assets,
      message: data.message,
      timestamp: data.timestamp,
    }
  } catch (error) {
    return {
      success: false,
      asset_ids: [],
      error: error instanceof Error ? error.message : 'Upload failed',
    }
  }
}

/**
 * Upload files and immediately chat with an agent about them
 *
 * @param options - Chat options including message, agent_id, and files
 * @returns Promise with the agent's response
 *
 * @example
 * const response = await chatWithFiles({
 *   message: 'What is in this image?',
 *   agent_id: 'your-agent-id',
 *   files: imageFile
 * })
 */
export async function chatWithFiles(options: AgentChatWithFilesOptions) {
  const { message, agent_id, files, user_id, session_id } = options

  let asset_ids: string[] = []

  // Upload files if provided
  if (files) {
    const uploadResult = await uploadFiles(files)
    if (!uploadResult.success) {
      return {
        success: false,
        error: uploadResult.error || 'Failed to upload files',
      }
    }
    asset_ids = uploadResult.asset_ids
  }

  // Call agent API with assets
  try {
    const response = await fetch('/api/agent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        agent_id,
        user_id,
        session_id,
        assets: asset_ids.length > 0 ? asset_ids : undefined,
      }),
    })

    return await response.json()
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Chat request failed',
    }
  }
}

/**
 * Check if a file type is supported for upload
 *
 * @param file - The file to check
 * @returns boolean indicating if the file type is supported
 */
export function isSupportedFileType(file: File): boolean {
  const supportedTypes = [
    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    // Documents
    'application/pdf',
    'text/plain',
    'text/csv',
    'text/markdown',
    // Office documents
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ]

  return supportedTypes.includes(file.type)
}

/**
 * Get a human-readable file size string
 *
 * @param bytes - File size in bytes
 * @returns Formatted string like "1.5 MB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export default uploadFiles
