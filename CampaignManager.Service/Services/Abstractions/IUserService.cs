using CampaignManager.Services.Models;
using Data.Models;

namespace CampaignManager.Services.Services.Abstractions
{
    public interface IUserService
    {
        Task<UserResponse> CreateUser(NewUserRequest user);
        Task<UserResponse> GetUser(string email, string password);
        Task<UserResponse> GetUserById(Guid userId);
        Task<string> CreateVerificationCode(Guid userId);
        Task<bool> VerifyUser(string email, string code);
        Task DeleteUser(Guid userId);
        Task<UserResponse?> GetUnverifiedUser(string email);
        Task<UserResponse?> GetUserByEmail(string email);
        Task<string> CreatePasswordResetCode(Guid userId);
        Task<bool> ResetPassword(string email, string code, string newPassword);
        Task<bool> IsResetCodeValid(string email, string code);
        Task<bool> ChangePassword(Guid userId, string currentPassword, string newPassword);
    }
}
