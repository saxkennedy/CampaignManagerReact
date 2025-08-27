using Data.Models;

namespace CampaignManager.Services.Models
{
    public class UserResponse
    {
        public Guid Id { get; set; }
        public string Email { get; set; }
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public List<Campaign>? Campaigns { get; set; }
        public string Persona { get; set; }
        public List<CampaignPersona> CampaignPersonas { get; set; } // later will change to DB ref
    }
}
