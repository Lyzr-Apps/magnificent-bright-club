import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/upload
 * Secure file upload API that uploads files to Lyzr asset storage
 *
 * SECURITY:
 * - API key stored server-side only (never exposed to client)
 * - Files are forwarded to Lyzr's secure asset storage
 *
 * USAGE:
 * Send multipart/form-data with 'files' field containing the file(s) to upload
 *
 * RETURNS:
 * - asset_ids: Array of asset IDs that can be passed to /api/agent
 * - files: Array of uploaded file details
 *
 * @example
 * const formData = new FormData()
 * formData.append('files', file)
 * const response = await fetch('/api/upload', { method: 'POST', body: formData })
 * const { asset_ids } = await response.json()
 * // Use asset_ids in agent chat: { message: "...", assets: asset_ids }
 */

const LYZR_UPLOAD_URL = 'https://agent-prod.studio.lyzr.ai/v3/assets/upload'

// API key from environment variable only - NO hardcoded fallback!
const LYZR_API_KEY = process.env.LYZR_API_KEY

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

    // Get the form data from the request
    const formData = await request.formData()
    const files = formData.getAll('files')

    if (!files || files.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No files provided. Send files using the "files" form field.',
        },
        { status: 400 }
      )
    }

    // Create a new FormData to forward to Lyzr API
    const uploadFormData = new FormData()

    for (const file of files) {
      if (file instanceof File) {
        uploadFormData.append('files', file, file.name)
      }
    }

    // Upload to Lyzr asset storage
    const response = await fetch(LYZR_UPLOAD_URL, {
      method: 'POST',
      headers: {
        'x-api-key': LYZR_API_KEY,
        // Don't set Content-Type - let fetch set it with boundary for multipart
      },
      body: uploadFormData,
    })

    if (response.ok) {
      const data = await response.json()

      // Extract asset IDs from response
      // Response format: { results: [{ asset_id: "uuid", file_name: "...", ... }], total_files: 1, ... }
      const assetIds = data.results
        ?.filter((r: any) => r.success && r.asset_id)
        ?.map((r: any) => r.asset_id) || []

      return NextResponse.json({
        success: true,
        asset_ids: assetIds,
        assets: data.results || [],
        total_files: data.total_files,
        successful_uploads: data.successful_uploads,
        failed_uploads: data.failed_uploads,
        message: `Successfully uploaded ${data.successful_uploads || files.length} file(s)`,
        timestamp: new Date().toISOString(),
      })
    } else {
      const errorText = await response.text()
      console.error('Upload API error:', response.status, errorText)
      return NextResponse.json(
        {
          success: false,
          error: `Upload failed with status ${response.status}`,
          details: errorText,
        },
        { status: response.status }
      )
    }
  } catch (error) {
    console.error('File upload error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error during file upload',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

// OPTIONS for CORS preflight (if needed)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
