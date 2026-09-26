'use client'

import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { ServiceCategoryDTO } from '@/lib/types'
import { useAppStore } from '@/store/app-store'

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * Language-aware skill labeler backed by the ServiceCategory register.
 * Returns fn(skillKey) → localized name (EN/MR/HI) with graceful fallback to the
 * capitalized raw key for skills that have no category row.
 */
export function useSkillLabel(): (key: string) => string {
  const lang = useAppStore((s) => s.lang)
  const { data } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<{ ok: boolean; categories: ServiceCategoryDTO[] }>('/api/categories'),
    staleTime: 300000,
  })
  return useCallback(
    (key: string) => {
      const cat = data?.categories.find((c) => c.key === key)
      if (!cat) return cap(key)
      if (lang === 'mr') return cat.nameMr || cat.nameEn
      if (lang === 'hi') return cat.nameHi || cat.nameEn
      return cat.nameEn
    },
    [data, lang]
  )
}

/** Localized service-scope line (category description) for a skill key, or null when unknown. */
export function useSkillScope(): (key: string) => string | null {
  const lang = useAppStore((s) => s.lang)
  const { data } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<{ ok: boolean; categories: ServiceCategoryDTO[] }>('/api/categories'),
    staleTime: 300000,
  })
  return useCallback(
    (key: string) => {
      const cat = data?.categories.find((c) => c.key === key)
      if (!cat) return null
      if (lang === 'mr') return cat.descMr || cat.descEn
      if (lang === 'hi') return cat.descHi || cat.descEn
      return cat.descEn
    },
    [data, lang]
  )
}
