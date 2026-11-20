// Lets `node --test` load app files that import siblings without a ".ts" extension.
// Usage: node --import ./tests/ts-resolve.mjs --test tests/parseList.test.ts
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, next) {
    if (/^\.{1,2}\//.test(specifier) && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      try {
        return next(specifier + ".ts", context);
      } catch {}
    }
    return next(specifier, context);
  },
});
