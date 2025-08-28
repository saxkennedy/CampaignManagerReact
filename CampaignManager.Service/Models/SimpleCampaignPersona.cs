using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace CampaignManager.Services.Models
{
    public class SimpleCampaignPersona
    {
        public string DisplayName { get; set; }
        public Guid CampaignPersonaId { get; set; }
        public int  CampaignHierachyLevel { get; set; }
    }
}
