/** CORS allow-list for HTTP functions: the project's Hosting domains (+ localhost on the emulator). */
export function allowedOrigins(project: string, emulator: boolean): Array<string | RegExp> {
  const list: Array<string | RegExp> = [`https://${project}.web.app`, `https://${project}.firebaseapp.com`];
  if (emulator) list.push(/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/);
  return list;
}

/** Same matching rule the `cors` middleware uses for an array of strings/RegExps. */
export function isAllowedOrigin(origin: string, list: Array<string | RegExp>): boolean {
  return list.some((o) => (typeof o === "string" ? o === origin : o.test(origin)));
}
