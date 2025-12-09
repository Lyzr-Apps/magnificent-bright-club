/**
 * RAG Knowledge Base Utility
 *
 * Secure wrapper for managing Lyzr RAG Knowledge Base through Next.js API routes
 * API keys are stored server-side only - never exposed to the client!
 *
 * SUPPORTED FILE TYPES:
 * - PDF (.pdf) - application/pdf
 * - DOCX (.docx) - application/vnd.openxmlformats-officedocument.wordprocessingml.document
 * - TXT (.txt) - text/plain
 *
 * @example
 * ```tsx
 * import { getDocuments, uploadAndTrainDocument, deleteDocuments } from '@/utils/ragKnowledgeBase'
 *
 * // Get all documents in a knowledge base
 * const docs = await getDocuments('your-rag-id')
 *
 * // Upload and train a document
 * const result = await uploadAndTrainDocument('your-rag-id', file)
 *
 * // Delete documents from knowledge base
 * await deleteDocuments('your-rag-id', ['document1.pdf', 'document2.txt'])
 * ```
 */

import React from 'react'

// Secure: Call through Next.js API route (API key is on server!)
const API_ROUTE = '/api/rag'

/**
 * Supported file MIME types for RAG knowledge base
 * - PDF: 'application/pdf'
 * - DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
 * - TXT: 'text/plain'
 */
export const SUPPORTED_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
] as const

export type SupportedFileType = typeof SUPPORTED_FILE_TYPES[number]

/**
 * File extension to MIME type mapping
 */
export const FILE_EXTENSION_MAP: Record<string, SupportedFileType> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
}

export interface RAGDocument {
  id?: string
  fileName: string
  fileType: 'pdf' | 'docx' | 'txt'
  fileSize?: number
  status?: 'processing' | 'active' | 'failed' | 'deleted'
  uploadedAt?: string
  documentCount?: number
}

export interface GetDocumentsResponse {
  success: boolean
  documents?: RAGDocument[]
  error?: string
  details?: string
}

export interface UploadResponse {
  success: boolean
  message?: string
  documentId?: string
  documentCount?: number
  error?: string
  details?: string
}

export interface DeleteResponse {
  success: boolean
  message?: string
  error?: string
  details?: string
}

/**
 * Check if a file type is supported for RAG upload
 *
 * @param fileType - MIME type of the file
 * @returns true if the file type is supported
 *
 * @example
 * ```tsx
 * if (isFileTypeSupported(file.type)) {
 *   await uploadAndTrainDocument(ragId, file)
 * }
 * ```
 */
export function isFileTypeSupported(fileType: string): fileType is SupportedFileType {
  return SUPPORTED_FILE_TYPES.includes(fileType as SupportedFileType)
}

/**
 * Get file type enum from MIME type
 *
 * @param mimeType - MIME type of the file
 * @returns 'pdf' | 'docx' | 'txt' or null if not supported
 *
 * @example
 * ```tsx
 * const fileTypeEnum = getFileTypeFromMime(file.type)
 * // Returns 'pdf', 'docx', 'txt', or null
 * ```
 */
export function getFileTypeFromMime(mimeType: string): 'pdf' | 'docx' | 'txt' | null {
  switch (mimeType) {
    case 'application/pdf':
      return 'pdf'
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return 'docx'
    case 'text/plain':
      return 'txt'
    default:
      return null
  }
}

/**
 * Validate a file before upload
 *
 * @param file - File to validate
 * @returns Object with isValid boolean and error message if invalid
 *
 * @example
 * ```tsx
 * const validation = validateFile(file)
 * if (!validation.isValid) {
 *   console.error(validation.error)
 * }
 * ```
 */
export function validateFile(file: File): { isValid: boolean; error?: string } {
  // Check file type
  if (!isFileTypeSupported(file.type)) {
    return {
      isValid: false,
      error: `Unsupported file type: ${file.type}. Only PDF, DOCX, and TXT files are supported.`,
    }
  }

  return { isValid: true }
}

/**
 * Get all documents in a RAG knowledge base (SECURE - via Next.js API route)
 *
 * @param ragId - RAG Knowledge Base ID (required)
 * @returns Promise with list of documents
 *
 * @example
 * ```tsx
 * const result = await getDocuments('68eba8c8bc2960ccbdf1b1a0')
 *
 * if (result.success) {
 *   result.documents?.forEach(doc => {
 *     console.log(doc.fileName, doc.status)
 *   })
 * }
 * ```
 */
export async function getDocuments(ragId: string): Promise<GetDocumentsResponse> {
  try {
    if (!ragId) {
      return {
        success: false,
        error: 'ragId is required',
      }
    }

    const response = await fetch(`${API_ROUTE}?ragId=${encodeURIComponent(ragId)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (response.ok) {
      const data = await response.json()
      return data
    } else {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      return {
        success: false,
        error: errorData.error || `API returned status ${response.status}`,
        details: errorData.details,
      }
    }
  } catch (error) {
    console.error('Get documents failed:', error)
    return {
      success: false,
      error: 'Failed to get documents',
      details: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Upload and train a document to RAG knowledge base (SECURE - via Next.js API route)
 *
 * Supports PDF, DOCX, and TXT files up to 100MB.
 * The document will be parsed and added to the knowledge base for RAG retrieval.
 *
 * @param ragId - RAG Knowledge Base ID (required)
 * @param file - File to upload (PDF, DOCX, or TXT)
 * @returns Promise with upload result
 *
 * @example
 * ```tsx
 * // Upload from file input
 * const fileInput = document.querySelector('input[type="file"]')
 * const file = fileInput.files[0]
 *
 * const result = await uploadAndTrainDocument('68eba8c8bc2960ccbdf1b1a0', file)
 *
 * if (result.success) {
 *   console.log('Document uploaded:', result.documentId)
 *   console.log('Chunks created:', result.documentCount)
 * }
 * ```
 */
export async function uploadAndTrainDocument(
  ragId: string,
  file: File
): Promise<UploadResponse> {
  try {
    if (!ragId) {
      return {
        success: false,
        error: 'ragId is required',
      }
    }

    // Validate file
    const validation = validateFile(file)
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.error,
      }
    }

    // Create FormData for file upload
    const formData = new FormData()
    formData.append('file', file)
    formData.append('ragId', ragId)

    const response = await fetch(API_ROUTE, {
      method: 'POST',
      body: formData,
      // Note: Don't set Content-Type header - browser will set it with boundary for FormData
    })

    if (response.ok) {
      const data = await response.json()
      return data
    } else {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      return {
        success: false,
        error: errorData.error || `API returned status ${response.status}`,
        details: errorData.details,
      }
    }
  } catch (error) {
    console.error('Upload document failed:', error)
    return {
      success: false,
      error: 'Failed to upload document',
      details: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Delete documents from RAG knowledge base (SECURE - via Next.js API route)
 *
 * @param ragId - RAG Knowledge Base ID (required)
 * @param documents - Array of document file names to delete
 * @returns Promise with delete result
 *
 * @example
 * ```tsx
 * // Delete single document
 * const result = await deleteDocuments('68eba8c8bc2960ccbdf1b1a0', ['report.pdf'])
 *
 * // Delete multiple documents
 * const result = await deleteDocuments('68eba8c8bc2960ccbdf1b1a0', [
 *   'report.pdf',
 *   'data.txt',
 *   'notes.docx'
 * ])
 *
 * if (result.success) {
 *   console.log('Documents deleted successfully')
 * }
 * ```
 */
export async function deleteDocuments(
  ragId: string,
  documents: string[]
): Promise<DeleteResponse> {
  try {
    if (!ragId) {
      return {
        success: false,
        error: 'ragId is required',
      }
    }

    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return {
        success: false,
        error: 'documents array is required and must not be empty',
      }
    }

    const response = await fetch(API_ROUTE, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ragId,
        documents,
      }),
    })

    if (response.ok) {
      const data = await response.json()
      return data
    } else {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      return {
        success: false,
        error: errorData.error || `API returned status ${response.status}`,
        details: errorData.details,
      }
    }
  } catch (error) {
    console.error('Delete documents failed:', error)
    return {
      success: false,
      error: 'Failed to delete documents',
      details: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Hook for using RAG Knowledge Base in React components
 *
 * Provides state management for loading, errors, and document operations.
 *
 * @example
 * ```tsx
 * function KnowledgeBaseManager() {
 *   const {
 *     documents,
 *     loading,
 *     error,
 *     fetchDocuments,
 *     uploadDocument,
 *     removeDocuments
 *   } = useRAGKnowledgeBase()
 *
 *   useEffect(() => {
 *     fetchDocuments('your-rag-id')
 *   }, [])
 *
 *   async function handleUpload(file: File) {
 *     await uploadDocument('your-rag-id', file)
 *   }
 *
 *   async function handleDelete(fileName: string) {
 *     await removeDocuments('your-rag-id', [fileName])
 *   }
 *
 *   return (
 *     <div>
 *       {loading && <p>Loading...</p>}
 *       {error && <p>Error: {error}</p>}
 *       {documents?.map(doc => (
 *         <div key={doc.fileName}>
 *           {doc.fileName} - {doc.status}
 *           <button onClick={() => handleDelete(doc.fileName)}>Delete</button>
 *         </div>
 *       ))}
 *     </div>
 *   )
 * }
 * ```
 */
export function useRAGKnowledgeBase() {
  const [documents, setDocuments] = React.useState<RAGDocument[] | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  /**
   * Fetch all documents from a RAG knowledge base
   */
  const fetchDocuments = async (ragId: string) => {
    setLoading(true)
    setError(null)

    const result = await getDocuments(ragId)

    if (result.success) {
      setDocuments(result.documents || [])
    } else {
      setError(result.error || 'Failed to fetch documents')
    }

    setLoading(false)
    return result
  }

  /**
   * Upload and train a document
   */
  const uploadDocument = async (ragId: string, file: File) => {
    setLoading(true)
    setError(null)

    const result = await uploadAndTrainDocument(ragId, file)

    if (!result.success) {
      setError(result.error || 'Failed to upload document')
    }

    setLoading(false)
    return result
  }

  /**
   * Delete documents from knowledge base
   */
  const removeDocuments = async (ragId: string, documentNames: string[]) => {
    setLoading(true)
    setError(null)

    const result = await deleteDocuments(ragId, documentNames)

    if (result.success) {
      // Remove deleted documents from local state
      setDocuments(prev =>
        prev ? prev.filter(doc => !documentNames.includes(doc.fileName)) : null
      )
    } else {
      setError(result.error || 'Failed to delete documents')
    }

    setLoading(false)
    return result
  }

  return {
    documents,
    loading,
    error,
    fetchDocuments,
    uploadDocument,
    removeDocuments,
  }
}
