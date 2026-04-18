import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ConversationDTO, CreateConversationRequest } from '@/lib/messaging/types'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: conversations, error } = await supabase
      .from('conversations')
      .select(`
        id,
        tour_id,
        tourist_id,
        guide_id,
        created_at,
        updated_at,
        last_message_at,
        tourist:tourist_id(id, full_name, avatar_url, role),
        guide:guide_id(id, full_name, avatar_url, role)
      `)
      .or(`tourist_id.eq.${user.id},guide_id.eq.${user.id}`)
      .order('last_message_at', { ascending: false, nullsFirst: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const baseConversations = conversations || []
    const conversationIds = baseConversations.map((conv: any) => conv.id)

    let unreadCounts = new Map<string, number>()
    let latestByConversation = new Map<string, { content: string; created_at: string }>()

    if (conversationIds.length > 0) {
      const [{ data: unreadMessages }, { data: latestMessages }] = await Promise.all([
        supabase
          .from('messages')
          .select('conversation_id')
          .in('conversation_id', conversationIds)
          .neq('sender_id', user.id)
          .is('read_at', null),
        supabase
          .from('messages')
          .select('conversation_id, content, created_at')
          .in('conversation_id', conversationIds)
          .order('created_at', { ascending: false }),
      ])

      unreadCounts = (unreadMessages || []).reduce((map, msg: any) => {
        map.set(msg.conversation_id, (map.get(msg.conversation_id) || 0) + 1)
        return map
      }, new Map<string, number>())

      for (const msg of latestMessages || []) {
        if (!latestByConversation.has(msg.conversation_id)) {
          latestByConversation.set(msg.conversation_id, {
            content: msg.content,
            created_at: msg.created_at,
          })
        }
      }
    }

    const enriched: ConversationDTO[] = baseConversations.map((conv: any) => {
      const otherUser = conv.tourist_id === user.id ? conv.guide : conv.tourist

      return {
        id: conv.id,
        tour_id: conv.tour_id,
        tourist_id: conv.tourist_id,
        guide_id: conv.guide_id,
        created_at: conv.created_at,
        updated_at: conv.updated_at,
        last_message_at: conv.last_message_at,
        unread_count: unreadCounts.get(conv.id) || 0,
        other_user: otherUser,
        last_message: latestByConversation.get(conv.id),
      }
    })

    return NextResponse.json(enriched)
  } catch (error) {
    console.error('Conversations fetch error:', error)
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

    const body: CreateConversationRequest = await request.json()
    const { tourist_id, guide_id, tour_id } = body

    if (!tourist_id || !guide_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (user.id !== tourist_id && user.id !== guide_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    let query = supabase
      .from('conversations')
      .select('*')
      .eq('tourist_id', tourist_id)
      .eq('guide_id', guide_id)

    if (tour_id) {
      query = query.eq('tour_id', tour_id)
    } else {
      query = query.is('tour_id', null)
    }

    const { data: existing } = await query.single()

    if (existing) {
      return NextResponse.json(existing)
    }

    const { data: newConv, error } = await supabase
      .from('conversations')
      .insert({
        tourist_id,
        guide_id,
        tour_id: tour_id || null,
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(newConv, { status: 201 })
  } catch (error) {
    console.error('Conversation creation error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
