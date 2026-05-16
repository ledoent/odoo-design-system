No configuration is required after install. The CSS tokens are
available on `:root`; the OWL components are registered automatically
on the backend asset bundle.

To use the tokens from a Sass file in your own module:

1. Depend on `odoo_design_system` in your `__manifest__.py`.
2. Reference the CSS variables directly (`var(--ods-accent)` etc.) — no
   `@import` needed; Odoo's asset bundler concatenates SCSS in
   manifest order and `_tokens.scss` is loaded ahead of everything.
3. To get the Sass-level maps + mixins, list the partial above your
   own SCSS in your manifest:

   ```python
   "assets": {
       "web.assets_backend": [
           "odoo_design_system/static/src/scss/_tokens.scss",
           "your_module/static/src/scss/your_styles.scss",
       ],
   }
   ```

## Browser support

The chip + card-tile styles use `color-mix(in srgb, ...)` to derive
soft / dark variants of `--ods-accent`. `color-mix` is **CSS Color
Module 5**, supported in:

- Chrome / Edge 111+ (Mar 2023)
- Firefox 113+ (May 2023)
- Safari 16.4+ (Mar 2023)

That matches Odoo 19's documented browser baseline. If a downstream
project needs to support older browsers, override the chip variants
with pre-mixed colors via plain CSS variables (e.g.
`--ods-accent-soft` / `--ods-accent-strong`) and patch the
`.ods_chip--ext` / `.ods_chip--count` rules to consume them. The
token system is otherwise unchanged.
