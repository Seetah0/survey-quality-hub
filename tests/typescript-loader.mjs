import { registerHooks } from 'node:module';
registerHooks({
  resolve(specifier, context, next) {
    if (
      !context.parentURL?.includes('/node_modules/') &&
      specifier.startsWith('.') &&
      !/\.[a-z]+$/i.test(specifier)
    )
      return next(specifier + '.ts', context);
    if (specifier.endsWith('.json'))
      return next(specifier, {
        ...context,
        importAttributes: { type: 'json' },
      });
    return next(specifier, context);
  },
});
