using Data.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace CampaignManager.Services.Models
{
    public class CampaignContentResponse
    {
        public List<CampaignCategoryContentXref> CampaignContent { get; set; }
        public List<CampaignPersona> CampaignPersonas { get; set; }
        public List<ContentType> ContentTypes { get; set; }
    }
}
