// Isolated, read-only proof of concept. NOT callable from the public PWA.
// Only Supabase's named secret API key may invoke this function.
import { withSupabase } from "npm:@supabase/server@1";

const HEADERS = { "Cache-Control": "no-store" };
const PROXY_ORIGIN = "https://cocproxy.royaleapi.dev";
const TIMEOUT_MS = 12000;

export default {
  fetch: withSupabase({ auth: "secret" }, async (request) => {
    if (request.method !== "POST") {
      return Response.json({ ok: false, error: "method_not_allowed" }, {
        status: 405, headers: { ...HEADERS, Allow: "POST" },
      });
    }

    const apiKey = Deno.env.get("COC_API_KEY")?.trim();
    const rawTag = Deno.env.get("COC_CLAN_TAG")?.trim().toUpperCase();
    if (!apiKey || !rawTag) {
      return Response.json({ ok: false, error: "missing_server_configuration" }, {
        status: 503, headers: HEADERS,
      });
    }

    const clanTag = rawTag.startsWith("#") ? rawTag : `#${rawTag}`;
    if (!/^#[0-9A-Z]{3,15}$/.test(clanTag)) {
      return Response.json({ ok: false, error: "invalid_clan_tag_configuration" }, {
        status: 503, headers: HEADERS,
      });
    }

    // Never accept an arbitrary URL, a caller-supplied clan tag or API key.
    const path = `/v1/clans/${encodeURIComponent(clanTag)}/members`;
    try {
      const upstream = await fetch(`${PROXY_ORIGIN}${path}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!upstream.ok) {
        return Response.json({
          ok: false,
          error: "supercell_request_failed",
          upstreamStatus: upstream.status,
        }, { status: 502, headers: HEADERS });
      }
      const result = await upstream.json();
      if (!result || !Array.isArray(result.items)) {
        return Response.json({ ok: false, error: "unexpected_supercell_response" }, {
          status: 502, headers: HEADERS,
        });
      }
      // Expose only fields that the future manual import flow needs.
      const members = result.items.map((member) => ({
        tag: String(member.tag ?? ""),
        name: String(member.name ?? ""),
        townHallLevel: Number.isInteger(member.townHallLevel) ? member.townHallLevel : null,
        role: String(member.role ?? "member"),
      }));
      return Response.json({
        ok: true,
        clanTag,
        memberCount: members.length,
        members,
      }, { headers: HEADERS });
    } catch (error) {
      return Response.json({
        ok: false,
        error: error instanceof Error && error.name === "TimeoutError"
          ? "upstream_timeout" : "upstream_unreachable",
      }, { status: 502, headers: HEADERS });
    }
  }),
};
