# Archetype portrait assets

Drop the 24 cropped portrait files here, one per archetype per gender:

```
female/everyperson.webp   male/everyperson.webp
female/innocent.webp      male/innocent.webp
female/hero.webp          male/hero.webp
female/caregiver.webp     male/caregiver.webp
female/explorer.webp      male/explorer.webp
female/lover.webp         male/lover.webp
female/outlaw.webp        male/outlaw.webp
female/creator.webp       male/creator.webp
female/magician.webp      male/magician.webp
female/ruler.webp         male/ruler.webp
female/sage.webp          male/sage.webp
female/jester.webp        male/jester.webp
```

Once the files exist, set the matching `femaleImage`/`maleImage` path on each
entry in `ARCHETYPE_DEFS` (app/shared/mock-db.js) — e.g.
`femaleImage: '../assets/archetypes/female/everyperson.webp'` from a
`client/` page, or `../../assets/archetypes/...` from a nested path. Nothing
else needs to change — `archetypePortrait()` in shared/ui.js already renders
the real image the moment the path stops being null, and falls back to a
graceful placeholder until then.
