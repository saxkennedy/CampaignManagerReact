using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace CampaignManager.Services.Models
{
    public class UserResponse
    {
        public Guid Id { get; set; }
        public string Email { get; set; }
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public List<Guid> Campaigns { get; set; }
    }
}
