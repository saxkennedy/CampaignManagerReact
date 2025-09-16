public class ImageAsset
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string FileName { get; set; } = default!;
    public string ContentType { get; set; } = default!;
    public long Length { get; set; }
    public byte[] Data { get; set; } = default!; // varbinary(max)
    public DateTimeOffset CreatedUtc { get; set; } = DateTimeOffset.UtcNow;
}