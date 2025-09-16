using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace CampaignManager.Services.Models
{
    public class CRUDContentRequest
    {
        public Guid? Id { get; set; } //if this is present, we are updating an existing record
        public Guid CampaignId { get; set; }
        public Guid? ParentContentId { get; set; }
        public Guid? CreatorId { get; set; }
        public string DisplayName { get; set; }
        public string Description { get; set; }
        public int AccessHierarchyLevel { get; set; }
        public string ContentLink { get; set; }
        public string IconLink { get; set; }
        public string SimpleContent {  get; set; }
        public bool Delete { get; set; } = false;
        public Guid ContentType { get; set; }

    }
}
