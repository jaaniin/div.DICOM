/**
 * File System Traversal & DICOM Metadata File Filters
 */

export const isSystemOrMetadataFile = (file: File): boolean => {
  if (!file || !file.name) return true;
  const name = file.name;
  // Ignore Windows Zone.Identifier files (alternate data streams)
  if (name.includes('Zone.Identifier') || name.includes(':Zone.Identifier') || name.endsWith('.Zone.Identifier')) {
    return true;
  }
  // Ignore macOS metadata and Unix hidden files
  if (name.startsWith('.') || name.startsWith('._') || name === '.DS_Store' || name.startsWith('.git')) {
    return true;
  }
  // Ignore Windows thumbnail and desktop config caches
  if (name === 'Thumbs.db' || name === 'desktop.ini' || name.startsWith('~')) {
    return true;
  }
  // Ignore zero-byte or tiny files (minimum valid DICOM is 132 bytes)
  if (file.size !== undefined && file.size < 132) {
    return true;
  }
  return false;
};

export const readAllEntries = async (dirReader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> => {
  let allEntries: FileSystemEntry[] = [];
  const readEntries = async (): Promise<FileSystemEntry[]> => {
    return new Promise<FileSystemEntry[]>((resolve) => {
      dirReader.readEntries((entries) => resolve(entries));
    });
  };

  let entries = await readEntries();
  while (entries.length > 0) {
    allEntries = allEntries.concat(entries);
    entries = await readEntries();
  }
  return allEntries;
};

export const traverseFileTree = async (item: any): Promise<File[]> => {
  if (item.isFile) {
    return new Promise<File[]>((resolve) => {
      item.file((file: File) => resolve([file]));
    });
  } else if (item.isDirectory) {
    const dirReader = item.createReader();
    const entries = await readAllEntries(dirReader);
    const filesPromises = entries.map((entry) => traverseFileTree(entry));
    const filesArrays = await Promise.all(filesPromises);
    return filesArrays.flat();
  }
  return [];
};
