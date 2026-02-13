import axios, { AxiosError } from 'axios'

// API base URL - proxied through Vite in development
const API_BASE_URL = '/api'

// Default namespace and project for RegSync
const NAMESPACE = 'default'
const PROJECT = 'regsync'
const DATASET = 'policies'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000,
  withCredentials: true,
})

// Error handling interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const message = error.response?.data
      ? typeof error.response.data === 'object' && 'detail' in error.response.data
        ? (error.response.data as { detail: string }).detail
        : JSON.stringify(error.response.data)
      : error.message

    console.error('API Error:', message)
    throw new Error(message)
  }
)

// Helper to build project URLs
export function projectUrl(path: string): string {
  return `/projects/${NAMESPACE}/${PROJECT}${path}`
}

export { NAMESPACE, PROJECT, DATASET }
