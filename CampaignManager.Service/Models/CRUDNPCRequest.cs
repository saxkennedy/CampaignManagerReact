using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace CampaignManager.Services.Models
{
    public class CRUDNPCRequest
    {
        public Guid? Id { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public string Description { get; set; }
        public Guid CampaignId { get; set; }
        public bool Delete { get; set; } = false;
        public List<ImageAsset> ImageAssets { get; set; }
    }
}
