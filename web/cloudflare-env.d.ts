// Cloudflare Workers KV namespace bindings
// Regenerate with: npm run cf-typegen
interface CloudflareEnv {
  AUDIT_KV: KVNamespace;
  ASSETS: Fetcher;
  WORKER_SELF_REFERENCE: Fetcher;
}
