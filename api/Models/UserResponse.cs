using System;
using System.Collections.Generic;

namespace api.Models
{
    public class UserResponse
    {
        public Guid Id { get; set; }
        public string Email { get; set; }
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public List<Guid>? Campaigns { get; set; }
        public string Persona { get; set; }
        public List<ContentAccess>? ContentAccess { get; set; } // later will change to DB ref
    }
}
