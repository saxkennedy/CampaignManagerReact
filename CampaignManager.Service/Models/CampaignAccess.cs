using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Data.Models;

namespace CampaignManager.Services.Models
{
    public class CampaignAccess
    {
        public string? Name { get; set; }
        public CampaignPersona CampaignPersona { get; set; }
        public List<Guid>? AccessKeys { get; set; }


    }
}
