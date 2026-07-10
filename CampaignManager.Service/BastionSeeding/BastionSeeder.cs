using System.Collections.Generic;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Data.Models;
using Microsoft.EntityFrameworkCore;

namespace CampaignManager.Services.BastionSeeding
{
    public sealed class BastionSeedSummary
    {
        public int Total { get; init; }
        public int Inserted { get; init; }
        public int Updated { get; init; }
        public int Unchanged { get; init; }
        public List<string> Excluded { get; init; } = new();
        public int ExcludedCount => Excluded.Count;
    }

    /// <summary>
    /// The full bastion-facility seed operation shared by the admin button
    /// (<c>AdminFunctions</c>) and the <c>CampaignManager.BastionSeed.Cli</c> tool:
    /// live-fetch the 5etools source data, transform it (<see cref="BastionSeedTransformer"/>),
    /// and upsert the catalog keyed by (Name, SourceBook) so existing Ids stay stable.
    ///
    /// One implementation, so the button and the manual CLI can never drift apart.
    /// </summary>
    public static class BastionSeeder
    {
        public const string BastionsUrl =
            "https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/bastions.json";
        public const string BooksUrl =
            "https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/books.json";

        public static async Task<BastionSeedSummary> SeedAsync(
            CampaignManagerContext db, HttpClient http, CancellationToken ct = default)
        {
            var bastionsJson = await http.GetStringAsync(BastionsUrl, ct);
            var booksJson = await http.GetStringAsync(BooksUrl, ct);

            var parsed = BastionSeedTransformer.Transform(bastionsJson, booksJson);

            int inserted = 0, updated = 0, unchanged = 0;
            var existing = await db.BastionFacilities.ToDictionaryAsync(f => (f.Name, f.SourceBook), ct);

            foreach (var r in parsed.Rows)
            {
                if (existing.TryGetValue((r.Name, r.SourceBook), out var e))
                {
                    var changed =
                        e.FacilityType != r.FacilityType ||
                        e.LevelRequired != r.LevelRequired ||
                        e.SpaceJson != r.SpaceJson ||
                        e.HirelingsJson != r.HirelingsJson ||
                        e.OrdersJson != r.OrdersJson ||
                        e.PrerequisiteJson != r.PrerequisiteJson ||
                        e.DescriptionMarkdown != r.DescriptionMarkdown ||
                        e.Page != r.Page;

                    if (changed)
                    {
                        e.FacilityType = r.FacilityType;
                        e.LevelRequired = r.LevelRequired;
                        e.SpaceJson = r.SpaceJson;
                        e.HirelingsJson = r.HirelingsJson;
                        e.OrdersJson = r.OrdersJson;
                        e.PrerequisiteJson = r.PrerequisiteJson;
                        e.DescriptionMarkdown = r.DescriptionMarkdown;
                        e.Page = r.Page;
                        updated++;
                    }
                    else
                    {
                        unchanged++;
                    }
                }
                else
                {
                    db.BastionFacilities.Add(new BastionFacility
                    {
                        Name = r.Name,
                        FacilityType = r.FacilityType,
                        LevelRequired = r.LevelRequired,
                        SpaceJson = r.SpaceJson,
                        HirelingsJson = r.HirelingsJson,
                        OrdersJson = r.OrdersJson,
                        PrerequisiteJson = r.PrerequisiteJson,
                        DescriptionMarkdown = r.DescriptionMarkdown,
                        SourceBook = r.SourceBook,
                        Page = r.Page,
                        // Id + DateAdded come from DB defaults (newid() / sysutcdatetime()).
                    });
                    inserted++;
                }
            }

            await db.SaveChangesAsync(ct);

            return new BastionSeedSummary
            {
                Total = parsed.Rows.Count,
                Inserted = inserted,
                Updated = updated,
                Unchanged = unchanged,
                Excluded = parsed.Excluded,
            };
        }
    }
}
