import { apiClient, projectUrl, DATASET } from './client'

/**
 * LlamaFarm Datasets API wrapper
 * This provides integration with LlamaFarm's file storage so files sync
 * between RegSync and LlamaFarm Designer
 */

export interface DatasetFile {
  file_hash: string
  original_filename: string
  content_type: string
  size_bytes: number
  uploaded_at: string
  processed: boolean
}

export interface DatasetInfo {
  name: string
  auto_process: boolean
  data_processing_strategy: string
  database: string
  details?: {
    files_metadata: DatasetFile[]
  }
}

interface ListDatasetsResponse {
  total: number
  datasets: DatasetInfo[]
}

interface UploadFileResponse {
  filename: string
  hash: string
  processed: boolean
  skipped: boolean
}

interface DeleteFileResponse {
  file_hash: string
  deleted_chunks: number
}

interface ProcessDatasetResponse {
  message: string
  task_uri: string
  task_id: string
}

export const datasetsApi = {
  // List all datasets in the project
  async listDatasets(): Promise<ListDatasetsResponse> {
    const { data } = await apiClient.get<ListDatasetsResponse>(
      projectUrl('/datasets/')
    )
    return data
  },

  // Get files in the default dataset
  async listFiles(): Promise<DatasetFile[]> {
    const { data } = await apiClient.get<ListDatasetsResponse>(
      projectUrl('/datasets/')
    )
    const dataset = data.datasets.find((d) => d.name === DATASET)
    return dataset?.details?.files_metadata || []
  },

  // Upload a file to the dataset
  async uploadFile(file: File): Promise<UploadFileResponse> {
    const formData = new FormData()
    formData.append('file', file)

    const { data } = await apiClient.post<UploadFileResponse>(
      projectUrl(`/datasets/${DATASET}/data`),
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
    return data
  },

  // Delete a file from the dataset
  async deleteFile(fileHash: string): Promise<DeleteFileResponse> {
    const { data } = await apiClient.delete<DeleteFileResponse>(
      projectUrl(`/datasets/${DATASET}/data/${fileHash}`)
    )
    return data
  },

  // Process the dataset (ingest into vector DB)
  async processDataset(): Promise<ProcessDatasetResponse> {
    const { data } = await apiClient.post<ProcessDatasetResponse>(
      projectUrl(`/datasets/${DATASET}/actions`),
      { action_type: 'process' }
    )
    return data
  },

  // Download a file by hash
  async downloadFile(fileHash: string): Promise<Blob> {
    // Files are stored in raw directory with hash as filename
    const { data } = await apiClient.get<Blob>(
      projectUrl(`/datasets/${DATASET}/data/${fileHash}/download`),
      { responseType: 'blob' }
    )
    return data
  },
}
