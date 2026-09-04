const modules = import.meta.glob<{ default: string }>('./hardware-icons/*.png', {
  eager: true,
});

const iconsByFilename: Record<string, string> = {};
for (const path in modules) {
  const filename = path.split('/').pop() as string;
  iconsByFilename[filename] = modules[path].default;
}

const TAP_MODEL_ALIASES: Record<string, string> = {
  'TAP-M251': 'TAP-M251T.png',
  'TAP-M251T': 'TAP-M251T.png',
  'TAP-M251L': 'TAP-M251LT.png',
  'TAP-M251LT': 'TAP-M251LT.png',
  'TAP-M251ULT': 'TAP-M251T.png',
  'TAP-M252': 'TAP-252.png',
  'TAP-M252T': 'TAP-252.png',
  'TAP-M252L': 'TAP-M252LT.png',
  'TAP-M252LT': 'TAP-M252LT.png',
  'TAP-M253': 'TAP-M253T.png',
  'TAP-M253T': 'TAP-M253T.png',
  'TAP-M253L': 'TAP-M253LT.png',
  'TAP-M253LT': 'TAP-M253LT.png',
  'TAP-M253ULT': 'TAP-M253T.png',
  'TAP-M261': 'TAP-252.png',
  'TAP-M261T': 'TAP-252.png',
  'TAP-M261L': 'TAP-M261LT.png',
  'TAP-M261LT': 'TAP-M261LT.png',
  'TAP-M262': 'TAP-252.png',
  'TAP-M262T': 'TAP-252.png',
  'TAP-M262L': 'TAP-M262LT.png',
  'TAP-M262LT': 'TAP-M262LT.png',
  'TAP-M263': 'TAP-253.png',
  'TAP-M263T': 'TAP-253.png',
  'TAP-M263L': 'TAP-M263LT.png',
  'TAP-M263LT': 'TAP-M263LT.png',
  'TAP-M271': 'TAP-M271T.png',
  'TAP-M271T': 'TAP-M271T.png',
  'TAP-M271L': 'TAP-M271LT.png',
  'TAP-M271LT': 'TAP-M271LT.png',
  'TAP-M271ULT': 'TAP-M271T.png',
  'TAP-M272': 'TAP-272.png',
  'TAP-M272T': 'TAP-272.png',
  'TAP-M272L': 'TAP-M272LT.png',
  'TAP-M272LT': 'TAP-M272LT.png',
  'TAP-M273': 'TAP-M273T.png',
  'TAP-M273T': 'TAP-M273T.png',
  'TAP-M273L': 'TAP-M273LT.png',
  'TAP-M273LT': 'TAP-M273LT.png',
  'TAP-M273ULT': 'TAP-M273T.png',
  'TAP-M451': 'TAP-M451T.png',
  'TAP-M451T': 'TAP-M451T.png',
  'TAP-M451ULT': 'TAP-M451T.png',
  'TAP-M453': 'TAP-M453T.png',
  'TAP-M453T': 'TAP-M453T.png',
  'TAP-M473': 'TAP-M473T.png',
  'TAP-M473T': 'TAP-M473T.png',
  'TAP-M473LT': 'TAP-M473T.png',
  'TAP-M473ULT': 'TAP-M473T.png',
  'TAP-506': 'TAP-M506T.png',
  'TAP-M506': 'TAP-M506T.png',
  'TAP-M506T': 'TAP-M506T.png',
  'PNL-M341': 'PNL-M341T.png',
  'PNL-M341T': 'PNL-M341T.png',
  'PNL-M343': 'PNL-M343T.png',
  'PNL-M343T': 'PNL-M343T.png',
};

export function resolveHardwareIcon(imagePathOrModel?: string): string | undefined {
  if (!imagePathOrModel) return undefined;
  const raw = imagePathOrModel.trim();
  const filename = raw.split('/').pop() as string;
  const modelKey = filename.replace(/\.png$/i, '').toUpperCase();

  // Direct match
  if (iconsByFilename[filename]) return iconsByFilename[filename];

  // If filename doesn't have .png extension
  const withPng = filename.endsWith('.png') ? filename : `${filename}.png`;
  if (iconsByFilename[withPng]) return iconsByFilename[withPng];

  // Alias lookup for TAP modules to orange faceplate stencil
  if (TAP_MODEL_ALIASES[modelKey] && iconsByFilename[TAP_MODEL_ALIASES[modelKey]]) {
    return iconsByFilename[TAP_MODEL_ALIASES[modelKey]];
  }

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
