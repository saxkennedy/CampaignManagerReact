# CampaignManager.BastionSeed.Cli

Manual runner for the **bastion-facility seed**. It executes the exact same
`BastionSeeder` that the admin website button runs, so you can refresh the
`dbo.BastionFacilities` catalog from source **without deploying the site**.

## What it does

1. Live-fetches the 5etools source data (`bastions.json` + `books.json`) from the
   `5etools-mirror-3/5etools-src` GitHub mirror.
2. Transforms it with `BastionSeedTransformer` (renders `{@tag}` markup to Markdown,
   strips markup out of the raw JSON columns, filters to official Core/Supplements
   sources).
3. **Upserts** into `dbo.BastionFacilities` keyed by **(Name, SourceBook)** — existing
   rows are updated in place (Ids stay stable), new facilities are inserted. Nothing is
   deleted.

The transform and upsert live in `CampaignManager.Service/BastionSeeding/`
(`BastionSeedTransformer`, `BastionSeeder`) — a single shared implementation used by
both this CLI and the site's admin button (`api/Admin/AdminFunctions.cs`), so the two
can never drift apart.

## How to run it manually

From the repository root. Provide the SQL connection string one of two ways:

**Pass it as the first argument:**

```bash
dotnet run --project CampaignManager.BastionSeed.Cli -- "Server=tcp:<host>,<port>;Initial Catalog=CampaignManager;User ID=<user>;Password=<pw>;Encrypt=True;TrustServerCertificate=True"
```

**Or set the `SqlConnectionString` environment variable and run with no args:**

```powershell
# PowerShell
$env:SqlConnectionString = "Server=tcp:<host>,<port>;Initial Catalog=CampaignManager;User ID=<user>;Password=<pw>;Encrypt=True;TrustServerCertificate=True"
dotnet run --project CampaignManager.BastionSeed.Cli
```

```bash
# bash
SqlConnectionString="Server=tcp:<host>,<port>;Initial Catalog=CampaignManager;..." \
  dotnet run --project CampaignManager.BastionSeed.Cli
```

> The same connection string is in `api/local.settings.json` under `SqlConnectionString`
> if you want to target the same database the local Functions host uses.

You can also build once and run the produced executable (named `bastionseed`):

```bash
dotnet build -c Release CampaignManager.BastionSeed.Cli
./CampaignManager.BastionSeed.Cli/bin/Release/net9.0/bastionseed "<SqlConnectionString>"
```

## Output

```
Fetching 5etools source data and upserting bastion facilities…
Done. total=61  added=0  updated=0  unchanged=61  skipped=0
```

- `added` / `updated` will be non-zero when the 5etools mirror has changed since the last
  seed; a clean re-run reports everything as `unchanged`.
- `skipped` lists any facilities dropped because their source book isn't an official
  Core/Supplements source.

## When 5etools changes their format

If 5etools introduces new `{@tag}` types or reshapes the source schema, edit the shared
`BastionSeedTransformer` once. Your CLI runs pick up the change immediately (no deploy);
the website button picks it up on the next API deploy. Keep it in sync with the reference
Python script `gen_inserts.py`.
