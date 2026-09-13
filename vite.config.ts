import { sites } from '@openai/sites-vite-plugin';
import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig } from 'vite';
import hostingConfig from './.openai/hosting.json';

const { d1 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === 'seatbelt';

const localBindingConfig = {
  main: 'vinext/server/fetch-handler',
  compatibility_flags: ['nodejs_compat'],

  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: 'survey-quality-seetah-db',
          database_id: '1eacdfa5-46e9-4067-b030-0dc8bfc8651f',
        },
      ]
    : [],
};

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local.
  process.env.WRANGLER_WRITE_LOGS ??= 'false';
  process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs';
  process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry';

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import('@cloudflare/vite-plugin');

  return {
    css: {
      postcss: {
        plugins: [tailwindcss()],
      },
    },

    server: isCodexSeatbeltSandbox
      ? {
          watch: {
            useFsEvents: false,
            usePolling: true,
          },
        }
      : undefined,

    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: {
          name: 'rsc',
          childEnvironments: ['ssr'],
        },
        config: localBindingConfig,
      }),
    ],
  };
});
