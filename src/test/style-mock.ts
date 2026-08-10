/**
 * Runtime stand-in for `*.css` imports under jest. esbuild turns those into
 * injected stylesheets at build time; in tests they carry no behavior, so the
 * module just needs to load.
 */
export default {};
