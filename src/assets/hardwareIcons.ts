const modules = import.meta.glob<{ default: string }>('./hardware-icons/*.png', {
  eager: true,
});

const iconsByFilename: Record<string, string> = {};
for (const path in modules) {
  const filename = path.split('/').pop() as string;
  iconsByFilename[filename] = modules[path].default;
}

export function resolveHardwareIcon(imagePath?: string): string | undefined {
  if (!imagePath) return undefined;
  const filename = imagePath.split('/').pop() as string;
  return iconsByFilename[filename];
}
