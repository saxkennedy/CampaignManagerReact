using CampaignManager.Services.BastionSeeding;
using Data.Models;
using Microsoft.EntityFrameworkCore;

// Manual runner for the bastion-facility seed. Runs the exact same BastionSeeder the
// admin button uses (live-fetch 5etools source -> transform -> upsert by Name+SourceBook),
// so you can refresh the catalog without deploying the site.
//
// Usage:
//   dotnet run --project CampaignManager.BastionSeed.Cli -- "<SqlConnectionString>"
// or set the SqlConnectionString environment variable and run with no args.

var connectionString =
    args.FirstOrDefault(a => !a.StartsWith("-"))
    ?? Environment.GetEnvironmentVariable("SqlConnectionString");

if (string.IsNullOrWhiteSpace(connectionString))
{
    Console.Error.WriteLine(
        "No connection string. Pass it as the first argument, or set the SqlConnectionString environment variable.");
    return 1;
}

var options = new DbContextOptionsBuilder<CampaignManagerContext>()
    .UseSqlServer(connectionString)
    .Options;

await using var db = new CampaignManagerContext(options);
using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(60) };

Console.WriteLine("Fetching 5etools source data and upserting bastion facilities…");

try
{
    var s = await BastionSeeder.SeedAsync(db, http);

    Console.WriteLine(
        $"Done. total={s.Total}  added={s.Inserted}  updated={s.Updated}  unchanged={s.Unchanged}  skipped={s.ExcludedCount}");
    if (s.Excluded.Count > 0)
        Console.WriteLine("Skipped (non Core/Supplements source): " + string.Join(", ", s.Excluded));

    return 0;
}
catch (Exception ex)
{
    Console.Error.WriteLine($"Seed failed: {ex.Message}");
    return 1;
}
