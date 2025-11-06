import { defaultDatabase } from '../data/mocks'

const STORAGE_KEY = 'betterfeed-db-v1'
const DEFAULT_LIMIT = 6

const isBrowser = typeof window !== 'undefined'

let memoryDB: typeof defaultDatabase | null = null

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const loadFromStorage = (): typeof defaultDatabase => {
  if (!isBrowser) return clone(defaultDatabase)

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return clone(defaultDatabase)

  try {
    return JSON.parse(raw)
  } catch (error) {
    console.warn('Failed to parse stored BetterFeed DB, resetting...', error)
    return clone(defaultDatabase)
  }
}

const persist = () => {
  if (!isBrowser || !memoryDB) return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryDB))
}

const ensureDB = () => {
  if (!memoryDB) {
    memoryDB = loadFromStorage()
  }
  return memoryDB
}

const nextInteractionId = (db: typeof defaultDatabase) =>
  db.interactions.reduce((max, item) => Math.max(max, item.id), 0) + 1

const nextPostId = (db: typeof defaultDatabase) =>
  db.posts.reduce((max, item) => Math.max(max, item.id), 0) + 1

const sortPosts = <T extends { created_at: string }>(posts: T[]) =>
  [...posts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

const createId = () => {
  if (isBrowser && typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `uuid-${Math.random().toString(16).slice(2)}`
}

const adjustCounts = (
  post: { like_count: number; save_count: number },
  type: 'like' | 'save',
  delta: number
) => {
  if (type === 'like') {
    post.like_count = Math.max(0, post.like_count + delta)
  }
  if (type === 'save') {
    post.save_count = Math.max(0, post.save_count + delta)
  }
}

export const db = {
  async getCategories() {
    await delay(200)
    return clone(ensureDB().categories)
  },

  async getChatStyles() {
    await delay(200)
    return clone(ensureDB().chat_styles)
  },

  async getPosts(query: { category?: string; cursor?: string | null; limit?: number } = {}) {
    const { category, cursor = null, limit = DEFAULT_LIMIT } = query
    await delay(400)
    const dbInstance = ensureDB()
    const all = sortPosts(
      category && category !== 'All'
        ? dbInstance.posts.filter((post) => post.category === category)
        : dbInstance.posts
    )

    let startIndex = 0
    if (cursor) {
      const index = all.findIndex((post) => String(post.id) === cursor)
      startIndex = index >= 0 ? index + 1 : 0
    }

    const slice = all.slice(startIndex, startIndex + limit)
    const next = slice.length === limit ? String(slice[slice.length - 1].id) : null

    return {
      items: clone(slice),
      nextCursor: next,
    }
  },

  async getPost(postId: number | string) {
    await delay(250)
    const post = ensureDB().posts.find((item) => item.id === postId)
    return post ? clone(post) : null
  },

  async toggleInteraction(userId: string, postId: number | string, interactionType: 'like' | 'save') {
    await delay(250)
    const dbInstance = ensureDB()
    const targetPost = dbInstance.posts.find((item) => item.id === postId)
    if (!targetPost) {
      throw new Error('Post not found')
    }

    const existingIndex = dbInstance.interactions.findIndex(
      (interaction) =>
        interaction.user_id === userId &&
        interaction.post_id === postId &&
        interaction.interaction_type === interactionType
    )

    if (existingIndex !== -1) {
      dbInstance.interactions.splice(existingIndex, 1)
      adjustCounts(targetPost, interactionType, -1)
      persist()
      return { active: false, post: clone(targetPost) }
    }

    const newInteraction = {
      id: nextInteractionId(dbInstance),
      user_id: userId,
      post_id: postId,
      interaction_type: interactionType,
      created_at: new Date().toISOString(),
    }

    dbInstance.interactions.push(newInteraction)
    adjustCounts(targetPost, interactionType, 1)
    persist()
    return { active: true, post: clone(targetPost) }
  },

  async getUserInteractions(userId: string) {
    await delay(200)
    return clone(ensureDB().interactions.filter((item) => item.user_id === userId))
  },

  async getProfile(userId: string) {
    await delay(250)
    const profile = ensureDB().profiles.find((item) => item.id === userId)
    return profile ? clone(profile) : null
  },

  async updateProfile(payload: { id: string; [key: string]: any }) {
    await delay(300)
    const dbInstance = ensureDB()
    const index = dbInstance.profiles.findIndex((item) => item.id === payload.id)
    if (index === -1) {
      throw new Error('Profile not found')
    }
    const current = dbInstance.profiles[index]
    dbInstance.profiles[index] = { ...current, ...payload }
    persist()
    return clone(dbInstance.profiles[index])
  },

  async createProfile(payload: { email: string; username: string; avatar_url?: string }) {
    await delay(350)
    const dbInstance = ensureDB()
    if (dbInstance.profiles.some((profile) => profile.email === payload.email)) {
      throw new Error('Email already registered')
    }
    const profile = {
      id: createId(),
      created_at: new Date().toISOString(),
      ...payload,
    }
    dbInstance.profiles.push(profile)
    persist()
    return clone(profile)
  },

  async findProfileByEmail(email: string) {
    await delay(200)
    const profile = ensureDB().profiles.find((item) => item.email === email)
    return profile ? clone(profile) : null
  },

  async createPost(payload: any) {
    await delay(400)
    const dbInstance = ensureDB()
    const newPost = {
      id: nextPostId(dbInstance),
      like_count: 0,
      save_count: 0,
      view_count: Math.floor(Math.random() * 500) + 200,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...payload,
    }
    dbInstance.posts.push(newPost)
    persist()
    return clone(newPost)
  },

  async getSavedPosts(userId: string) {
    await delay(250)
    const dbInstance = ensureDB()
    const saves = dbInstance.interactions
      .filter((interaction) => interaction.user_id === userId && interaction.interaction_type === 'save')
      .map((interaction) => interaction.post_id)
    const savedPosts = dbInstance.posts.filter((post) => saves.includes(post.id))
    return clone(sortPosts(savedPosts))
  },

  async reset() {
    memoryDB = clone(defaultDatabase)
    persist()
  },
}

