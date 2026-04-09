using System.Net;
using System.Net.Mail;

namespace WebApplication1.Services;

public interface IEmailSender
{
    Task SendAsync(string to, string subject, string body);
}

public class SmtpEmailSender : IEmailSender
{
    private readonly IConfiguration _config;
    private readonly ILogger<SmtpEmailSender> _logger;

    public SmtpEmailSender(IConfiguration config, ILogger<SmtpEmailSender> logger)
    {
        _config = config;
        _logger = logger;
    }

    public async Task SendAsync(string to, string subject, string body)
    {
        var host = _config["Smtp:Host"];
        var from = _config["Smtp:From"];

        if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(from))
        {
            // SMTP not configured — print code to server console for dev/demo
            _logger.LogWarning("[2FA CODE] To: {To} | {Body}", to, body);
            return;
        }

        using var client = new SmtpClient(host, int.TryParse(_config["Smtp:Port"], out var p) ? p : 587)
        {
            EnableSsl = true,
            Credentials = new NetworkCredential(_config["Smtp:Username"], _config["Smtp:Password"])
        };

        var msg = new MailMessage(from, to, subject, body) { IsBodyHtml = false };
        await client.SendMailAsync(msg);
    }
}
