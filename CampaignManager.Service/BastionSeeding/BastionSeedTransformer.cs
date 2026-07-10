using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace CampaignManager.Services.BastionSeeding
{
    /// <summary>
    /// C# port of gen_inserts.py (the bastion-seeding script).
    /// Turns the 5etools "bastions.json" + "books.json" source data into flat
    /// BastionFacility rows: renders 5etools {@tag} markup to Markdown for the
    /// description, and strips {@tag} markup out of the raw JSON columns.
    ///
    /// Keep this in sync with gen_inserts.py — behavior mirrors it deliberately
    /// (verified byte-identical against the Python output). This is the single
    /// source of truth shared by the admin button and the BastionSeed CLI.
    /// </summary>
    public static class BastionSeedTransformer
    {
        public sealed class Row
        {
            public string Name { get; set; } = "";
            public string FacilityType { get; set; } = "";
            public int? LevelRequired { get; set; }
            public string? SpaceJson { get; set; }
            public string? HirelingsJson { get; set; }
            public string? OrdersJson { get; set; }
            public string? PrerequisiteJson { get; set; }
            public string DescriptionMarkdown { get; set; } = "";
            public string SourceBook { get; set; } = "";
            public int? Page { get; set; }
        }

        public sealed class Result
        {
            public List<Row> Rows { get; } = new();
            public List<string> Excluded { get; } = new();
        }

        private const string BASE = "https://5e.tools/";

        // tag -> 5e.tools list page (hash = <name>_<source>). Mirrors render.js getTagMeta switch.
        private static readonly Dictionary<string, string> PAGE = new()
        {
            ["spell"] = "spells.html",
            ["item"] = "items.html",
            ["creature"] = "bestiary.html",
            ["condition"] = "conditionsdiseases.html",
            ["disease"] = "conditionsdiseases.html",
            ["status"] = "conditionsdiseases.html",
            ["action"] = "actions.html",
            ["variantrule"] = "variantrules.html",
            ["reward"] = "rewards.html",
            ["feat"] = "feats.html",
        };

        // Keep raw-JSON columns human-readable (don't \u-escape) — the values are simple/ASCII.
        private static readonly JsonSerializerOptions CompactJson = new()
        {
            Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
            WriteIndented = false,
        };

        private static readonly Regex TagPattern =
            new(@"\{@(\w+)\s*([^{}]*)\}", RegexOptions.Compiled);

        /// <summary>
        /// Transform the two source documents into rows, filtering to official sources
        /// (those present in books.json — excludes 3rd-party homebrew and Adventures).
        /// </summary>
        public static Result Transform(string bastionsJson, string booksJson)
        {
            var result = new Result();

            using var booksDoc = JsonDocument.Parse(booksJson);
            var official = new HashSet<string>(StringComparer.Ordinal);
            if (booksDoc.RootElement.TryGetProperty("book", out var books) && books.ValueKind == JsonValueKind.Array)
            {
                foreach (var b in books.EnumerateArray())
                    if (b.TryGetProperty("source", out var s) && s.ValueKind == JsonValueKind.String)
                        official.Add(s.GetString()!);
            }

            using var bastionsDoc = JsonDocument.Parse(bastionsJson);
            if (!bastionsDoc.RootElement.TryGetProperty("facility", out var facilities) ||
                facilities.ValueKind != JsonValueKind.Array)
                return result;

            foreach (var f in facilities.EnumerateArray())
            {
                var source = GetString(f, "source") ?? "";
                var name = GetString(f, "name") ?? "";

                if (!official.Contains(source))
                {
                    result.Excluded.Add($"{name} [{source}]");
                    continue;
                }

                result.Rows.Add(new Row
                {
                    Name = name,
                    FacilityType = GetString(f, "facilityType") ?? "",
                    LevelRequired = GetInt(f, "level"),
                    SpaceJson = JsonColumn(f, "space"),
                    HirelingsJson = JsonColumn(f, "hirelings"),
                    OrdersJson = JsonColumn(f, "orders"),
                    PrerequisiteJson = JsonColumn(f, "prerequisite"),
                    DescriptionMarkdown = f.TryGetProperty("entries", out var entries)
                        ? Render(entries, 0)
                        : "",
                    SourceBook = source,
                    Page = GetInt(f, "page"),
                });
            }

            return result;
        }

        // ---------- helpers ----------

        private static string? GetString(JsonElement obj, string key) =>
            obj.TryGetProperty(key, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

        private static int? GetInt(JsonElement obj, string key) =>
            obj.TryGetProperty(key, out var v) && v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var i)
                ? i
                : (int?)null;

        // matches 5e.tools String.toUrlified: encodeURIComponent(s.toLowerCase()).toLowerCase()
        private static string Urlified(string s)
        {
            var escaped = Uri.EscapeDataString(s.ToLowerInvariant());
            // encodeURIComponent leaves these unescaped; Uri.EscapeDataString encodes them.
            escaped = escaped
                .Replace("%21", "!").Replace("%2A", "*").Replace("%27", "'")
                .Replace("%28", "(").Replace("%29", ")");
            return escaped.ToLowerInvariant();
        }

        // protect markdown link syntax from literal parens (5e.tools decodes %28/%29 the same)
        private static string MdUrl(string u) => u.Replace("(", "%28").Replace(")", "%29");

        private static string MdLink(string display, string url)
        {
            var disp = display.Replace("[", "\\[").Replace("]", "\\]");
            return $"[{disp}]({MdUrl(url)})";
        }

        // {@book display|book|chapter|section|number} -> book[,chapter[,section,number]]
        private static string BookHash(string[] parts)
        {
            string PartOr(int i) => i < parts.Length && parts[i].Trim().Length > 0 ? parts[i].Trim() : "";
            var book = PartOr(1);
            var chapter = PartOr(2);
            var section = PartOr(3);
            var number = parts.Length > 4 && parts[4].Trim().Length > 0 ? parts[4].Trim() : "0";
            var h = book.ToLowerInvariant();
            if (chapter.Length > 0)
            {
                h += "," + chapter;
                if (section.Length > 0)
                    h += "," + Urlified(section) + "," + Urlified(number);
            }
            return h;
        }

        private static string? Part(string[] parts, int i) =>
            i < parts.Length && parts[i].Trim().Length > 0 ? parts[i].Trim() : null;

        // ---- inline {@tag ...} -> markdown (links preserved as [text](url)) ----
        private static string StripTags(string s)
        {
            string prev;
            do
            {
                prev = s;
                s = TagPattern.Replace(s, Repl);
            } while (prev != s);
            return s;
        }

        private static string Repl(Match m)
        {
            var tag = m.Groups[1].Value.ToLowerInvariant();
            var raw = m.Groups[2].Value;
            var parts = raw.Length > 0 ? raw.Split('|') : new[] { "" };
            var disp = parts[0].Trim();

            switch (tag)
            {
                case "b":
                case "bold":
                    return $"**{disp}**";
                case "i":
                case "italic":
                    return $"*{disp}*";
                case "dc":
                    return $"DC {disp}";
                case "chance":
                    return Part(parts, 1) ?? $"{disp} percent";
                case "dice":
                case "damage":
                    return Part(parts, 1) ?? disp;
                case "book":
                case "adventure":
                {
                    var page = tag == "book" ? "book.html" : "adventure.html";
                    return MdLink(disp, $"{BASE}{page}#{BookHash(parts)}");
                }
                case "filter":
                    return disp;
            }

            // linkable list-page tags: {@tag name|source|displayOverride}
            if (PAGE.TryGetValue(tag, out var listPage))
            {
                var src = Part(parts, 1) ?? "";
                var url = $"{BASE}{listPage}#{Urlified(disp)}_{Urlified(src)}";
                return MdLink(Part(parts, 2) ?? disp, url);
            }

            // faux pages (skill, sense) and anything else -> plain text
            return Part(parts, 2) ?? disp;
        }

        // ---- 5etools entries -> markdown ----
        private static string Render(JsonElement entries, int depth)
        {
            if (entries.ValueKind != JsonValueKind.Array)
                return "";

            var outParts = new List<string>();

            foreach (var e in entries.EnumerateArray())
            {
                if (e.ValueKind == JsonValueKind.String)
                {
                    outParts.Add(StripTags(e.GetString() ?? ""));
                }
                else if (e.ValueKind == JsonValueKind.Object)
                {
                    var t = GetString(e, "type");
                    if (t == "entries")
                    {
                        var name = GetString(e, "name");
                        if (!string.IsNullOrEmpty(name))
                        {
                            var hashes = new string('#', Math.Min(depth + 3, 6));
                            outParts.Add($"{hashes} {StripTags(name)}");
                        }
                        if (e.TryGetProperty("entries", out var sub))
                            outParts.Add(Render(sub, depth + 1));
                    }
                    else if (t == "item")
                    {
                        var name = StripTags(GetString(e, "name") ?? "");
                        var bodyParts = new List<string>();
                        if (e.TryGetProperty("entry", out var entry) && entry.ValueKind == JsonValueKind.String)
                            bodyParts.Add(StripTags(entry.GetString() ?? ""));
                        if (e.TryGetProperty("entries", out var itemEntries))
                            bodyParts.Add(Render(itemEntries, depth + 1));
                        var body = string.Join(" ", bodyParts.Where(p => !string.IsNullOrEmpty(p)));
                        outParts.Add($"- **{name}** {body}".TrimEnd());
                    }
                    else if (t == "list")
                    {
                        var items = new List<string>();
                        if (e.TryGetProperty("items", out var listItems) && listItems.ValueKind == JsonValueKind.Array)
                        {
                            foreach (var it in listItems.EnumerateArray())
                            {
                                if (it.ValueKind == JsonValueKind.String)
                                    items.Add($"- {StripTags(it.GetString() ?? "")}");
                                else
                                    items.Add(Render(WrapOne(it), depth));
                            }
                        }
                        outParts.Add(string.Join("\n", items));
                    }
                    else if (t == "table")
                    {
                        outParts.Add(RenderTable(e, depth));
                    }
                    else
                    {
                        // fallback: render any nested entries
                        if (e.TryGetProperty("entries", out var nested))
                            outParts.Add(Render(nested, depth));
                    }
                }
            }

            return string.Join("\n\n", outParts.Where(p => !string.IsNullOrEmpty(p)));
        }

        private static string RenderTable(JsonElement e, int depth)
        {
            var lines = new List<string>();

            var cap = GetString(e, "caption");
            if (!string.IsNullOrEmpty(cap))
                lines.Add($"**{StripTags(cap)}**");

            var cols = new List<string>();
            if (e.TryGetProperty("colLabels", out var colLabels) && colLabels.ValueKind == JsonValueKind.Array)
                foreach (var c in colLabels.EnumerateArray())
                    cols.Add(StripTags(c.ValueKind == JsonValueKind.String ? c.GetString() ?? "" : c.GetRawText()));

            if (cols.Count > 0)
            {
                lines.Add("| " + string.Join(" | ", cols) + " |");
                lines.Add("| " + string.Join(" | ", Enumerable.Repeat("---", cols.Count)) + " |");
            }

            if (e.TryGetProperty("rows", out var rows) && rows.ValueKind == JsonValueKind.Array)
            {
                foreach (var row in rows.EnumerateArray())
                {
                    var cells = new List<string>();
                    if (row.ValueKind == JsonValueKind.Array)
                        foreach (var c in row.EnumerateArray())
                            cells.Add(StripTags(c.ValueKind == JsonValueKind.String ? c.GetString() ?? "" : c.GetRawText()));
                    lines.Add("| " + string.Join(" | ", cells) + " |");
                }
            }

            if (e.TryGetProperty("footnotes", out var footnotes) && footnotes.ValueKind == JsonValueKind.Array)
            {
                foreach (var fn in footnotes.EnumerateArray())
                {
                    lines.Add("");
                    lines.Add(fn.ValueKind == JsonValueKind.String
                        ? $"*{StripTags(fn.GetString() ?? "")}*"
                        : Render(WrapOne(fn), depth));
                }
            }

            return string.Join("\n", lines);
        }

        // render() takes an array; wrap a single element so we can reuse it (mirrors render([it], depth)).
        private static JsonElement WrapOne(JsonElement one)
        {
            using var doc = JsonDocument.Parse($"[{one.GetRawText()}]");
            return doc.RootElement.Clone();
        }

        // Serialize a facility's sub-object as a compact JSON string with {@tag} markup stripped
        // from every string value; null when the key is absent (mirrors jcol()).
        private static string? JsonColumn(JsonElement facility, string key)
        {
            if (!facility.TryGetProperty(key, out var el))
                return null;

            var node = JsonNode.Parse(el.GetRawText());
            var cleaned = CleanStrings(node);
            return cleaned is null ? "null" : cleaned.ToJsonString(CompactJson);
        }

        private static JsonNode? CleanStrings(JsonNode? node)
        {
            switch (node)
            {
                case JsonArray arr:
                {
                    var next = new JsonArray();
                    foreach (var item in arr)
                        next.Add(CleanStrings(item));
                    return next;
                }
                case JsonObject obj:
                {
                    var next = new JsonObject();
                    foreach (var kv in obj)
                        next[kv.Key] = CleanStrings(kv.Value);
                    return next;
                }
                case JsonValue val when val.TryGetValue<string>(out var s):
                    return JsonValue.Create(StripTags(s));
                default:
                    return node?.DeepClone();
            }
        }
    }
}
