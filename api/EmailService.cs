using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace api;

public interface IEmailService
{
    Task SendVerificationEmailAsync(string toEmail, string code);
    Task SendPasswordResetEmailAsync(string toEmail, string code);
}

public class SmtpEmailService : IEmailService
{
    public async Task SendVerificationEmailAsync(string toEmail, string code)
    {
        var host = Environment.GetEnvironmentVariable("SmtpHost") ?? "smtp-pulse.com";
        var port = int.Parse(Environment.GetEnvironmentVariable("SmtpPort") ?? "587");
        var user = Environment.GetEnvironmentVariable("SmtpUser") ?? "";
        var pass = Environment.GetEnvironmentVariable("SmtpPass") ?? "";
        var fromAddress = Environment.GetEnvironmentVariable("SmtpFrom") ?? "support@enderdnd.com";

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress("Ender's Campaign Manager", fromAddress));
        message.To.Add(MailboxAddress.Parse(toEmail));
        message.Subject = "Your verification code";
        message.Body = new TextPart("plain")
        {
            Text = $"Your verification code is: {code}\n\nThis code expires in 15 minutes.\n\nIf you didn't sign up for Ender's Campaign Manager, you can safely ignore this email."
        };

        using var client = new SmtpClient();
        await client.ConnectAsync(host, port, SecureSocketOptions.Auto);
        await client.AuthenticateAsync(user, pass);
        await client.SendAsync(message);
        await client.DisconnectAsync(true);
    }

    public async Task SendPasswordResetEmailAsync(string toEmail, string code)
    {
        var host = Environment.GetEnvironmentVariable("SmtpHost") ?? "smtp-pulse.com";
        var port = int.Parse(Environment.GetEnvironmentVariable("SmtpPort") ?? "465");
        var user = Environment.GetEnvironmentVariable("SmtpUser") ?? "";
        var pass = Environment.GetEnvironmentVariable("SmtpPass") ?? "";
        var fromAddress = Environment.GetEnvironmentVariable("SmtpFrom") ?? "support@enderdnd.com";

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress("Ender's Campaign Manager", fromAddress));
        message.To.Add(MailboxAddress.Parse(toEmail));
        message.Subject = "Password reset code";
        message.Body = new TextPart("plain")
        {
            Text = $"Your password reset code is: {code}\n\nThis code expires in 15 minutes.\n\nIf you did not request a password reset, you can safely ignore this email."
        };

        using var client = new SmtpClient();
        await client.ConnectAsync(host, port, SecureSocketOptions.Auto);
        await client.AuthenticateAsync(user, pass);
        await client.SendAsync(message);
        await client.DisconnectAsync(true);
    }
}
