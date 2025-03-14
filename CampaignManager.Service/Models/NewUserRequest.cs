namespace CampaignManager.Services.Models
{
    public class NewUserRequest
    {
        public required string Email { get; set; }
        public required string Password { get; set; }
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
    }
}
