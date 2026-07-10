using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace api;

public interface IEmailService
{
    Task SendVerificationEmailAsync(string toEmail, string code);
    Task SendPasswordResetEmailAsync(string toEmail, string code);
    Task SendTestEmailAsync(string toEmail);
}

public class SmtpEmailService : IEmailService
{
    public Task SendVerificationEmailAsync(string toEmail, string code) =>
        SendAsync(toEmail, "Your verification code",
            $"Your verification code is: {code}\n\nThis code expires in 15 minutes.\n\nIf you didn't sign up for Ender's Campaign Manager, you can safely ignore this email.");

    public Task SendPasswordResetEmailAsync(string toEmail, string code) =>
        SendAsync(toEmail, "Password reset code",
            $"Your password reset code is: {code}\n\nThis code expires in 15 minutes.\n\nIf you did not request a password reset, you can safely ignore this email.");

    public Task SendTestEmailAsync(string toEmail) =>
        SendAsync(toEmail, "Ender's Campaign Manager — SMTP test",
            $"This is a test email sent from the admin panel at {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss} UTC.\n\nIf you received this, outbound email is working.");

    // Single SMTP path for every message so all three share one connect/auth/send.
    // Any failure (e.g. a rotated SMTP password -> 535) throws to the caller, which is
    // what lets the admin test tool and the signup/reset flows report a real error.
    private static async Task SendAsync(string toEmail, string subject, string body)
    {
        var host = Environment.GetEnvironmentVariable("SmtpHost") ?? "smtp-pulse.com";
        var port = int.Parse(Environment.GetEnvironmentVariable("SmtpPort") ?? "465");
        var user = Environment.GetEnvironmentVariable("SmtpUser") ?? "";
        var pass = Environment.GetEnvironmentVariable("SmtpPass") ?? "";
        var fromAddress = Environment.GetEnvironmentVariable("SmtpFrom") ?? "support@enderdnd.com";

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress("Ender's Campaign Manager", fromAddress));
        message.To.Add(MailboxAddress.Parse(toEmail));
        message.Subject = subject;
        message.Body = new TextPart("plain") { Text = body };

        using var client = new SmtpClient();
        await client.ConnectAsync(host, port, SecureSocketOptions.Auto);
        await client.AuthenticateAsync(user, pass);
        await client.SendAsync(message);
        await client.DisconnectAsync(true);
    }
}
