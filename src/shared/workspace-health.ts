export type WorkspaceHealthLargeFile = {
  name: string
  sizeBytes: number
}

export type WorkspaceHealthResult = {
  largeFiles: WorkspaceHealthLargeFile[]
  diskFreeBytes: number
  diskTotalBytes: number
  diskFreePercent: number
}
