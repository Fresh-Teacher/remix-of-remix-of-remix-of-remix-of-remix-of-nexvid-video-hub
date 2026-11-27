<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->
# AGENTS
- Movie/TV data comes from TMDB via server functions in src/lib/tmdb.functions.ts using the TMDB_API_KEY secret; why: keeps the key off the browser.
- Movie playback, homepage Luganda Translated & VJ shelves, and card Translated badges read dynamically from src/data/luganda-movies.json via src/lib/luganda-movies.ts with TMDB metadata resolved in src/lib/tmdb.functions.ts; why: avoids unlicensed embed scrapers and updates automatically when new MP4 links are added to the JSON catalog.
- Share the homepage query and deduplicate by media kind plus ID, preserving independent VJ/translated-genre shelves and nonempty category fallbacks; why: detail browsing reuses cached feeds without hiding niche collections that share films.
- Define all browsable niches (Luganda, every VJ, translated genres, curated TMDB lists, genres) once in src/lib/categories.ts and serve them through /category/$slug with getCategoryPage; why: keeps homepage row links, VJ pills, infinite scroll, and suggestions consistent.
- Resolve a shared, concurrency-bounded translated catalog index with TMDB genre IDs before building VJ and translated-genre shelves; why: translated genres contain only catalog movies and reuse metadata rather than independent upstream searches for every genre.
