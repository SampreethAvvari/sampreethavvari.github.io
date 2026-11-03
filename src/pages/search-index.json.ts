// /search-index.json: what the search dialog looks through. A file of its own so
// no page carries the list of every post in its HTML.
import type { APIRoute } from "astro";
import { searchItems } from "../data/searchItems";

export const GET: APIRoute = () =>
  new Response(JSON.stringify(searchItems), {
    headers: { "Content-Type": "application/json" },
  });
