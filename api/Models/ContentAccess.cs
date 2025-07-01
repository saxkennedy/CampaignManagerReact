namespace api.Models
{
    public class ContentAccess
    {
        public string Name { get; set; }
        public string DisplayName { get; set; }
        public bool HasAccess { get; set; } = false;
    }
}
