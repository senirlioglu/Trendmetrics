import type {
  ApiResponse,
  CanonicalTrend,
  CreditTransaction,
  DailyReport,
  DeepAnalysisReport,
  DiscoverRequest,
  PlatformGroupId,
  UserProfile,
} from '@/types'
import { getIdToken } from './firebase'

class ApiClient {
  private baseUrl: string

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_BASE_URL || '/api'
  }

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<ApiResponse<T>> {
    const token = await getIdToken()

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({
        error: { code: 'UNKNOWN', message: response.statusText },
      }))
      return {
        success: false,
        error: errorBody.error ?? {
          code: `HTTP_${response.status}`,
          message: response.statusText,
        },
      }
    }

    const data: ApiResponse<T> = await response.json()
    return data
  }

  async discoverTrends(req: DiscoverRequest): Promise<CanonicalTrend[]> {
    const result = await this.request<CanonicalTrend[]>('POST', '/trends/discover', {
      platform_group: req.platform_group,
      category: req.category,
      country: req.country,
      language: req.language,
      seed_query: req.seed_query,
      force_refresh: req.force_refresh,
    })

    if (!result.success || !result.data) {
      throw new Error(result.error?.message ?? 'Failed to discover trends')
    }

    return result.data
  }

  async getTrend(id: string): Promise<CanonicalTrend> {
    const result = await this.request<CanonicalTrend>('GET', `/trends/${id}`)

    if (!result.success || !result.data) {
      throw new Error(result.error?.message ?? 'Failed to get trend')
    }

    return result.data
  }

  async requestDeepAnalysis(trendId: string): Promise<DeepAnalysisReport> {
    const result = await this.request<DeepAnalysisReport>(
      'POST',
      `/trends/${trendId}/deep-analysis`,
    )

    if (!result.success || !result.data) {
      throw new Error(result.error?.message ?? 'Failed to request deep analysis')
    }

    return result.data
  }

  async requestDailyReport(
    group: PlatformGroupId,
    category: string,
    country: string,
  ): Promise<DailyReport> {
    const result = await this.request<DailyReport>('POST', '/reports/daily', {
      platform_group: group,
      category,
      country,
    })

    if (!result.success || !result.data) {
      throw new Error(result.error?.message ?? 'Failed to request daily report')
    }

    return result.data
  }

  async getBalance(): Promise<number> {
    const result = await this.request<{ balance: number }>('GET', '/credits/balance')

    if (!result.success || !result.data) {
      throw new Error(result.error?.message ?? 'Failed to get balance')
    }

    return result.data.balance
  }

  async topUp(amount: number): Promise<CreditTransaction> {
    const result = await this.request<CreditTransaction>('POST', '/credits/topup', {
      amount,
    })

    if (!result.success || !result.data) {
      throw new Error(result.error?.message ?? 'Failed to top up credits')
    }

    return result.data
  }

  async getCreditHistory(limit: number, offset: number): Promise<CreditTransaction[]> {
    const result = await this.request<CreditTransaction[]>(
      'GET',
      `/credits/history?limit=${limit}&offset=${offset}`,
    )

    if (!result.success || !result.data) {
      throw new Error(result.error?.message ?? 'Failed to get credit history')
    }

    return result.data
  }

  async getReportHistory(
    type: 'deep_analysis' | 'daily',
    limit: number,
    offset: number,
  ): Promise<(DeepAnalysisReport | DailyReport)[]> {
    const result = await this.request<(DeepAnalysisReport | DailyReport)[]>(
      'GET',
      `/reports/history?type=${type}&limit=${limit}&offset=${offset}`,
    )

    if (!result.success || !result.data) {
      throw new Error(result.error?.message ?? 'Failed to get report history')
    }

    return result.data
  }

  async createSession(firebaseToken: string): Promise<UserProfile> {
    const result = await this.request<UserProfile>('POST', '/auth/session', {
      firebase_token: firebaseToken,
    })

    if (!result.success || !result.data) {
      throw new Error(result.error?.message ?? 'Failed to create session')
    }

    return result.data
  }

  async getMe(): Promise<UserProfile> {
    const result = await this.request<UserProfile>('GET', '/auth/me')

    if (!result.success || !result.data) {
      throw new Error(result.error?.message ?? 'Failed to get user profile')
    }

    return result.data
  }
}

export const api = new ApiClient()
