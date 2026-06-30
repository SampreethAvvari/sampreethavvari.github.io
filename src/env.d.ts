/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_CHAT_ENDPOINT?: string;
  readonly PUBLIC_TEACHING_API?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
