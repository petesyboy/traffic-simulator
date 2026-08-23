const modules = import.meta.glob<{ default: string }>('./hardware-icons/*.png', {
  eager: true,
});

const iconsByFilename: Record<string, string> = {};
for (const path in modules) {
  const filename = path.split('/').pop() as string;
  iconsByFilename[filename] = modules[path].default;
}

const TAP_MODEL_ALIASES: Record<string, string> = {
  'TAP-M251': 'TAP-252.png',
  'TAP-M251T': 'TAP-252.png',
  'TAP-M251LT': 'TAP-252.png',
  'TAP-M251ULT': 'TAP-252.png',
  'TAP-M252': 'TAP-252.png',
  'TAP-M252T': 'TAP-252.png',
  'TAP-M252LT': 'TAP-252.png',
  'TAP-M253': 'TAP-253.png',
  'TAP-M253T': 'TAP-253.png',
  'TAP-M253LT': 'TAP-253.png',
  'TAP-M253ULT': 'TAP-253.png',
  'TAP-M261': 'TAP-252.png',
  'TAP-M261T': 'TAP-252.png',
  'TAP-M261LT': 'TAP-252.png',
  'TAP-M262': 'TAP-252.png',
  'TAP-M262T': 'TAP-252.png',
  'TAP-M262LT': 'TAP-252.png',
  'TAP-M263': 'TAP-253.png',
  'TAP-M263T': 'TAP-253.png',
  'TAP-M263LT': 'TAP-253.png',
  'TAP-M271': 'TAP-272.png',
  'TAP-M271T': 'TAP-272.png',
  'TAP-M271LT': 'TAP-272.png',
  'TAP-M271ULT': 'TAP-272.png',
  'TAP-M272': 'TAP-272.png',
  'TAP-M272T': 'TAP-272.png',
  'TAP-M272LT': 'TAP-272.png',
  'TAP-M273': 'TAP-273.png',
  'TAP-M273T': 'TAP-273.png',
  'TAP-M273LT': 'TAP-273.png',
  'TAP-M273ULT': 'TAP-273.png',
  'TAP-M506': 'TAP-506.png',
  'TAP-M506T': 'TAP-506.png',
  'PNL-M341': 'PNL-M341.png',
  'PNL-M341T': 'PNL-M341.png',
  'PNL-M343': 'PNL-M343.png',
  'PNL-M343T': 'PNL-M343.png',
};

export function resolveHardwareIcon(imagePathOrModel?: string): string | undefined {
  if (!imagePathOrModel) return undefined;
  const raw = imagePathOrModel.trim();
  const filename = raw.split('/').pop() as string;
  const modelKey = filename.replace(/\.png$/i, '').toUpperCase();

  // Alias lookup for TAP modules to orange faceplate stencil
  if (TAP_MODEL_ALIASES[modelKey] && iconsByFilename[TAP_MODEL_ALIASES[modelKey]]) {
    return iconsByFilename[TAP_MODEL_ALIASES[modelKey]];
  }

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
