import { useState, useMemo } from 'react'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { db } from '../lib/db'
import { useAuthStore } from '../store/auth'
import { useToast } from '../context/toast'
import type { ArticleResponse } from '../app/api/articles/fetch/route'

interface InteractionState {
  likes: Set<number | string>
  saves: Set<number | string>
}

interface FeedPost {
  id: number | string
  title: string
  content: string | null
  article_url: string
  thumbnail_url: string | null
  source: string
  category: string
  created_at: string
  like_count: number
  save_count: number
  view_count: number
}

interface FetchArticlesResponse {
  articles: ArticleResponse[]
  meta: {
    count: number
    page: number
    per_page: number
    total_pages: number
  }
}

interface PostsPage {
  items: FeedPost[]
  nextCursor: number | null
}

interface PostsQueryData {
  pages: PostsPage[]
  pageParams: number[]
}

const createInteractionState = (): InteractionState => ({ likes: new Set(), saves: new Set() })

export const useFeed = () => {
  const { user } = useAuthStore()
  const { pushToast } = useToast()
  const queryClient = useQueryClient()
  const [category, setCategoryState] = useState('General')

  // Fetch user interactions
  const { data: interactionsData } = useQuery({
    queryKey: ['user-interactions', user?.id],
    queryFn: async () => {
      if (!user) return createInteractionState()
      const records = await db.getUserInteractions(user.id)
      const likes = new Set<number | string>()
      const saves = new Set<number | string>()
      records.forEach((item) => {
        if (item.interaction_type === 'like') likes.add(item.post_id)
        if (item.interaction_type === 'save') saves.add(item.post_id)
      })
      return { likes, saves }
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 minutes
    initialData: () => createInteractionState(),
  })

  const interactions = interactionsData || createInteractionState()

  // Infinite query for posts by category
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['posts', category],
    queryFn: async ({ pageParam = 1 }: { pageParam: number }) => {
      // Fetch articles from arXiv API
      const response = await fetch('/api/articles/fetch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: category !== 'General' && category !== 'All' ? category : '',
          perPage: 25,
          page: pageParam,
          sortBy: 'submittedDate',
          sortOrder: 'descending',
          generateSummaries: true,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch articles: ${response.statusText}`)
      }

      const data: FetchArticlesResponse = await response.json()
      
      // Transform API response to match expected format
      const items: FeedPost[] = data.articles.map((article: ArticleResponse) => ({
        id: article.id,
        title: article.title,
        content: article.content,
        article_url: article.article_url,
        thumbnail_url: article.thumbnail_url,
        source: article.source || 'arXiv',
        category: article.category || 'General',
        created_at: article.created_at,
        like_count: 0,
        save_count: 0,
        view_count: 0,
      }))

      return {
        items,
        nextCursor: data.meta.page < data.meta.total_pages ? pageParam + 1 : null,
      }
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    initialPageParam: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes cache
  })

  // Flatten all pages into a single array
  const posts = useMemo(() => {
    if (!data?.pages) return []
    return data.pages.flatMap((page) => page.items)
  }, [data])

  const hasMore = hasNextPage ?? false
  const isLoading = isFetching && !isFetchingNextPage
  const isLoadingMore = isFetchingNextPage

  const setCategory = (newCategory: string) => {
    setCategoryState(newCategory)
  }

  const toggleInteraction = async (postId: number | string, type: 'like' | 'save') => {
    if (!user) {
      pushToast({ title: 'Sign in required', description: 'Log in to interact with the feed.' })
      return
    }

    // Optimistic update
    const targetSet = type === 'like' ? interactions.likes : interactions.saves
    const isActive = targetSet.has(postId)

    // Update interactions cache optimistically
    queryClient.setQueryData(['user-interactions', user.id], (old: InteractionState) => {
      const newInteractions = createInteractionState()
      old.likes.forEach((id) => newInteractions.likes.add(id))
      old.saves.forEach((id) => newInteractions.saves.add(id))
      const target = type === 'like' ? newInteractions.likes : newInteractions.saves
      if (isActive) {
        target.delete(postId)
      } else {
        target.add(postId)
      }
      return newInteractions
    })

    // Update posts cache optimistically
    queryClient.setQueryData<PostsQueryData>(['posts', category], (old) => {
      if (!old) return old
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          items: page.items.map((post) => {
            if (post.id !== postId) return post
            const delta = isActive ? -1 : 1
            if (type === 'like') {
              return { ...post, like_count: Math.max(0, post.like_count + delta) }
            }
            return { ...post, save_count: Math.max(0, post.save_count + delta) }
          }),
        })),
      }
    })

    try {
      const result = await db.toggleInteraction(user.id, postId, type)
      
      // Update with server response
      queryClient.setQueryData(['user-interactions', user.id], (old: InteractionState) => {
        const newInteractions = createInteractionState()
        old.likes.forEach((id) => newInteractions.likes.add(id))
        old.saves.forEach((id) => newInteractions.saves.add(id))
        const target = type === 'like' ? newInteractions.likes : newInteractions.saves
        if (result.active) {
          target.add(postId)
        } else {
          target.delete(postId)
        }
        return newInteractions
      })

      // Update posts with server response
      queryClient.setQueryData<PostsQueryData>(['posts', category], (old) => {
        if (!old) return old
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((post) =>
              post.id === postId
                ? { ...post, like_count: result.post.like_count, save_count: result.post.save_count }
                : post
            ),
          })),
        }
      })
    } catch (error) {
      console.error(error)
      pushToast({ title: 'Something went wrong', description: 'Unable to update the interaction.', variant: 'error' })
      
      // Revert optimistic updates
      queryClient.invalidateQueries({ queryKey: ['user-interactions', user.id] })
      queryClient.invalidateQueries({ queryKey: ['posts', category] })
    }
  }

  const loadMore = async () => {
    if (!hasMore || isLoadingMore) return
    await fetchNextPage()
  }

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['posts', category] })
  }

  const metadata = useMemo(
    () => ({
      likedIds: interactions.likes,
      savedIds: interactions.saves,
    }),
    [interactions]
  )

  return {
    posts,
    category,
    isLoading,
    hasMore,
    likedIds: metadata.likedIds,
    savedIds: metadata.savedIds,
    setCategory,
    loadMore,
    toggleLike: (postId: number | string) => toggleInteraction(postId, 'like'),
    toggleSave: (postId: number | string) => toggleInteraction(postId, 'save'),
    refresh,
  }
}

