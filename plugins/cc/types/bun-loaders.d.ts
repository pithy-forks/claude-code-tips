// tested with: claude code v2.1.132
// Bun resolves *.sql imports as text content via its built-in loader.
// tsc has no native concept for this; declare it as a module that exports
// a string default. db/migrate.ts uses this to embed schema.sql at build time.
declare module "*.sql" {
  const content: string;
  export default content;
}
