using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace CampaignManager.Services.Models
{
    public class AddContentRequest
    {
        public Guid CampaignId { get; set; }
        public Guid? ParentContentId { get; set; }
        public Guid? CreatorId { get; set; }
        public string DisplayName { get; set; }
        public string Description { get; set; }
        public int AccessHierarchyLevel { get; set; }
        public string ContentLink { get; set; }
        public string IconLink { get; set; }
        public string SimpleContent {  get; set; }
    }
}
