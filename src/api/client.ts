import { createOpencodeClient } from '@opencode-ai/sdk/client'
import type { Event } from '@opencode-ai/sdk/client'

export const client = createOpencodeClient({
  baseUrl: import.meta.env.VITE_OPENCODE_URL || 'http://localhost:4096'
})

export async function subscribeEvents(handler: (event: Event) => void) {
  try {
    console.log('📡 Connecting to OpenCode SSE stream...')
    const result = await client.global.event()
    
    if (!result.stream) {
      console.error('No stream returned from SSE')
      throw new Error('No event stream available')
    }
    
    console.log('✅ SSE stream connected, processing events...')
    let eventCount = 0
    
    try {
      for await (const item of result.stream as any) {
        if (item?.payload) {
          const event = item.payload as Event
          eventCount++
          console.log(`Event ${eventCount}:`, event.type)
          handler(event)
          
          // Test: stop after a few events
          if (eventCount >= 5) {
            console.log('Test: stopping after 5 events')
            break
          }
        }
      }
      
      console.log(`✅ Processed ${eventCount} events`)
    } catch (streamError) {
      console.error('Stream iteration error:', streamError)
      throw streamError
    }
    
  } catch (error) {
    console.error('Failed to subscribe to events:', error)
    throw error
  }
}

export const sessionAPI = {
  async list() {
    const res = await client.session.list()
    return res.data || []
  },

  async create(directory: string, title?: string) {
    const res = await client.session.create({ body: { title } })
    return res.data
  },

  async get(id: string) {
    const res = await client.session.get({ path: { id } })
    return res.data
  },

  async delete(id: string) {
    await client.session.delete({ path: { id } })
  },

  async abort(id: string) {
    await client.session.abort({ path: { id } })
  },

  async prompt(id: string, content: string) {
    await client.session.prompt({
      path: { id },
      body: { parts: [{ type: 'text', text: content }] }
    })
  }
}
