import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { MessageDTO, SendMessageRequest } from '@/lib/messaging/types'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get('conversation_id')
    const limit = parseInt(searchParams.get('limit') || '30')
    const cursor = searchParams.get('cursor')

    if (!conversationId) {
      return NextResponse.json({ error: 'conversation_id required' }, { status: 400 })
    }

    const { data: conv } = await supabase
      .from('conversations')
      .select('tourist_id, guide_id')
      .eq('id', conversationId)
      .single()

    if (!conv || (conv.tourist_id !== user.id && conv.guide_id !== user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let query = supabase
      .from('messages')
      .select(`
        id,
        conversation_id,
        sender_id,
        content,
        body,
        read_at,
        is_read,
        created_at,
        sender:sender_id(id, full_name, avatar_url)
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (cursor) {
      query = query.lt('created_at', cursor)
    }

    const { data: messages, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(messages || [])
  } catch (error) {
    console.error('Messages fetch error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { conversation_id, content, body: bodyText } = body
    const messageContent = content || bodyText

    if (!conversation_id || !messageContent?.trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: conv } = await supabase
      .from('conversations')
      .select('tourist_id, guide_id')
      .eq('id', conversation_id)
      .single()

    if (!conv || (conv.tourist_id !== user.id && conv.guide_id !== user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: message, error: msgError } = await supabase
      .from('messages')
      .insert({
        conversation_id,
        sender_id: user.id,
        content: messageContent.trim(),
        body: messageContent.trim()
      })
      .select(`
        id,
        conversation_id,
        sender_id,
        content,
        body,
        read_at,
        is_read,
        created_at,
        sender:sender_id(id, full_name, avatar_url)
      `)
      .single()

    if (msgError) {
      return NextResponse.json({ error: msgError.message }, { status: 400 })
    }

    await supabase
      .from('conversations')
      .update({ 
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', conversation_id)

    return NextResponse.json(message, { status: 201 })
  } catch (error) {
    console.error('Message send error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
