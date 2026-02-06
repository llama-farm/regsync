import { apiClient, projectUrl } from './client'
import type { DigestResponse } from '@/types/digest'

export const digestApi = {
  /**
   * Get policy digest for a time period
   * @param period - 'week' or 'month'
   * @param year - 4-digit year
   * @param periodNum - week number (1-53) or month number (1-12)
   */
  async getDigest(
    period: 'week' | 'month',
    year?: number,
    periodNum?: number
  ): Promise<DigestResponse> {
    const params = new URLSearchParams({ period })

    if (year !== undefined) {
      params.set('year', year.toString())
    }

    if (periodNum !== undefined) {
      params.set(period === 'week' ? 'week' : 'month', periodNum.toString())
    }

    const { data } = await apiClient.get<DigestResponse>(
      projectUrl(`/digest?${params.toString()}`)
    )
    return data
  },
}
