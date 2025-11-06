const STORAGE_KEY = 'betterfeed_reading_history'

interface HistoryItem {
  postId: number | string
  timestamp: string
}

export const readingHistory = {
  getHistory: (): HistoryItem[] => {
    try {
      if (typeof window === 'undefined') return []
      const history = window.localStorage.getItem(STORAGE_KEY)
      return history ? JSON.parse(history) : []
    } catch (error) {
      console.error('Error reading history:', error)
      return []
    }
  },

  markAsRead: (postId: number | string) => {
    try {
      if (typeof window === 'undefined') return
      const history = readingHistory.getHistory()
      const existingIndex = history.findIndex(item => item.postId === postId)
      
      if (existingIndex !== -1) {
        history[existingIndex].timestamp = new Date().toISOString()
      } else {
        history.push({
          postId,
          timestamp: new Date().toISOString()
        })
      }
      
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
    } catch (error) {
      console.error('Error saving reading history:', error)
    }
  },

  hasRead: (postId: number | string): boolean => {
    const history = readingHistory.getHistory()
    return history.some(item => item.postId === postId)
  },

  getHistoryWithPosts: <T extends { id: number | string }>(posts: T[]) => {
    const history = readingHistory.getHistory()
    
    return history
      .map(historyItem => {
        const post = posts.find(p => p.id === historyItem.postId)
        if (!post) return null
        
        return {
          ...post,
          readAt: historyItem.timestamp
        }
      })
      .filter(item => item !== null)
      .sort((a: any, b: any) => new Date(b.readAt).getTime() - new Date(a.readAt).getTime())
  },

  clearHistory: () => {
    try {
      if (typeof window === 'undefined') return
      window.localStorage.removeItem(STORAGE_KEY)
    } catch (error) {
      console.error('Error clearing history:', error)
    }
  },

  removeFromHistory: (postId: number | string) => {
    try {
      if (typeof window === 'undefined') return
      const history = readingHistory.getHistory()
      const filtered = history.filter(item => item.postId !== postId)
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
    } catch (error) {
      console.error('Error removing from history:', error)
    }
  }
}

