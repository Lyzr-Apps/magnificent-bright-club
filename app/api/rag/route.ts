import { NextRequest, NextResponse } from 'next/server'

/**
 * RAG Knowledge Base API Routes
 *
 * Secure API endpoints for managing Lyzr RAG Knowledge Base
 *
 * SECURITY:
 * - API keys stored server-side only (never exposed to client)
 * - Environment variable based configuration (LYZR_API_KEY)
 *
 * ENDPOINTS:
 * - GET /api/rag?ragId={id} - Fetch all documents in a knowledge base
 * - POST /api/rag - Upload and train a document (multipart/form-data)
 * - DELETE /api/rag - Delete documents from knowledge base
 *
 * SUPPORTED FILE TYPES:
 * - PDF (.pdf) - application/pdf - Parser: pypdf
 * - DOCX (.docx) - application/vnd.openxmlformats-officedocument.wordprocessingml.document - Parser: docx2txt
 * - TXT (.txt) - text/plain - Parser: txt_parser
 *
 * LYZR RAG API ENDPOINTS USED:
 * - GET https://rag-prod.studio.lyzr.ai/v3/rag/documents/{ragId}/ - List documents
 * - POST https://rag-prod.studio.lyzr.ai/v3/parse/{type}/ - Parse document
 * - POST https://rag-prod.studio.lyzr.ai/v3/rag/train/{ragId}/ - Train knowledge base
 * - DELETE https://rag-prod.studio.lyzr.ai/v3/rag/{ragId}/docs/ - Delete documents
 */

const LYZR_RAG_BASE_URL = 'https://rag-prod.studio.lyzr.ai/v3'

// API key from environment variable only - NO hardcoded fallback!
const LYZR_API_KEY = process.env.LYZR_API_KEY

// Supported file types with their parsers
const FILE_TYPE_CONFIG: Record<string, { type: 'pdf' | 'docx' | 'txt'; parser: string }> = {
  'application/pdf': { type: 'pdf', parser: 'pypdf' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { type: 'docx', parser: 'docx2txt' },
  'text/plain': { type: 'txt', parser: 'txt_parser' },
}

/**
 * GET /api/rag?ragId={id}
 *
 * Fetch all documents in a RAG knowledge base
 *
 * @param ragId - RAG Knowledge Base ID (required query parameter)
 * @returns {success, documents} or {success: false, error}
 *
 * @example Response:
 * {
 *   "success": true,
 *   "documents": [
 *     { "fileName": "report.pdf", "fileType": "pdf", ... }
 *   ]
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Check API key is configured
    if (!LYZR_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: 'LYZR_API_KEY not configured in .env.local',
        },
        { status: 500 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const ragId = searchParams.get('ragId')

    // Validate required field
    if (!ragId) {
      return NextResponse.json(
        {
          success: false,
          error: 'ragId is required as a query parameter',
        },
        { status: 400 }
      )
    }

    // Fetch documents from Lyzr RAG API
    const response = await fetch(`${LYZR_RAG_BASE_URL}/rag/documents/${ragId}/`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-api-key': LYZR_API_KEY,
      },
    })

    if (!response.ok) {
      // Return empty array for 404 (no documents yet)
      if (response.status === 404) {
        return NextResponse.json({
          success: true,
          documents: [],
        })
      }

      const errorText = await response.text()
      return NextResponse.json(
        {
          success: false,
          error: `Failed to fetch documents: ${response.statusText}`,
          details: errorText,
        },
        { status: response.status }
      )
    }

    const rawDocuments = await response.json()

    // Transform string array to RAGDocument objects
    // API returns: ["storage/filename.pdf", "storage/other.txt"]
    const documents = Array.isArray(rawDocuments)
      ? rawDocuments.map((docPath: string) => {
          // Remove "storage/" prefix if present
          const fileName = docPath.startsWith('storage/')
            ? docPath.slice(8)
            : docPath

          // Extract file type from extension
          const ext = fileName.split('.').pop()?.toLowerCase() || ''
          let fileType: 'pdf' | 'docx' | 'txt' = 'txt'
          if (ext === 'pdf') fileType = 'pdf'
          else if (ext === 'docx') fileType = 'docx'

          return {
            fileName,
            fileType,
            status: 'active' as const,
          }
        })
      : []

    return NextResponse.json({
      success: true,
      documents,
      ragId,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('RAG GET error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch documents',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/rag
 *
 * Upload and train a document to RAG knowledge base
 *
 * Request: multipart/form-data with:
 * - file: The document file (PDF, DOCX, or TXT)
 * - ragId: RAG Knowledge Base ID
 *
 * Process:
 * 1. Validate file type and size
 * 2. Parse document using Lyzr Parse API (extracts text chunks)
 * 3. Train knowledge base with parsed document chunks
 *
 * @returns {success, message, documentCount} or {success: false, error}
 *
 * @example Response:
 * {
 *   "success": true,
 *   "message": "Document uploaded and trained successfully",
 *   "documentCount": 42
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Check API key is configured
    if (!LYZR_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: 'LYZR_API_KEY not configured in .env.local',
        },
        { status: 500 }
      )
    }

    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const ragId = formData.get('ragId') as string | null

    // Validate required fields
    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: 'file is required',
        },
        { status: 400 }
      )
    }

    if (!ragId) {
      return NextResponse.json(
        {
          success: false,
          error: 'ragId is required',
        },
        { status: 400 }
      )
    }

    // Validate file type
    const fileConfig = FILE_TYPE_CONFIG[file.type]
    if (!fileConfig) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported file type: ${file.type}. Only PDF, DOCX, and TXT files are supported.`,
        },
        { status: 400 }
      )
    }

    // STEP 1: Parse document using Lyzr Parse API
    const parseFormData = new FormData()
    parseFormData.append('file', file)
    parseFormData.append('data_parser', fileConfig.parser)
    parseFormData.append('extra_info', '{}')

    // Add chunking parameters for PDF (better RAG performance)
    if (fileConfig.type === 'pdf') {
      parseFormData.append('chunk_size', '1000')
      parseFormData.append('chunk_overlap', '100')
    }

    const parseUrl = `${LYZR_RAG_BASE_URL}/parse/${fileConfig.type}/`

    const parseResponse = await fetch(parseUrl, {
      method: 'POST',
      headers: {
        'x-api-key': LYZR_API_KEY,
      },
      body: parseFormData,
    })

    if (!parseResponse.ok) {
      const errorText = await parseResponse.text()
      return NextResponse.json(
        {
          success: false,
          error: `Document parsing failed: ${parseResponse.statusText}`,
          details: errorText,
        },
        { status: 500 }
      )
    }

    const parseResult = await parseResponse.json()

    // Validate parse result
    if (!parseResult.documents || !Array.isArray(parseResult.documents)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid response format from document parsing',
        },
        { status: 500 }
      )
    }

    // STEP 2: Train knowledge base with parsed documents
    const trainUrl = `${LYZR_RAG_BASE_URL}/rag/train/${ragId}/`

    const trainResponse = await fetch(trainUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-api-key': LYZR_API_KEY,
      },
      body: JSON.stringify(parseResult.documents),
    })

    if (!trainResponse.ok) {
      const errorText = await trainResponse.text()
      return NextResponse.json(
        {
          success: false,
          error: `Knowledge base training failed: ${trainResponse.statusText}`,
          details: errorText,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Document uploaded and trained successfully',
      fileName: file.name,
      fileType: fileConfig.type,
      documentCount: parseResult.documents.length,
      ragId,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('RAG POST error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to upload and train document',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/rag
 *
 * Delete documents from a RAG knowledge base
 *
 * Request body:
 * - ragId: RAG Knowledge Base ID
 * - documents: Array of document file names to delete
 *
 * @returns {success: true} or {success: false, error}
 *
 * @example Request body:
 * {
 *   "ragId": "68eba8c8bc2960ccbdf1b1a0",
 *   "documents": ["report.pdf", "notes.txt"]
 * }
 */
export async function DELETE(request: NextRequest) {
  try {
    // Check API key is configured
    if (!LYZR_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: 'LYZR_API_KEY not configured in .env.local',
        },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { ragId, documents } = body

    // Validate required fields
    if (!ragId) {
      return NextResponse.json(
        {
          success: false,
          error: 'ragId is required',
        },
        { status: 400 }
      )
    }

    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'documents array is required and must not be empty',
        },
        { status: 400 }
      )
    }

    // Format documents to include storage/ prefix if not present
    const formattedDocuments = documents.map((doc: string) => {
      if (doc.startsWith('storage/')) {
        return doc
      }
      return `storage/${doc}`
    })

    // Delete documents from Lyzr RAG API
    const deleteUrl = `${LYZR_RAG_BASE_URL}/rag/${ragId}/docs/`

    const response = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-api-key': LYZR_API_KEY,
      },
      body: JSON.stringify(formattedDocuments),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      return NextResponse.json(
        {
          success: false,
          error: `Failed to delete documents: ${response.statusText}`,
          details: errorText,
        },
        { status: response.status }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Documents deleted successfully',
      deletedCount: documents.length,
      ragId,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('RAG DELETE error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete documents',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

/**
 * OPTIONS for CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
