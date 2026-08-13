/*
    Adds CampaignCategoryContentXREF.Editable.

    When set, the campaign content's Google Doc/Sheet is embedded in edit mode
    instead of read-only. The Drive file itself must also be shared as editable —
    this flag only controls how we embed it.

    The schema is managed database-first (EF Core Power Tools scaffolding, no
    migrations), so run this against the database before deploying the API.
*/

IF NOT EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.CampaignCategoryContentXREF')
      AND name = N'Editable'
)
BEGIN
    ALTER TABLE dbo.CampaignCategoryContentXREF
        ADD Editable BIT NOT NULL CONSTRAINT DF_CampaignCategoryContentXREF_Editable DEFAULT (0);
END
GO
