namespace Data.Models;

public class EmailVerification
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string Code { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public bool IsUsed { get; set; }
    public byte Type { get; set; } // 0 = email verification, 1 = password reset
}
