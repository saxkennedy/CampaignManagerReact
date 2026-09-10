-- Bastion-level display settings (currently: whether hallway and stairs labels are drawn).
-- Free-form JSON so later view settings can join it without another migration.
-- Shape: {"labelHallways":false,"labelStairs":false}
-- NULL is treated as "all defaults off" by the client, so existing bastions need no backfill.

IF NOT EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[CampaignBastions]')
      AND name = N'SettingsJson'
)
BEGIN
    ALTER TABLE [dbo].[CampaignBastions]
        ADD [SettingsJson] NVARCHAR(MAX) NULL;
END
GO
