using CampaignManager.WebApp;

namespace CampaignManager.WebApp2
{
    public class Program
    {
        public static void Main(string[] args)
        {
            CreateHostBuilder(args).Build().Run();
        }
        public static IHostBuilder CreateHostBuilder(string[] args) =>
            Host.CreateDefaultBuilder(args)
                .ConfigureWebHostDefaults(webBuilder =>
                {
                    webBuilder.UseStartup<Startup>();
                })
                .ConfigureAppConfiguration((hostingContext, config) =>
                {
                    config.SetBasePath(Directory.GetCurrentDirectory());
                    config.AddJsonFile("DatabaseConnection.json", optional: true, reloadOnChange: true);
                    config.AddJsonFile($"appsettings.json", optional: true, reloadOnChange: true);
                    config.AddEnvironmentVariables();
                    IConfiguration root = config.Build();
                });
    }
}