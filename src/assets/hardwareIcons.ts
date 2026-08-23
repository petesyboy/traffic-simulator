const modules = import.meta.glob<{ default: string }>('./hardware-icons/*.png', {
  eager: true,
});

const iconsByFilename: Record<string, string> = {};
for (const path in modules) {
  const filename = path.split('/').pop() as string;
  iconsByFilename[filename] = modules[path].default;
}

export function resolveHardwareIcon(imagePathOrModel?: string): string | undefined {
  if (!imagePathOrModel) return undefined;
  const raw = imagePathOrModel.trim();
  const filename = raw.split('/').pop() as string;

  // Direct match
  if (iconsByFilename[filename]) return iconsByFilename[filename];

  // If filename doesn't have .png extension
  const withPng = filename.endsWith('.png') ? filename : `${filename}.png`;
  if (iconsByFilename[withPng]) return iconsByFilename[withPng];

  // Try T-suffix or strip T-suffix
  const baseNoExt = withPng.replace(/\.png$/i, '');
  if (baseNoExt.endsWith('T')) {
    const withoutT = `${baseNoExt.slice(0, -1)}.png`;
    if (iconsByFilename[withoutT]) return iconsByFilename[withoutT];
  } else {
    const withT = `${baseNoExt}T.png`;
    if (iconsByFilename[withT]) return iconsByFilename[withT];
  }

  // Try space / hyphen / underscore variations
  const hyphenated = `${baseNoExt.replace(/[\s_]+/g, '-')}.png`;
  if (iconsByFilename[hyphenated]) return iconsByFilename[hyphenated];

  const spaced = `${baseNoExt.replace(/[-_]+/g, ' ')}.png`;
  if (iconsByFilename[spaced]) return iconsByFilename[spaced];

  return undefined;
}
