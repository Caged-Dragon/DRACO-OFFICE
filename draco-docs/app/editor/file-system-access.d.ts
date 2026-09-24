export {};

declare global {
  interface FileSystemWritableFileStream extends WritableStream {
    write(data: string | BufferSource | Blob): Promise<void>;
    close(): Promise<void>;
  }

  interface FileSystemFileHandleLike {
    getFile(): Promise<File>;
    createWritable(): Promise<FileSystemWritableFileStream>;
  }

  interface SaveFilePickerOptions {
    suggestedName?: string;
    types?: { description: string; accept: Record<string, string[]> }[];
  }

  interface OpenFilePickerOptions {
    types?: { description: string; accept: Record<string, string[]> }[];
    multiple?: boolean;
  }

  interface Window {
    showSaveFilePicker?(
      options?: SaveFilePickerOptions
    ): Promise<FileSystemFileHandleLike>;
    showOpenFilePicker?(
      options?: OpenFilePickerOptions
    ): Promise<FileSystemFileHandleLike[]>;
  }
}
