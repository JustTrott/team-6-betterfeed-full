import { useState, useMemo } from 'react'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { db } from '../lib/db'
import { useAuthStore } from '../store/auth'
import { useToast } from '../context/toast'

interface InteractionState {
  likes: Set<number | string>
  saves: Set<number | string>
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
    queryFn: async ({ pageParam = null }: { pageParam: string | null }) => {
      const response = await db.getPosts({
        category,
        cursor: pageParam,
      })
      return response
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    initialPageParam: null as string | null,
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
    queryClient.setQueryData(['posts', category], (old: any) => {
      if (!old) return old
      return {
        ...old,
        pages: old.pages.map((page: any) => ({
          ...page,
          items: page.items.map((post: any) => {
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
      queryClient.setQueryData(['posts', category], (old: any) => {
        if (!old) return old
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            items: page.items.map((post: any) =>
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

