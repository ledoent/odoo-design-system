No configuration is required after install. The CSS tokens are
available on `:root`; the OWL components are registered automatically
on the backend asset bundle.

To use the tokens from a Sass file in your own module:

1. Depend on `oca_design_system` in your `__manifest__.py`.
2. Reference the CSS variables directly (`var(--oca-accent)` etc.) — no
   `@import` needed; Odoo's asset bundler concatenates SCSS in
   manifest order and `_tokens.scss` is loaded ahead of everything.
3. To get the Sass-level maps + mixins, list the partial above your
   own SCSS in your manifest:

   ```python
   "assets": {
       "web.assets_backend": [
           "oca_design_system/static/src/scss/_tokens.scss",
           "your_module/static/src/scss/your_styles.scss",
       ],
   }
   ```
