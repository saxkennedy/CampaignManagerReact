using BCrypt.Net;
using CampaignManager.Services.Models;
using CampaignManager.Services.Services.Abstractions;
using Data.Models;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Security.Cryptography;
using System.Threading.Tasks;

namespace CampaignManager.Services.Services
{
    public class UserService : IUserService
    {
        private readonly CampaignManagerContext CampaignManagerContext;

        public UserService(CampaignManagerContext campaignManagerContext)
        {
            CampaignManagerContext = campaignManagerContext;
        }

        public async Task<UserResponse> CreateUser(NewUserRequest createUser)
        {
            var exists = await CampaignManagerContext.Users.AnyAsync(u => u.Email == createUser.Email);
            if (exists) throw new InvalidOperationException("An account with this email already exists.");

            var newUser = new User
            {
                Email = createUser.Email,
                FirstName = createUser.FirstName,
                LastName = createUser.LastName,
                Password = BCrypt.Net.BCrypt.HashPassword(createUser.Password),
                UserName = createUser.Email,
                DateAdded = DateTime.UtcNow,
                PersonaId = Guid.Parse("B6A68383-8651-406B-AC27-465CFD11A449"),
                IsVerified = false,
            };

            CampaignManagerContext.Users.Add(newUser);
            await CampaignManagerContext.SaveChangesAsync();

            return await BuildUserResponse(newUser);
        }

        public async Task<UserResponse> GetUser(string email, string password)
        {
            var user = await CampaignManagerContext.Users
                .FirstOrDefaultAsync(u => u.Email == email);

            if (user == null) return null;

            bool valid;
            if (user.Password.StartsWith("$2"))
            {
                // Already hashed — verify with bcrypt
                valid = BCrypt.Net.BCrypt.Verify(password, user.Password);
            }
            else
            {
                // Plaintext (legacy) — compare directly, then migrate to hash
                valid = user.Password == password;
                if (valid)
                {
                    user.Password = BCrypt.Net.BCrypt.HashPassword(password);
                    await CampaignManagerContext.SaveChangesAsync();
                }
            }

            if (!valid) return null;

            return await BuildUserResponse(user);
        }

        public async Task<UserResponse> GetUserById(Guid userId)
        {
            var user = await CampaignManagerContext.Users
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null) return null;

            return await BuildUserResponse(user);
        }

        public async Task<UserResponse?> GetUnverifiedUser(string email)
        {
            var user = await CampaignManagerContext.Users
                .FirstOrDefaultAsync(u => u.Email == email && !u.IsVerified);

            if (user == null) return null;

            return await BuildUserResponse(user);
        }

        public async Task<string> CreateVerificationCode(Guid userId)
        {
            var stale = CampaignManagerContext.EmailVerifications
                .Where(v => v.UserId == userId && !v.IsUsed);
            CampaignManagerContext.EmailVerifications.RemoveRange(stale);

            var code = RandomNumberGenerator.GetInt32(100000, 1000000).ToString();

            CampaignManagerContext.EmailVerifications.Add(new EmailVerification
            {
                UserId = userId,
                Code = code,
                CreatedAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddMinutes(15),
            });

            await CampaignManagerContext.SaveChangesAsync();
            return code;
        }

        public async Task<bool> VerifyUser(string email, string code)
        {
            var user = await CampaignManagerContext.Users
                .FirstOrDefaultAsync(u => u.Email == email);
            if (user == null) return false;

            var verification = await CampaignManagerContext.EmailVerifications
                .FirstOrDefaultAsync(v =>
                    v.UserId == user.Id &&
                    v.Code == code &&
                    !v.IsUsed &&
                    v.ExpiresAt > DateTime.UtcNow);

            if (verification == null) return false;

            verification.IsUsed = true;
            user.IsVerified = true;
            await CampaignManagerContext.SaveChangesAsync();
            return true;
        }

        public async Task<UserResponse?> GetUserByEmail(string email)
        {
            var user = await CampaignManagerContext.Users
                .FirstOrDefaultAsync(u => u.Email == email);
            return user == null ? null : await BuildUserResponse(user);
        }

        public async Task<string> CreatePasswordResetCode(Guid userId)
        {
            var stale = CampaignManagerContext.EmailVerifications
                .Where(v => v.UserId == userId && !v.IsUsed && v.Type == 1);
            CampaignManagerContext.EmailVerifications.RemoveRange(stale);

            var code = RandomNumberGenerator.GetInt32(100000, 1000000).ToString();

            CampaignManagerContext.EmailVerifications.Add(new EmailVerification
            {
                UserId = userId,
                Code = code,
                CreatedAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddMinutes(15),
                Type = 1,
            });

            await CampaignManagerContext.SaveChangesAsync();
            return code;
        }

        public async Task<bool> IsResetCodeValid(string email, string code)
        {
            var user = await CampaignManagerContext.Users
                .FirstOrDefaultAsync(u => u.Email == email);
            if (user == null) return false;

            return await CampaignManagerContext.EmailVerifications
                .AnyAsync(v =>
                    v.UserId == user.Id &&
                    v.Code == code &&
                    v.Type == 1 &&
                    !v.IsUsed &&
                    v.ExpiresAt > DateTime.UtcNow);
        }

        public async Task<bool> ResetPassword(string email, string code, string newPassword)
        {
            var user = await CampaignManagerContext.Users
                .FirstOrDefaultAsync(u => u.Email == email);
            if (user == null) return false;

            var verification = await CampaignManagerContext.EmailVerifications
                .FirstOrDefaultAsync(v =>
                    v.UserId == user.Id &&
                    v.Code == code &&
                    v.Type == 1 &&
                    !v.IsUsed &&
                    v.ExpiresAt > DateTime.UtcNow);

            if (verification == null) return false;

            verification.IsUsed = true;
            user.Password = BCrypt.Net.BCrypt.HashPassword(newPassword);
            await CampaignManagerContext.SaveChangesAsync();
            return true;
        }

        public async Task<bool> ChangePassword(Guid userId, string currentPassword, string newPassword)
        {
            var user = await CampaignManagerContext.Users.FindAsync(userId);
            if (user == null) return false;

            bool valid = user.Password.StartsWith("$2")
                ? BCrypt.Net.BCrypt.Verify(currentPassword, user.Password)
                : user.Password == currentPassword;

            if (!valid) return false;

            user.Password = BCrypt.Net.BCrypt.HashPassword(newPassword);
            await CampaignManagerContext.SaveChangesAsync();
            return true;
        }

        public async Task DeleteUser(Guid userId)
        {
            var user = await CampaignManagerContext.Users.FindAsync(userId);
            if (user != null)
            {
                CampaignManagerContext.Users.Remove(user);
                await CampaignManagerContext.SaveChangesAsync();
            }
        }

        private async Task<UserResponse> BuildUserResponse(User user)
        {
            return new UserResponse
            {
                Id = user.Id,
                Email = user.Email,
                FirstName = user.FirstName,
                LastName = user.LastName,
                Persona = user.PersonaId.ToString(),
                IsVerified = user.IsVerified,
                CampaignPersonas = await CampaignManagerContext.Procedures.GetCampaignPersonaAsync(user.Id)
            };
        }
    }
}
