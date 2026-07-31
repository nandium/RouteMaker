# Shared app resources

`src/brand.ts` is the only editable logo geometry and palette. Run
`npm run brand:assets` after changing it; the command requires `rsvg-convert`
and `cwebp`, then refreshes the light/dark shared resources and the checked-in
iOS and Android launcher assets. Generated files keep native builds independent
of image-generation tooling. `npm run check` fails when any generated asset is
stale.
