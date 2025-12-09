'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageCircle, Plus, Send, Loader2, Copy, Check, Upload, X, File, AlertCircle, Mail } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

interface Message {
  id: string
  content: string
  sender: 'user' | 'ai'
  timestamp: Date
}

interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: Date
}

interface Document {
  id: string
  name: string
  uploadedAt: Date
  status: 'uploading' | 'success' | 'error'
  error?: string
}

export default function HomePage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [uploadingFile, setUploadingFile] = useState(false)
  const [showKB, setShowKB] = useState(false)
  const [showEmailDialog, setShowEmailDialog] = useState(false)
  const [recipientEmail, setRecipientEmail] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailStatus, setEmailStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const AGENT_ID = '693837ffe6ce9b78c389dcc2'
  const RAG_ID = '693837ef0a75a3174182108b'

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentConversation?.messages])

  const createNewConversation = () => {
    const newConv: Conversation = {
      id: Date.now().toString(),
      title: 'New Conversation',
      messages: [],
      createdAt: new Date(),
    }
    setConversations([newConv, ...conversations])
    setCurrentConversation(newConv)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const docId = Date.now().toString()
    const newDoc: Document = {
      id: docId,
      name: file.name,
      uploadedAt: new Date(),
      status: 'uploading',
    }
    setDocuments([newDoc, ...documents])
    setUploadingFile(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('ragId', RAG_ID)

      const response = await fetch('/api/rag', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const data = await response.json()

      setDocuments(prev =>
        prev.map(doc =>
          doc.id === docId
            ? { ...doc, status: 'success' }
            : doc
        )
      )
    } catch (error) {
      setDocuments(prev =>
        prev.map(doc =>
          doc.id === docId
            ? { ...doc, status: 'error', error: 'Failed to upload document' }
            : doc
        )
      )
    } finally {
      setUploadingFile(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const deleteDocument = async (docName: string, docId: string) => {
    try {
      const response = await fetch('/api/rag', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ragId: RAG_ID,
          documents: [docName],
        }),
      })

      if (!response.ok) {
        throw new Error('Delete failed')
      }

      setDocuments(prev => prev.filter(doc => doc.id !== docId))
    } catch (error) {
      console.error('Delete error:', error)
    }
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || !currentConversation) return

    setLoading(true)
    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      sender: 'user',
      timestamp: new Date(),
    }

    const updatedConv = {
      ...currentConversation,
      messages: [...currentConversation.messages, userMessage],
      title: currentConversation.messages.length === 0 ? inputValue.slice(0, 50) : currentConversation.title,
    }
    setCurrentConversation(updatedConv)
    setConversations(conversations.map(c => c.id === updatedConv.id ? updatedConv : c))
    setInputValue('')

    try {
      const conversationContext = updatedConv.messages
        .map(m => `${m.sender === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n')

      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: conversationContext,
          agent_id: AGENT_ID,
        }),
      })

      const data = await response.json()

      if (data.success) {
        const aiResponse = data.response?.result
          ?? data.response?.response
          ?? (typeof data.response === 'string' ? data.response : null)
          ?? data.raw_response
          ?? 'Unable to generate response'

        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: String(aiResponse),
          sender: 'ai',
          timestamp: new Date(),
        }

        const finalConv = {
          ...updatedConv,
          messages: [...updatedConv.messages, aiMessage],
        }
        setCurrentConversation(finalConv)
        setConversations(conversations.map(c => c.id === finalConv.id ? finalConv : c))
      }
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'Sorry, I encountered an error processing your message. Please try again.',
        sender: 'ai',
        timestamp: new Date(),
      }
      const finalConv = {
        ...updatedConv,
        messages: [...updatedConv.messages, errorMessage],
      }
      setCurrentConversation(finalConv)
      setConversations(conversations.map(c => c.id === finalConv.id ? finalConv : c))
    } finally {
      setLoading(false)
    }
  }

  const deleteConversation = (id: string) => {
    const filtered = conversations.filter(c => c.id !== id)
    setConversations(filtered)
    if (currentConversation?.id === id) {
      setCurrentConversation(filtered.length > 0 ? filtered[0] : null)
    }
  }

  const copyMessage = (content: string, id: string) => {
    navigator.clipboard.writeText(content)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const formatTime = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const generateConversationSummary = () => {
    if (!currentConversation || currentConversation.messages.length === 0) {
      return 'No conversation to summarize'
    }

    const messages = currentConversation.messages
      .map(msg => `${msg.sender === 'user' ? 'You' : 'Assistant'}: ${msg.content}`)
      .join('\n\n')

    return `Conversation: ${currentConversation.title}\nDate: ${new Date().toLocaleString()}\n\n${messages}`
  }

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!recipientEmail.trim() || !currentConversation || currentConversation.messages.length === 0) {
      setEmailStatus({ type: 'error', message: 'Please enter an email address and have an active conversation' })
      return
    }

    setSendingEmail(true)
    setEmailStatus(null)

    try {
      const conversationSummary = generateConversationSummary()

      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Please send an email to ${recipientEmail} with the following conversation summary. Make the email professional and well-formatted:\n\n${conversationSummary}`,
          agent_id: AGENT_ID,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setEmailStatus({ type: 'success', message: 'Email sent successfully!' })
        setRecipientEmail('')
        setTimeout(() => {
          setShowEmailDialog(false)
          setEmailStatus(null)
        }, 2000)
      } else {
        setEmailStatus({ type: 'error', message: 'Failed to send email. Please try again.' })
      }
    } catch (error) {
      setEmailStatus({ type: 'error', message: 'Error sending email. Please try again.' })
    } finally {
      setSendingEmail(false)
    }
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? 'w-64' : 'w-0'
        } bg-white border-r border-slate-200 transition-all duration-300 flex flex-col shadow-sm overflow-hidden`}
      >
        <div className="p-4 border-b border-slate-200 space-y-2">
          <Button
            onClick={createNewConversation}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Chat
          </Button>
          <Button
            onClick={() => setShowKB(!showKB)}
            variant={showKB ? 'default' : 'outline'}
            className="w-full"
          >
            <File className="w-4 h-4 mr-2" />
            Knowledge Base
          </Button>
        </div>

        <ScrollArea className="flex-1">
          {showKB ? (
            <div className="p-3 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-2">
                  Documents
                </label>
                <div className="space-y-2">
                  {documents.length === 0 ? (
                    <p className="text-xs text-slate-500">No documents uploaded</p>
                  ) : (
                    documents.map(doc => (
                      <div
                        key={doc.id}
                        className="flex items-start gap-2 p-2 bg-slate-50 rounded border border-slate-200"
                      >
                        <File className="w-3 h-3 text-slate-500 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-900 truncate">
                            {doc.name}
                          </p>
                          {doc.status === 'uploading' && (
                            <p className="text-xs text-slate-500">Uploading...</p>
                          )}
                          {doc.status === 'success' && (
                            <p className="text-xs text-green-600">Uploaded</p>
                          )}
                          {doc.status === 'error' && (
                            <p className="text-xs text-red-600">{doc.error}</p>
                          )}
                        </div>
                        {doc.status !== 'uploading' && (
                          <button
                            onClick={() => deleteDocument(doc.name, doc.id)}
                            className="text-slate-400 hover:text-red-500"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFile}
                variant="outline"
                className="w-full text-sm"
              >
                <Upload className="w-3 h-3 mr-1" />
                {uploadingFile ? 'Uploading...' : 'Upload Document'}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.doc,.docx,.md"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {conversations.map(conv => (
                <div
                  key={conv.id}
                  onClick={() => setCurrentConversation(conv)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    currentConversation?.id === conv.id
                      ? 'bg-blue-100 border-l-4 border-blue-600'
                      : 'hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <MessageCircle className="w-4 h-4 text-slate-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {conv.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {formatTime(conv.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="p-2 border-t border-slate-200">
          <Button
            onClick={() => setSidebarOpen(false)}
            variant="ghost"
            className="w-full text-slate-600"
          >
            Hide
          </Button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <Button
                onClick={() => setSidebarOpen(true)}
                variant="ghost"
                size="sm"
              >
                ☰
              </Button>
            )}
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Knowledge Base Chatbot</h1>
              <div className="flex items-center gap-2">
                <p className="text-sm text-slate-500">Your AI assistant</p>
                {documents.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 border border-blue-200">
                    <File className="w-3 h-3 text-blue-600" />
                    <span className="text-xs text-blue-600 font-medium">{documents.length} document{documents.length !== 1 ? 's' : ''}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
          <Button
            onClick={() => setShowEmailDialog(true)}
            disabled={!currentConversation || currentConversation.messages.length === 0}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Mail className="w-4 h-4" />
            Share via Email
          </Button>
        </div>

        {/* Chat Messages */}
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-4">
            {!currentConversation ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <MessageCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 font-medium mb-2">No conversation selected</p>
                  <p className="text-sm text-slate-400">Start a new chat to begin</p>
                </div>
              </div>
            ) : currentConversation.messages.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <MessageCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 font-medium mb-2">Start a conversation</p>
                  <p className="text-sm text-slate-400">Ask me anything!</p>
                </div>
              </div>
            ) : (
              <>
                {currentConversation.messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`flex gap-2 max-w-2xl ${
                        msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          msg.sender === 'user'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {msg.sender === 'user' ? 'U' : 'AI'}
                      </div>
                      <div
                        className={`rounded-lg px-4 py-2 ${
                          msg.sender === 'user'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-900 border border-slate-200'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {msg.content}
                        </p>
                        <p
                          className={`text-xs mt-1.5 ${
                            msg.sender === 'user'
                              ? 'text-blue-100'
                              : 'text-slate-500'
                          }`}
                        >
                          {msg.timestamp.toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <Button
                        onClick={() => copyMessage(msg.content, msg.id)}
                        variant="ghost"
                        size="sm"
                        className="opacity-0 hover:opacity-100 transition-opacity"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4 text-slate-400" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex gap-3 justify-start">
                    <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center flex-shrink-0">
                      AI
                    </div>
                    <div className="bg-slate-100 rounded-lg px-4 py-3 border border-slate-200">
                      <div className="flex gap-1 items-center">
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={scrollRef} />
              </>
            )}
          </div>
        </ScrollArea>

        {/* Input Area */}
        {currentConversation && (
          <div className="bg-white border-t border-slate-200 p-6 shadow-lg">
            <form onSubmit={sendMessage} className="flex gap-3">
              <Input
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder="Type your message..."
                disabled={loading}
                className="flex-1 border-slate-300 focus:border-blue-500 focus:ring-blue-500"
              />
              <Button
                type="submit"
                disabled={loading || !inputValue.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </form>
          </div>
        )}
      </div>

      {/* Email Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share Conversation via Email</DialogTitle>
            <DialogDescription>
              Send a summary of this conversation to your friend
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSendEmail} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-slate-900">
                Recipient Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="friend@example.com"
                value={recipientEmail}
                onChange={e => setRecipientEmail(e.target.value)}
                disabled={sendingEmail}
                className="border-slate-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            {emailStatus && (
              <Alert className={emailStatus.type === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
                <AlertCircle className={`h-4 w-4 ${emailStatus.type === 'success' ? 'text-green-600' : 'text-red-600'}`} />
                <AlertDescription className={emailStatus.type === 'success' ? 'text-green-800' : 'text-red-800'}>
                  {emailStatus.message}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowEmailDialog(false)
                  setEmailStatus(null)
                  setRecipientEmail('')
                }}
                disabled={sendingEmail}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={sendingEmail || !recipientEmail.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {sendingEmail ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Send Email
                  </>
                )}
              </Button>
            </div>

            <p className="text-xs text-slate-500 text-center">
              The conversation summary will be formatted and sent as a professional email
            </p>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
