const { existsSync, readFileSync } = require('node:fs')
const { join } = require('node:path')

function loadLocalReleaseEnv() {
  const candidates = [
    process.env.DEEPSEEK_DESKTOP_RELEASE_ENV,
    join(__dirname, 'scripts', 'release.local.env'),
    join(__dirname, 'release.local.env')
  ].filter(Boolean)

  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue
    for (const rawLine of readFileSync(candidate, 'utf8').split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
      if (!match) continue
      let value = match[2].trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!process.env[match[1]]) process.env[match[1]] = value
    }
    break
  }
}

loadLocalReleaseEnv()

const hasExplicitMacSigningIdentity = Boolean(
  process.env.CSC_LINK ||
    process.env.CSC_NAME ||
    process.env.CSC_KEY_PASSWORD ||
    process.env.MAC_SIGN === '1'
)

const hasNotaryToolCredentials = Boolean(
  process.env.APPLE_API_KEY_ID &&
    process.env.APPLE_API_ISSUER &&
    (process.env.APPLE_API_KEY || process.env.APPLE_API_KEY_BASE64)
)

module.exports = {
  appId: 'coredds.deepseekdesktop',
  productName: 'DeepSeek Desktop',
  // node-pty runs spawn-helper; binaries must live outside asar to be executable.
  asar: true,
  asarUnpack: [
    '**/node_modules/node-pty/**/*',
    '**/node_modules/codewhale/**/*',
    '**/node_modules/deepseek-tui/**/*'
  ],
  npmRebuild: false,
  directories: {
    output: 'dist'
  },
  files: ['out/**/*', 'package.json'],
  artifactName: `DeepSeek-Desktop-\${version}-\${os}-\${arch}.\${ext}`,
  afterPack: './scripts/after-pack.cjs',
  afterSign: './scripts/mac-notarize.cjs',
  mac: {
    category: 'public.app-category.developer-tools',
    identity: hasExplicitMacSigningIdentity ? undefined : null,
    // We notarize in scripts/mac-notarize.cjs so APPLE_API_KEY_BASE64 can be supported.
    notarize: false,
    hardenedRuntime: hasExplicitMacSigningIdentity,
    gatekeeperAssess: false,
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.inherit.plist',
    icon: './src/asset/img/deepseek.png',
    // arm64 (Apple Silicon) + x64 (Intel). On M-series Macs, local packaging produces a dmg/zip for each arch.
    target: [
      { target: 'dmg', arch: ['arm64', 'x64'] },
      { target: 'zip', arch: ['arm64', 'x64'] }
    ]
  },
  dmg: {
    sign: hasExplicitMacSigningIdentity
  },
  win: {
    icon: './src/asset/img/deepseek.ico',
    target: [{ target: 'nsis', arch: ['x64'] }]
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    perMachine: false,
    allowElevation: true,
    selectPerMachineByDefault: false,
    // Explicitly create shortcuts; always recreates on reinstall even if the user previously deleted the desktop icon.
    createDesktopShortcut: 'always',
    createStartMenuShortcut: true,
    shortcutName: 'DeepSeek Desktop',
    uninstallDisplayName: 'DeepSeek Desktop',
    deleteAppDataOnUninstall: false
  },
  linux: {
    category: 'Development',
    icon: './src/asset/img/deepseek.png',
    target: [{ target: 'AppImage', arch: ['x64'] }]
  }
}
